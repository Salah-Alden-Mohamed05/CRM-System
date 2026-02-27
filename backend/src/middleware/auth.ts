import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { query } from '../db/pool';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    roleId: string;
    firstName: string;
    lastName: string;
  };
}

const JWT_SECRET = () => process.env.JWT_SECRET || 'logistics_crm_super_secret_jwt_key_2024';

export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ success: false, message: 'No token provided' });
      return;
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET()) as {
      id: string; email: string; role: string; roleId: string;
      firstName: string; lastName: string;
    };

    // Verify user still exists, is active, and check for account lock
    const result = await query(
      `SELECT u.id, u.email, u.is_active, u.locked_until, r.name as role
       FROM users u LEFT JOIN roles r ON u.role_id = r.id WHERE u.id = $1`,
      [decoded.id]
    );

    if (result.rows.length === 0) {
      res.status(401).json({ success: false, message: 'User not found' });
      return;
    }

    const dbUser = result.rows[0];
    if (!dbUser.is_active) {
      res.status(401).json({ success: false, message: 'Account is inactive' });
      return;
    }

    req.user = { ...decoded, role: dbUser.role }; // Always use DB role (not stale token role)
    next();
  } catch (err) {
    const msg = err instanceof jwt.TokenExpiredError ? 'Token expired' : 'Invalid token';
    res.status(401).json({ success: false, message: msg });
  }
};

// Alias for clarity
export const requireAuth = authenticate;

// Role-based authorization
export const authorize = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        message: `Access denied. Required role: ${roles.join(' or ')}. Your role: ${req.user.role}`
      });
      return;
    }
    next();
  };
};

// Convenience: requireRole('Admin') — same as authorize('Admin')
export const requireRole = (...roles: string[]) => authorize(...roles);
