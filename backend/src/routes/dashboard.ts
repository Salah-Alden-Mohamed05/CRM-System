import { Router } from 'express';
import {
  getDashboardStats, getRevenueChart, getShipmentChart,
  getSalesFunnel, getCustomerProfitability, getKPIs,
  getSalesTeamPerformance
} from '../controllers/dashboardController';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/stats', getDashboardStats);
router.get('/revenue-chart', getRevenueChart);
router.get('/shipment-chart', getShipmentChart);
router.get('/sales-funnel', getSalesFunnel);
router.get('/customer-profitability', getCustomerProfitability);
router.get('/kpis', getKPIs);
router.get('/sales-team-performance', getSalesTeamPerformance);

export default router;
