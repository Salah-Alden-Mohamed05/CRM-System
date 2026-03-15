import { Router } from 'express';
import {
  getOpportunities, getOpportunity, createOpportunity, updateOpportunity,
  updateStage, addActivity,
  getLeads, getLead, createLead, updateLead, deleteLead, convertLead,
  getSalesPersonalStats, getSalesActivityReport
} from '../controllers/salesController';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

router.use(authenticate);

// ─── Opportunities (legacy) ──────────────────────────────────────────────────
router.get('/opportunities', getOpportunities);
router.post('/opportunities', authorize('Admin', 'Sales'), createOpportunity);
router.get('/opportunities/:id', getOpportunity);
router.put('/opportunities/:id', authorize('Admin', 'Sales'), updateOpportunity);
router.patch('/opportunities/:id/stage', authorize('Admin', 'Sales'), updateStage);
router.post('/opportunities/:id/activities', authorize('Admin', 'Sales'), addActivity);

// ─── Leads ───────────────────────────────────────────────────────────────────
router.get('/leads', getLeads);
router.post('/leads', authorize('Admin', 'Sales'), createLead);
router.get('/leads/:id', getLead);
router.put('/leads/:id', authorize('Admin', 'Sales'), updateLead);
router.delete('/leads/:id', authorize('Admin'), deleteLead);
router.post('/leads/:id/convert', authorize('Admin', 'Sales'), convertLead);

// ─── Personal stats (sales rep dashboard) ────────────────────────────────────
router.get('/my-stats', getSalesPersonalStats);

// ─── Sales Activity Report ────────────────────────────────────────────────────
router.get('/activity-report', getSalesActivityReport);

export default router;
