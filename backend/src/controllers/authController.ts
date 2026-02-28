import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { query } from '../db/pool';
import { AuthRequest } from '../middleware/auth';

// ─── Constants ───────────────────────────────────────────────
const SALT_ROUNDS = 12;
const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MINUTES = 30;
const ACCESS_TOKEN_EXPIRY = '24h';
const REFRESH_TOKEN_EXPIRY_DAYS = 30;
const JWT_SECRET = () => process.env.JWT_SECRET || 'logistics_crm_super_secret_jwt_key_2024';

// ─── Helpers ─────────────────────────────────────────────────
function generateRefreshToken(): string {
  return crypto.randomBytes(64).toString('hex');
}

function getDeviceFingerprint(req: Request): string {
  const ua = req.headers['user-agent'] || '';
  const ip = req.ip || '';
  return crypto.createHash('sha256').update(`${ua}${ip}`).digest('hex').slice(0, 32);
}

async function logLoginAttempt(
  email: string,
  result: 'success' | 'wrong_password' | 'user_not_found' | 'account_locked' | 'account_inactive',
  req: Request,
  userId?: string
) {
  try {
    await query(
      `INSERT INTO login_attempts (email, user_id, ip_address, user_agent, result)
       VALUES ($1, $2, $3, $4, $5)`,
      [email.toLowerCase(), userId || null, req.ip, req.headers['user-agent'], result]
    );
  } catch { /* non-blocking */ }
}

