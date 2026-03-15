import { Router } from 'express';
import { getLeads, getLead, createLead, updateLead, deleteLead, convertLead } from '../controllers/leadsController';
import { authenticate } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/', getLeads);
router.post('/', createLead);
router.get('/:id', getLead);
router.put('/:id', updateLead);
router.post('/:id/convert', convertLead);
router.delete('/:id', deleteLead);

export default router;
