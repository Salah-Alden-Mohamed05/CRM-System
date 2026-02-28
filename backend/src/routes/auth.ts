import { Router } from 'express';
import {
  setupStatus,
  setupAdmin,
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

// ── Bootstrap (Public, no auth required) ─────────────────────
// GET  /auth/setup-status  → { needsSetup: boolean }
router.get('/setup-status', setupStatus);
// POST /auth/setup-admin   → create first Admin user (only when needsSetup=true)
router.post('/setup-admin', setupAdmin);

// ── Public Routes ─────────────────────────────────────────────
// NOTE: /register has been REMOVED – user creation is Admin-only via POST /auth/users
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
// POST /auth/users is Admin-only; non-admin attempts to assign Admin role are blocked in controller
router.post('/users', requireRole('Admin'), createUser);
router.put('/users/:id', requireRole('Admin'), updateUser);
router.delete('/users/:id', requireRole('Admin'), deleteUser);
router.patch('/users/:id/unlock', requireRole('Admin'), unlockUser);
router.patch('/users/:id/reset-password', requireRole('Admin'), adminResetPassword);

// ── Audit Logs (Admin) ────────────────────────────────────────
router.get('/audit/login', requireRole('Admin'), getLoginAuditLogs);
router.get('/audit/activity', requireRole('Admin'), getActivityLogs);

export default router;