async function logActivity(
  userId: string,
  action: string,
  entityType: string,
  entityId: string,
  req?: Request,
  metadata?: Record<string, unknown>
) {
  try {
    await query(
      `INSERT INTO activity_logs (user_id, action, entity_type, entity_id, ip_address, user_agent, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [userId, action, entityType, entityId, req?.ip, req?.headers['user-agent'], JSON.stringify(metadata || {})]
    );
  } catch { /* non-blocking */ }
}

/** Returns true when at least one active Admin user exists */
async function adminExists(): Promise<boolean> {
  const r = await query(
    `SELECT 1 FROM users u
     JOIN roles r ON u.role_id = r.id
     WHERE r.name = 'Admin' AND u.is_active = TRUE
     LIMIT 1`
  );
  return r.rows.length > 0;
}

// ─── SETUP STATUS ─────────────────────────────────────────────
/**
 * GET /auth/setup-status
 * Public – returns { needsSetup: true } when no Admin exists.
 */
export const setupStatus = async (_req: Request, res: Response): Promise<void> => {
  try {
    const has = await adminExists();
    res.json({ needsSetup: !has });
  } catch (error) {
    console.error('SetupStatus error:', error);
    res.status(500).json({ success: false, message: 'Failed to check setup status' });
  }
};

// ─── SETUP ADMIN ──────────────────────────────────────────────
/**
 * POST /auth/setup-admin
 * Public – creates the first Admin user ONLY when no Admin exists.
 * Rejects with 403 if any Admin is already present.
 */
export const setupAdmin = async (req: Request, res: Response): Promise<void> => {
  try {
    // Guard: only callable when no Admin exists
    const has = await adminExists();
    if (has) {
      res.status(403).json({
        success: false,
        message: 'Admin creation not allowed – an administrator account already exists.'
      });
      return;
    }

    const { email, password, firstName, lastName, phone } = req.body;

    if (!email || !password || !firstName || !lastName) {
      res.status(400).json({ success: false, message: 'Email, password, first name, and last name are required' });
      return;
    }

    if (password.length < 8) {
      res.status(400).json({ success: false, message: 'Password must be at least 8 characters' });
      return;
    }

    const emailLower = email.toLowerCase().trim();

    // Check duplicate
    const existing = await query('SELECT id FROM users WHERE email_lower = $1', [emailLower]);
    if (existing.rows.length > 0) {
      res.status(409).json({ success: false, message: 'Email already registered' });
      return;
    }

    // Get Admin role id
    const roleResult = await query("SELECT id FROM roles WHERE name = 'Admin' LIMIT 1");
    if (roleResult.rows.length === 0) {
      res.status(500).json({ success: false, message: 'Admin role not found – run migrations first' });
      return;
    }
    const adminRoleId = roleResult.rows[0].id;

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const result = await query(
      `INSERT INTO users (email, password_hash, first_name, last_name, role_id, phone, password_changed_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       RETURNING id, email, first_name, last_name, role_id, created_at`,
      [emailLower, passwordHash, firstName.trim(), lastName.trim(), adminRoleId, phone || null]
    );

    const user = result.rows[0];

    // Default preferences
    await query(
      `INSERT INTO user_preferences (user_id, language) VALUES ($1, 'en') ON CONFLICT DO NOTHING`,
      [user.id]
    );

    // Log the bootstrap event (entity_id = user.id, actor = user.id since no session yet)
    await logActivity(user.id, 'SETUP_ADMIN', 'user', user.id, req, {
      email: emailLower,
      role: 'Admin',
      note: 'First-admin bootstrap'
    });

    res.status(201).json({
      success: true,
      message: 'Admin account created successfully. You can now log in.',
      data: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
      }
    });
  } catch (error) {
    console.error('SetupAdmin error:', error);
    res.status(500).json({ success: false, message: 'Failed to create admin account' });
  }
};

// ─── LOGIN ───────────────────────────────────────────────────
export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, rememberMe = false } = req.body;

    if (!email || !password) {
      res.status(400).json({ success: false, message: 'Email and password are required' });
      return;
    }

    const emailLower = email.toLowerCase().trim();

    // Case-insensitive email lookup
    const result = await query(
      `SELECT u.*, r.name as role_name, r.permissions as role_permissions
       FROM users u
       LEFT JOIN roles r ON u.role_id = r.id
       WHERE u.email_lower = $1`,
      [emailLower]
    );

    if (result.rows.length === 0) {
      await logLoginAttempt(emailLower, 'user_not_found', req);
      // Generic message - don't reveal if email exists
      res.status(401).json({ success: false, message: 'Invalid email or password' });
      return;
    }

    const user = result.rows[0];

    // Check account lock
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      const minutesLeft = Math.ceil((new Date(user.locked_until).getTime() - Date.now()) / 60000);
      await logLoginAttempt(emailLower, 'account_locked', req, user.id);
      res.status(423).json({
        success: false,
        message: `Account temporarily locked due to multiple failed attempts. Try again in ${minutesLeft} minute(s).`,
        lockedUntil: user.locked_until
      });
      return;
    }

    // Check if active
    if (!user.is_active) {
      await logLoginAttempt(emailLower, 'account_inactive', req, user.id);
      res.status(401).json({ success: false, message: 'Account is inactive. Contact your administrator.' });
      return;
    }

    // Verify password
    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      // Increment failed attempts
      const newFailedAttempts = (user.failed_login_attempts || 0) + 1;
      let lockUntil = null;

      if (newFailedAttempts >= MAX_FAILED_ATTEMPTS) {
        lockUntil = new Date(Date.now() + LOCK_DURATION_MINUTES * 60 * 1000);
      }

      await query(
        `UPDATE users SET failed_login_attempts = $1, locked_until = $2 WHERE id = $3`,
        [newFailedAttempts, lockUntil, user.id]
      );

      await logLoginAttempt(emailLower, 'wrong_password', req, user.id);

      const remaining = MAX_FAILED_ATTEMPTS - newFailedAttempts;
      if (lockUntil) {
        res.status(401).json({
          success: false,
          message: `Account locked after ${MAX_FAILED_ATTEMPTS} failed attempts. Try again in ${LOCK_DURATION_MINUTES} minutes.`
        });
      } else {
        res.status(401).json({
          success: false,
          message: `Invalid email or password. ${remaining} attempt(s) remaining before lockout.`
        });
      }
      return;
    }

    // Success - reset failed attempts
    await query(
      `UPDATE users SET failed_login_attempts = 0, locked_until = NULL, last_login = NOW() WHERE id = $1`,
      [user.id]
    );

    // Create access token
    const accessToken = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role_name,
        roleId: user.role_id,
        firstName: user.first_name,
        lastName: user.last_name,
      },
      JWT_SECRET(),
      { expiresIn: rememberMe ? '7d' : ACCESS_TOKEN_EXPIRY }
    );

    // Create refresh token (for remember me)
    let refreshToken: string | null = null;
    if (rememberMe) {
      refreshToken = generateRefreshToken();
      const deviceFingerprint = getDeviceFingerprint(req);
      const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

      await query(
        `INSERT INTO user_sessions (user_id, refresh_token, ip_address, user_agent, device_fingerprint, is_trusted, expires_at)
         VALUES ($1, $2, $3, $4, $5, TRUE, $6)`,
        [user.id, refreshToken, req.ip, req.headers['user-agent'], deviceFingerprint, expiresAt]
      );
    }

    // Detect new device
    const deviceFingerprint = getDeviceFingerprint(req);
    const knownDevice = await query(
      `SELECT id FROM user_sessions WHERE user_id = $1 AND device_fingerprint = $2 AND is_trusted = TRUE LIMIT 1`,
      [user.id, deviceFingerprint]
    );

    if (knownDevice.rows.length === 0) {
      await logActivity(user.id, 'new_device_login', 'user', user.id, req, {
        device: req.headers['user-agent'],
        ip: req.ip
      });
    }

    await logLoginAttempt(emailLower, 'success', req, user.id);
    await logActivity(user.id, 'login', 'user', user.id, req, { rememberMe });

    // Get language preference
    const prefResult = await query(
      `SELECT language, timezone FROM user_preferences WHERE user_id = $1`,
      [user.id]
    );
    const preferences = prefResult.rows[0] || { language: 'en', timezone: 'UTC' };

    res.json({
      success: true,
      data: {
        token: accessToken,
        refreshToken,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          role: user.role_name,
          roleId: user.role_id,
          phone: user.phone,
          avatarUrl: user.avatar_url,
          preferences,
          lastLogin: user.last_login,
        },
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Login failed. Please try again.' });
  }
};

// ─── REFRESH TOKEN ───────────────────────────────────────────
export const refreshToken = async (req: Request, res: Response): Promise<void> => {
  try {
    const { refreshToken: token } = req.body;
    if (!token) {
      res.status(400).json({ success: false, message: 'Refresh token required' });
      return;
    }

    const session = await query(
      `SELECT s.*, u.email, u.first_name, u.last_name, u.is_active,
              r.name as role_name, r.id as role_id
       FROM user_sessions s
       JOIN users u ON s.user_id = u.id
       LEFT JOIN roles r ON u.role_id = r.id
       WHERE s.refresh_token = $1 AND s.revoked_at IS NULL AND s.expires_at > NOW()`,
      [token]
    );

    if (session.rows.length === 0) {
      res.status(401).json({ success: false, message: 'Invalid or expired refresh token' });
      return;
    }

    const s = session.rows[0];
    if (!s.is_active) {
      res.status(401).json({ success: false, message: 'Account is inactive' });
      return;
    }

    // Issue new access token
    const accessToken = jwt.sign(
      { id: s.user_id, email: s.email, role: s.role_name, roleId: s.role_id, firstName: s.first_name, lastName: s.last_name },
      JWT_SECRET(),
      { expiresIn: '24h' }
    );

    // Update last_used_at
    await query(`UPDATE user_sessions SET last_used_at = NOW() WHERE id = $1`, [s.id]);

    res.json({ success: true, data: { token: accessToken } });
  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(500).json({ success: false, message: 'Token refresh failed' });
  }
};

// ─── LOGOUT ──────────────────────────────────────────────────
export const logout = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { refreshToken: token } = req.body;
    if (token) {
      await query(`UPDATE user_sessions SET revoked_at = NOW() WHERE refresh_token = $1`, [token]);
    }
    if (req.user) {
      await logActivity(req.user.id, 'logout', 'user', req.user.id, req);
    }
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Logout failed' });
  }
};

// ─── FORGOT PASSWORD ─────────────────────────────────────────
export const forgotPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body;
    if (!email) {
      res.status(400).json({ success: false, message: 'Email is required' });
      return;
    }

    const emailLower = email.toLowerCase().trim();
    const userResult = await query('SELECT id, email, first_name FROM users WHERE email_lower = $1', [emailLower]);

    // Always return success to prevent email enumeration
    res.json({ success: true, message: 'If this email is registered, you will receive reset instructions.' });

    if (userResult.rows.length === 0) return;
    const user = userResult.rows[0];

    // Invalidate existing tokens
    await query(`UPDATE password_reset_tokens SET used_at = NOW() WHERE user_id = $1 AND used_at IS NULL`, [user.id]);

    // Create new token (expires in 1 hour)
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await query(
      `INSERT INTO password_reset_tokens (user_id, token, expires_at, ip_address) VALUES ($1, $2, $3, $4)`,
      [user.id, token, expiresAt, req.ip]
    );

    // In production: send email. For now, log the token.
    console.log(`[Password Reset] User: ${user.email}, Token: ${token}, Expires: ${expiresAt}`);
    await logActivity(user.id, 'forgot_password_requested', 'user', user.id, req);
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ success: false, message: 'Failed to process request' });
  }
};

// ─── RESET PASSWORD ──────────────────────────────────────────
export const resetPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      res.status(400).json({ success: false, message: 'Token and new password are required' });
      return;
    }

    if (newPassword.length < 8) {
      res.status(400).json({ success: false, message: 'Password must be at least 8 characters' });
      return;
    }

    const tokenResult = await query(
      `SELECT * FROM password_reset_tokens WHERE token = $1 AND used_at IS NULL AND expires_at > NOW()`,
      [token]
    );

    if (tokenResult.rows.length === 0) {
      res.status(400).json({ success: false, message: 'Invalid or expired reset token' });
      return;
    }

    const resetRecord = tokenResult.rows[0];
    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

    // Update password and reset lock
    await query(
      `UPDATE users SET password_hash = $1, failed_login_attempts = 0, locked_until = NULL,
       password_changed_at = NOW(), updated_at = NOW() WHERE id = $2`,
      [passwordHash, resetRecord.user_id]
    );

    // Invalidate reset token
    await query(`UPDATE password_reset_tokens SET used_at = NOW() WHERE id = $1`, [resetRecord.id]);

    // Revoke all active sessions
    await query(`UPDATE user_sessions SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL`, [resetRecord.user_id]);

    await logActivity(resetRecord.user_id, 'password_reset', 'user', resetRecord.user_id, req);

    res.json({ success: true, message: 'Password reset successfully. Please login with your new password.' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ success: false, message: 'Password reset failed' });
  }
};

// ─── GET ME ──────────────────────────────────────────────────
export const getMe = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await query(
      `SELECT u.id, u.email, u.first_name, u.last_name, u.phone, u.avatar_url,
              u.last_login, u.created_at, u.failed_login_attempts,
              r.name as role, r.id as role_id, r.permissions,
              p.language, p.timezone
       FROM users u
       LEFT JOIN roles r ON u.role_id = r.id
       LEFT JOIN user_preferences p ON p.user_id = u.id
       WHERE u.id = $1`,
      [req.user!.id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    const u = result.rows[0];
    res.json({
      success: true,
      data: {
        id: u.id, email: u.email,
        firstName: u.first_name, lastName: u.last_name,
        phone: u.phone, avatarUrl: u.avatar_url,
        role: u.role, roleId: u.role_id,
        permissions: u.permissions,
        lastLogin: u.last_login, createdAt: u.created_at,
        preferences: { language: u.language || 'en', timezone: u.timezone || 'UTC' }
      }
    });
  } catch (error) {
    console.error('GetMe error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch user' });
  }
};

// ─── ADMIN: GET ALL USERS ────────────────────────────────────
export const getUsers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { search, role, status, page = 1, limit = 50 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let whereClause = '1=1';
    const params: unknown[] = [];
    let paramIdx = 1;

    if (search) {
      whereClause += ` AND (u.first_name ILIKE $${paramIdx} OR u.last_name ILIKE $${paramIdx} OR u.email ILIKE $${paramIdx})`;
      params.push(`%${search}%`);
      paramIdx++;
    }
    if (role) {
      whereClause += ` AND r.name = $${paramIdx}`;
      params.push(role);
      paramIdx++;
    }
    if (status === 'active') {
      whereClause += ` AND u.is_active = TRUE`;
    } else if (status === 'inactive') {
      whereClause += ` AND u.is_active = FALSE`;
    } else if (status === 'locked') {
      whereClause += ` AND u.locked_until > NOW()`;
    }

    const countResult = await query(
      `SELECT COUNT(*) FROM users u LEFT JOIN roles r ON u.role_id = r.id WHERE ${whereClause}`,
      params
    );

    const result = await query(
      `SELECT u.id, u.email, u.first_name, u.last_name, u.phone, u.is_active,
              u.last_login, u.created_at, u.failed_login_attempts, u.locked_until,
              u.password_changed_at,
              r.name as role_name, r.id as role_id
       FROM users u
       LEFT JOIN roles r ON u.role_id = r.id
       WHERE ${whereClause}
       ORDER BY u.created_at DESC
       LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
      [...params, Number(limit), offset]
    );

    res.json({
      success: true,
      data: result.rows,
      total: parseInt(countResult.rows[0].count),
      page: Number(page),
      limit: Number(limit)
    });
  } catch (error) {
    console.error('GetUsers error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch users' });
  }
};

