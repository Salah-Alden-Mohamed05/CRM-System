import { Router } from 'express';
import { Response } from 'express';
import { authenticate } from '../middleware/auth';
import { AuthRequest } from '../middleware/auth';
import {
  predictShipmentDelay,
  scoreCustomerRisk,
  forecastRevenue,
  scoreDeal,
  generateInsights,
} from '../services/aiService';

const router = Router();

router.use(authenticate);

// AI Insights for dashboard
router.get('/insights', async (req: AuthRequest, res: Response) => {
  try {
    const insights = await generateInsights();
    res.json({ success: true, data: insights });
  } catch (error) {
    console.error('AI insights error:', error);
    res.status(500).json({ success: false, message: 'Failed to generate insights' });
  }
});

// Shipment delay prediction
router.get('/predict/shipment/:id', async (req: AuthRequest, res: Response) => {
  try {
    const prediction = await predictShipmentDelay(req.params.id);
    res.json({ success: true, data: prediction });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to predict shipment delay' });
  }
});

// Customer risk scoring
router.get('/risk/customer/:id', async (req: AuthRequest, res: Response) => {
  try {
    const risk = await scoreCustomerRisk(req.params.id);
    res.json({ success: true, data: risk });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to score customer risk' });
  }
});

// Revenue forecast
router.get('/forecast/revenue', async (req: AuthRequest, res: Response) => {
  try {
    const forecast = await forecastRevenue();
    res.json({ success: true, data: forecast });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to forecast revenue' });
  }
});

// Deal scoring
router.get('/score/deal/:id', async (req: AuthRequest, res: Response) => {
  try {
    const score = await scoreDeal(req.params.id);
    res.json({ success: true, data: score });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to score deal' });
  }
});

export default router;
