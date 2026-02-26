import { Router } from 'express';
import {
  getInvoices, getInvoice, createInvoice, recordPayment, getCosts, addCost
} from '../controllers/financeController';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/invoices', getInvoices);
router.post('/invoices', authorize('Admin','Finance'), createInvoice);
router.get('/invoices/:id', getInvoice);
router.post('/payments', authorize('Admin','Finance'), recordPayment);
router.get('/shipments/:shipmentId/costs', getCosts);
router.post('/shipments/:shipmentId/costs', authorize('Admin','Finance','Operations'), addCost);

export default router;
