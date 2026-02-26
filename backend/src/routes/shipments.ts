import { Router } from 'express';
import {
  getShipments, getShipment, createShipment, updateShipmentStatus, updateMilestone
} from '../controllers/shipmentController';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/', getShipments);
router.post('/', authorize('Admin','Operations'), createShipment);
router.get('/:id', getShipment);
router.patch('/:id/status', authorize('Admin','Operations'), updateShipmentStatus);
router.patch('/:id/milestones/:milestoneId', authorize('Admin','Operations'), updateMilestone);

export default router;