// ─── ADMIN: CREATE USER ──────────────────────────────────────
/**
 * Phase 9/10:
 * - Only an authenticated Admin may call this route (enforced by requireRole('Admin') in router).
 * - An Admin may create users with any role, including another Admin.
 * - Non-Admin attempts to create Admin role are rejected with 403.
 */
export const createUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { email, password, firstName, lastName, roleId, phone } = req.body;

    if (!email || !password || !firstName || !lastName || !roleId) {
      res.status(400).json({ success: false, message: 'Email, password, name, and role are required' });
      return;
    }

    if (password.length < 8) {
      res.status(400).json({ success: false, message: 'Password must be at least 8 characters' });
      return;
    }

    // Resolve the target role name
    const roleRow = await query('SELECT name FROM roles WHERE id = $1', [roleId]);
    if (roleRow.rows.length === 0) {
      res.status(400).json({ success: false, message: 'Invalid role ID' });
      return;
    }
    const targetRoleName: string = roleRow.rows[0].name;

    // Phase 10: Only an existing Admin can create another Admin
    // (This route is already Admin-only, so req.user.role === 'Admin' is guaranteed,
    //  but we keep the check for defence-in-depth and clarity.)
    if (targetRoleName === 'Admin' && req.user?.role !== 'Admin') {
      res.status(403).json({
        success: false,
        message: 'Admin creation not allowed'
      });
      return;
    }

    const emailLower = email.toLowerCase().trim();
    const existing = await query('SELECT id FROM users WHERE email_lower = $1', [emailLower]);
    if (existing.rows.length > 0) {
      res.status(409).json({ success: false, message: 'Email already registered' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const result = await query(
      `INSERT INTO users (email, password_hash, first_name, last_name, role_id, phone, password_changed_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       RETURNING id, email, first_name, last_name, role_id, is_active, created_at`,
      [emailLower, passwordHash, firstName.trim(), lastName.trim(), roleId, phone || null]
    );

    const user = result.rows[0];
    await query(`INSERT INTO user_preferences (user_id, language) VALUES ($1, 'en') ON CONFLICT DO NOTHING`, [user.id]);

    // Phase 10: enhanced activity log – CREATE_USER
    await logActivity(req.user!.id, 'CREATE_USER', 'user', user.id, req, {
      email: emailLower,
      role: targetRoleName,
      createdBy: req.user!.id
    });

    res.status(201).json({ success: true, data: user, message: 'User created successfully' });
  } catch (error) {
    console.error('CreateUser error:', error);
    res.status(500).json({ success: false, message: 'Failed to create user' });
  }
};

// ─── ADMIN: UPDATE USER ──────────────────────────────────────
export const updateUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { firstName, lastName, phone, roleId, isActive } = req.body;

    const existing = await query(
      `SELECT u.id, r.name as role_name FROM users u LEFT JOIN roles r ON u.role_id = r.id WHERE u.id = $1`,
      [id]
    );
    if (existing.rows.length === 0) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    // Phase 10: If the caller is changing the role, check Admin-creation restriction
    let targetRoleName = existing.rows[0].role_name;
    if (roleId) {
      const roleRow = await query('SELECT name FROM roles WHERE id = $1', [roleId]);
      if (roleRow.rows.length === 0) {
        res.status(400).json({ success: false, message: 'Invalid role ID' });
        return;
      }
      targetRoleName = roleRow.rows[0].name;

      if (targetRoleName === 'Admin' && req.user?.role !== 'Admin') {
        res.status(403).json({ success: false, message: 'Admin creation not allowed' });
        return;
      }
    }

    const result = await query(
      `UPDATE users SET first_name = $1, last_name = $2, phone = $3, role_id = $4, is_active = $5, updated_at = NOW()
       WHERE id = $6
       RETURNING id, email, first_name, last_name, phone, is_active, role_id, updated_at`,
      [firstName, lastName, phone, roleId, isActive !== undefined ? isActive : true, id]
    );

    // Phase 10: enhanced activity log – UPDATE_USER_ROLE if role changed
    const oldRole = existing.rows[0].role_name;
    if (roleId && targetRoleName !== oldRole) {
      await logActivity(req.user!.id, 'UPDATE_USER_ROLE', 'user', id, req, {
        email: result.rows[0].email,
        oldRole,
        newRole: targetRoleName,
        changedBy: req.user!.id
      });
    } else {
      await logActivity(req.user!.id, 'user_updated', 'user', id, req, { changes: req.body });
    }

    res.json({ success: true, data: result.rows[0], message: 'User updated successfully' });
  } catch (error) {
    console.error('UpdateUser error:', error);
    res.status(500).json({ success: false, message: 'Failed to update user' });
  }
};

