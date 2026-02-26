import { Router } from 'express';
import { getTickets, getTicket, createTicket, updateTicket, addComment } from '../controllers/ticketController';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/', getTickets);
router.post('/', createTicket);
router.get('/:id', getTicket);
router.patch('/:id', authorize('Admin','Support','Operations'), updateTicket);
router.post('/:id/comments', addComment);

export default router;
