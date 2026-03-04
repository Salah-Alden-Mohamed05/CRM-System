import { Router } from 'express';
import {
  getTasks,
  getTaskStats,
  createTask,
  updateTask,
  completeTask,
  deleteTask,
} from '../controllers/tasksController';
import { authenticate } from '../middleware/auth';

const router = Router();

// All task routes require authentication
router.use(authenticate);

// GET  /tasks         → list tasks (own only, or all for Admin)
// GET  /tasks/stats   → task statistics
// POST /tasks         → create a task
router.get('/stats', getTaskStats);
router.get('/', getTasks);
router.post('/', createTask);

// PUT    /tasks/:id          → update a task
// PATCH  /tasks/:id/complete → mark as complete
// DELETE /tasks/:id          → delete a task
router.put('/:id', updateTask);
router.patch('/:id/complete', completeTask);
router.delete('/:id', deleteTask);

export default router;