// ─── ADMIN: DELETE USER ──────────────────────────────────────
export const deleteUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    // Prevent self-deletion
    if (id === req.user!.id) {
      res.status(400).json({ success: false, message: 'Cannot delete your own account' });
      return;
    }

    // Check if target is admin
    const targetUser = await query(
      `SELECT u.id, u.email, r.name as role_name FROM users u LEFT JOIN roles r ON u.role_id = r.id WHERE u.id = $1`,
      [id]
    );
    if (targetUser.rows.length === 0) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    // Prevent deleting last admin
    if (targetUser.rows[0].role_name === 'Admin') {
      const adminCount = await query(
        `SELECT count(*) FROM users u JOIN roles r ON u.role_id = r.id WHERE r.name = 'Admin' AND u.is_active = TRUE`
      );
      if (parseInt(adminCount.rows[0].count) <= 1) {
        res.status(400).json({ success: false, message: 'Cannot delete the last admin account' });
        return;
      }
    }

    // Soft delete (deactivate instead of hard delete)
    await query(`UPDATE users SET is_active = FALSE, updated_at = NOW() WHERE id = $1`, [id]);

    // Phase 10: enhanced activity log – DEACTIVATE_USER
    await logActivity(req.user!.id, 'DEACTIVATE_USER', 'user', id, req, {
      email: targetUser.rows[0].email,
      role: targetUser.rows[0].role_name,
      deactivatedBy: req.user!.id
    });

    res.json({ success: true, message: 'User deactivated successfully' });
  } catch (error) {
    console.error('DeleteUser error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete user' });
  }
};

