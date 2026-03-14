import { Router } from 'express';
import {
  getQuotations, getQuotation, createQuotation, updateQuotation, deleteQuotation,
  getQuotationPDFData, sendQuotationEmail, duplicateQuotation,
  getQuotationEmails, expireQuotations
} from '../controllers/quotationController';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/', getQuotations);
router.post('/', authorize('Admin', 'Finance', 'Operations', 'Sales'), createQuotation);
router.get('/expire', authorize('Admin', 'Finance', 'Operations'), expireQuotations);
router.get('/:id/pdf', getQuotationPDFData);
router.get('/:id/emails', getQuotationEmails);
router.post('/:id/send-email', authorize('Admin', 'Finance', 'Operations', 'Sales'), sendQuotationEmail);
router.post('/:id/duplicate', authorize('Admin', 'Finance', 'Operations', 'Sales'), duplicateQuotation);
router.get('/:id', getQuotation);
router.put('/:id', authorize('Admin', 'Finance', 'Operations', 'Sales'), updateQuotation);
router.delete('/:id', authorize('Admin', 'Finance', 'Operations'), deleteQuotation);

export default router;
