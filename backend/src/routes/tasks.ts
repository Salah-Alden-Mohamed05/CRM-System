import { Router } from 'express';
import {
  getTasks, getTask, getTaskStats, createTask, updateTask, completeTask, deleteTask,
  getChecklist, addChecklistItem, toggleChecklistItem, deleteChecklistItem
} from '../controllers/tasksController';
import { authenticate } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/stats', getTaskStats);
router.get('/', getTasks);
router.post('/', createTask);
router.get('/:id', getTask);
router.put('/:id', updateTask);
router.patch('/:id/complete', completeTask);
router.delete('/:id', deleteTask);

// Checklist
router.get('/:id/checklist', getChecklist);
router.post('/:id/checklist', addChecklistItem);
router.patch('/:taskId/checklist/:itemId', toggleChecklistItem);
router.delete('/:taskId/checklist/:itemId', deleteChecklistItem);

export default router;
