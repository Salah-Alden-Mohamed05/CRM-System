import { Router } from 'express';
import { body } from 'express-validator';
import { register, login, getMe, getUsers, updateUser, getRoles } from '../controllers/authController';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validators';

const router = Router();

router.post('/register',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 8 }),
    body('firstName').notEmpty().trim(),
    body('lastName').notEmpty().trim(),
  ],
  validate,
  register
);

router.post('/login',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty(),
  ],
  validate,
  login
);

router.get('/me', authenticate, getMe);
router.get('/users', authenticate, authorize('Admin'), getUsers);
router.put('/users/:id', authenticate, authorize('Admin'), updateUser);
router.get('/roles', authenticate, getRoles);

export default router;