// ─── ADMIN: UNLOCK USER ──────────────────────────────────────
export const unlockUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const targetUser = await query(
      `SELECT u.email, r.name as role_name FROM users u LEFT JOIN roles r ON u.role_id = r.id WHERE u.id = $1`,
      [id]
    );

    await query(
      `UPDATE users SET locked_until = NULL, failed_login_attempts = 0, updated_at = NOW() WHERE id = $1`,
      [id]
    );

    // Phase 10: enhanced activity log – UNLOCK_USER
    await logActivity(req.user!.id, 'UNLOCK_USER', 'user', id, req, {
      email: targetUser.rows[0]?.email,
      role: targetUser.rows[0]?.role_name,
      unlockedBy: req.user!.id
    });

    res.json({ success: true, message: 'User account unlocked successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to unlock user' });
  }
};

// ─── ADMIN: RESET USER PASSWORD ──────────────────────────────
export const adminResetPassword = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 8) {
      res.status(400).json({ success: false, message: 'Password must be at least 8 characters' });
      return;
    }

    const targetUser = await query(
      `SELECT u.email, r.name as role_name FROM users u LEFT JOIN roles r ON u.role_id = r.id WHERE u.id = $1`,
      [id]
    );

    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await query(
      `UPDATE users SET password_hash = $1, failed_login_attempts = 0, locked_until = NULL,
       password_changed_at = NOW(), updated_at = NOW() WHERE id = $2`,
      [passwordHash, id]
    );

    await query(`UPDATE user_sessions SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL`, [id]);

    // Phase 10: enhanced activity log – RESET_PASSWORD
    await logActivity(req.user!.id, 'RESET_PASSWORD', 'user', id, req, {
      email: targetUser.rows[0]?.email,
      role: targetUser.rows[0]?.role_name,
      resetBy: req.user!.id
    });

    res.json({ success: true, message: 'Password reset successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to reset password' });
  }
};

