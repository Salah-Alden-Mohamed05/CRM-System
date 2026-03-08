import { Router } from 'express';
import {
  getDeals, getDeal, createDeal, updateDeal, updateDealStage,
  deleteDeal, addDealActivity, getDealActivities, getDealsPipeline
} from '../controllers/dealsController';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();
router.use(authenticate);

// Pipeline summary
router.get('/pipeline', getDealsPipeline);

// CRUD
router.get('/', getDeals);
router.post('/', authorize('Admin', 'Sales'), createDeal);
router.get('/:id', getDeal);
router.put('/:id', authorize('Admin', 'Sales'), updateDeal);
router.patch('/:id/stage', authorize('Admin', 'Sales', 'Operations', 'Finance'), updateDealStage);
router.delete('/:id', authorize('Admin'), deleteDeal);

// Activities
router.get('/:id/activities', getDealActivities);
router.post('/:id/activities', authorize('Admin', 'Sales', 'Operations', 'Finance'), addDealActivity);

export default router;
