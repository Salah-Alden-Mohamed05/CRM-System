import { Router } from 'express';
import {
  getCustomers, getCustomer, createCustomer, updateCustomer, deleteCustomer, createContact
} from '../controllers/customerController';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/', getCustomers);
router.post('/', authorize('Admin','Sales'), createCustomer);
router.get('/:id', getCustomer);
router.put('/:id', authorize('Admin','Sales'), updateCustomer);
router.delete('/:id', authorize('Admin'), deleteCustomer);
router.post('/:customerId/contacts', authorize('Admin','Sales'), createContact);

export default router;