// ─── GET LOGIN AUDIT LOGS ────────────────────────────────────
export const getLoginAuditLogs = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { userId, result: filterResult, from, to, page = 1, limit = 50 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let whereClause = '1=1';
    const params: unknown[] = [];
    let paramIdx = 1;

    if (userId) {
      whereClause += ` AND la.user_id = $${paramIdx++}`;
      params.push(userId);
    }
    if (filterResult) {
      whereClause += ` AND la.result = $${paramIdx++}`;
      params.push(filterResult);
    }
    if (from) {
      whereClause += ` AND la.attempted_at >= $${paramIdx++}`;
      params.push(from);
    }
    if (to) {
      whereClause += ` AND la.attempted_at <= $${paramIdx++}`;
      params.push(to);
    }

    const countResult = await query(
      `SELECT COUNT(*) FROM login_attempts la WHERE ${whereClause}`, params
    );

    const logsResult = await query(
      `SELECT la.*, u.first_name, u.last_name
       FROM login_attempts la
       LEFT JOIN users u ON la.user_id = u.id
       WHERE ${whereClause}
       ORDER BY la.attempted_at DESC
       LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
      [...params, Number(limit), offset]
    );

    res.json({
      success: true,
      data: logsResult.rows,
      total: parseInt(countResult.rows[0].count),
      page: Number(page),
      limit: Number(limit)
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch audit logs' });
  }
};

// ─── GET ACTIVITY LOGS ───────────────────────────────────────
export const getActivityLogs = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { userId, action, from, to, page = 1, limit = 50 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let whereClause = '1=1';
    const params: unknown[] = [];
    let paramIdx = 1;

    if (userId) {
      whereClause += ` AND al.user_id = $${paramIdx++}`;
      params.push(userId);
    }
    if (action) {
      whereClause += ` AND al.action ILIKE $${paramIdx++}`;
      params.push(`%${action}%`);
    }
    if (from) {
      whereClause += ` AND al.created_at >= $${paramIdx++}`;
      params.push(from);
    }
    if (to) {
      whereClause += ` AND al.created_at <= $${paramIdx++}`;
      params.push(to);
    }

    const countResult = await query(
      `SELECT COUNT(*) FROM activity_logs al WHERE ${whereClause}`, params
    );

    const result = await query(
      `SELECT al.*, u.first_name, u.last_name, u.email
       FROM activity_logs al
       LEFT JOIN users u ON al.user_id = u.id
       WHERE ${whereClause}
       ORDER BY al.created_at DESC
       LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
      [...params, Number(limit), offset]
    );

    res.json({
      success: true,
      data: result.rows,
      total: parseInt(countResult.rows[0].count),
      page: Number(page),
      limit: Number(limit)
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch activity logs' });
  }
};

// ─── UPDATE LANGUAGE PREFERENCE ──────────────────────────────
export const updatePreferences = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { language, timezone } = req.body;
    await query(
      `INSERT INTO user_preferences (user_id, language, timezone, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (user_id) DO UPDATE SET language = $2, timezone = $3, updated_at = NOW()`,
      [req.user!.id, language || 'en', timezone || 'UTC']
    );
    res.json({ success: true, message: 'Preferences updated' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update preferences' });
  }
};

export const getRoles = async (_req: Request, res: Response): Promise<void> => {
  try {
    const result = await query('SELECT * FROM roles ORDER BY name');
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch roles' });
  }
};
