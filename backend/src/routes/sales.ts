import { Router } from 'express';
import {
  getOpportunities, getOpportunity, createOpportunity, updateOpportunity,
  updateStage, addActivity, getLeads, createLead
} from '../controllers/salesController';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/opportunities', getOpportunities);
router.post('/opportunities', authorize('Admin','Sales'), createOpportunity);
router.get('/opportunities/:id', getOpportunity);
router.put('/opportunities/:id', authorize('Admin','Sales'), updateOpportunity);
router.patch('/opportunities/:id/stage', authorize('Admin','Sales'), updateStage);
router.post('/opportunities/:id/activities', authorize('Admin','Sales'), addActivity);

router.get('/leads', getLeads);
router.post('/leads', authorize('Admin','Sales'), createLead);

export default router;
