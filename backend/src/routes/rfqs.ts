import { Router } from 'express';
import { getRFQs, getRFQ, createRFQ, updateRFQ } from '../controllers/rfqController';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/', getRFQs);
router.post('/', authorize('Admin', 'Sales'), createRFQ);
router.get('/:id', getRFQ);
router.put('/:id', authorize('Admin', 'Sales', 'Operations', 'Finance'), updateRFQ);

export default router;
