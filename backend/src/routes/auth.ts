import { Router } from 'express';
import {
  register,
  login,
  refreshToken,
  logout,
  getMe,
  getUsers,
  createUser,
  updateUser,
  deleteUser,
  unlockUser,
  adminResetPassword,
  getRoles,
  getLoginAuditLogs,
  getActivityLogs,
  forgotPassword,
  resetPassword,
  updatePreferences,
} from '../controllers/authController';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();

// ── Public Routes ─────────────────────────────────────────────
router.post('/register', register);
router.post('/login', login);
router.post('/refresh-token', refreshToken);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

// ── Protected: Any Authenticated User ────────────────────────
router.use(authenticate);
router.post('/logout', logout);
router.get('/me', getMe);
router.patch('/preferences', updatePreferences);
router.get('/roles', getRoles);

// ── Admin Only ────────────────────────────────────────────────
router.get('/users', requireRole('Admin'), getUsers);
router.post('/users', requireRole('Admin'), createUser);
router.put('/users/:id', requireRole('Admin'), updateUser);
router.delete('/users/:id', requireRole('Admin'), deleteUser);
router.patch('/users/:id/unlock', requireRole('Admin'), unlockUser);
router.patch('/users/:id/reset-password', requireRole('Admin'), adminResetPassword);

// ── Audit Logs (Admin) ────────────────────────────────────────
router.get('/audit/login', requireRole('Admin'), getLoginAuditLogs);
router.get('/audit/activity', requireRole('Admin'), getActivityLogs);

export default router;
