import { Router } from 'express';
import multer from 'multer';
import {
  importLeads, getImportBatches, getLeadPoolStats,
  distributeLeads, getDistributionHistory, downloadTemplate,
  getAssignedLeads, reassignLeads,
} from '../controllers/leadImportController';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['.xlsx', '.xls', '.csv'];
    const ext = '.' + file.originalname.split('.').pop()?.toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only Excel and CSV files are allowed'));
    }
  },
});

router.use(authenticate);
router.use(authorize('Admin'));

// Import
router.post('/import', upload.single('file'), importLeads);
router.get('/import/template', downloadTemplate);
router.get('/import/batches', getImportBatches);

// Pool & Distribution
router.get('/pool', getLeadPoolStats);
router.post('/distribute', distributeLeads);
router.get('/distribution/history', getDistributionHistory);

// Assigned leads management
router.get('/assigned', getAssignedLeads);
router.post('/reassign', reassignLeads);

export default router;
