import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../db/pool';
import { AuthRequest } from '../middleware/auth';

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, firstName, lastName, roleId, phone } = req.body;

    const existing = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      res.status(409).json({ success: false, message: 'Email already registered' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const result = await query(
      `INSERT INTO users (email, password_hash, first_name, last_name, role_id, phone)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, email, first_name, last_name, role_id, created_at`,
      [email, passwordHash, firstName, lastName, roleId, phone]
    );

    const user = result.rows[0];
    await query(
      `INSERT INTO activity_logs (user_id, action, entity_type, entity_id) VALUES ($1,'user_registered','user',$2)`,
      [user.id, user.id]
    );

    res.status(201).json({ success: true, message: 'User registered successfully', data: user });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ success: false, message: 'Registration failed' });
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    const result = await query(
      `SELECT u.*, r.name as role_name FROM users u LEFT JOIN roles r ON u.role_id = r.id WHERE u.email = $1`,
      [email]
    );

    if (result.rows.length === 0) {
      res.status(401).json({ success: false, message: 'Invalid email or password' });
      return;
    }

    const user = result.rows[0];
    if (!user.is_active) {
      res.status(401).json({ success: false, message: 'Account is inactive' });
      return;
    }

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      res.status(401).json({ success: false, message: 'Invalid email or password' });
      return;
    }

    const jwtSecret = process.env.JWT_SECRET || 'secret';
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role_name,
        roleId: user.role_id,
        firstName: user.first_name,
        lastName: user.last_name,
      },
      jwtSecret,
      { expiresIn: '24h' }
    );

    await query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);
    await query(
      `INSERT INTO activity_logs (user_id, action, entity_type, entity_id, ip_address) VALUES ($1,'login','user',$2,$3)`,
      [user.id, user.id, req.ip]
    );

    res.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          role: user.role_name,
          roleId: user.role_id,
          phone: user.phone,
          avatarUrl: user.avatar_url,
        },
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Login failed' });
  }
};

export const getMe = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await query(
      `SELECT u.id, u.email, u.first_name, u.last_name, u.phone, u.avatar_url, u.last_login, u.created_at,
              r.name as role, r.id as role_id, r.permissions
       FROM users u LEFT JOIN roles r ON u.role_id = r.id WHERE u.id = $1`,
      [req.user!.id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('GetMe error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch user' });
  }
};

export const getUsers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await query(
      `SELECT u.id, u.email, u.first_name, u.last_name, u.phone, u.is_active, u.last_login, u.created_at,
              r.name as role, r.id as role_id
       FROM users u LEFT JOIN roles r ON u.role_id = r.id
       ORDER BY u.created_at DESC`
    );
    res.json({ success: true, data: result.rows, total: result.rowCount });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch users' });
  }
};

export const updateUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { firstName, lastName, phone, roleId, isActive } = req.body;

    const result = await query(
      `UPDATE users SET first_name=$1, last_name=$2, phone=$3, role_id=$4, is_active=$5, updated_at=NOW()
       WHERE id=$6 RETURNING id, email, first_name, last_name, phone, is_active, role_id`,
      [firstName, lastName, phone, roleId, isActive, id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update user' });
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
