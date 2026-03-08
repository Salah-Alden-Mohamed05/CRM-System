import { Router } from 'express';
import {
  getQuotations, getQuotation, createQuotation, updateQuotation, deleteQuotation
} from '../controllers/quotationController';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/', getQuotations);
router.post('/', authorize('Admin', 'Finance', 'Operations'), createQuotation);
router.get('/:id', getQuotation);
router.put('/:id', authorize('Admin', 'Finance', 'Operations'), updateQuotation);
router.delete('/:id', authorize('Admin'), deleteQuotation);

export default router;
