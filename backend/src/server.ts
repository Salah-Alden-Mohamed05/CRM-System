import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

import authRoutes from './routes/auth';
import customerRoutes from './routes/customers';
import salesRoutes from './routes/sales';
import leadImportRoutes from './routes/leadImport';
import dealsRoutes from './routes/deals';
import rfqsRoutes from './routes/rfqs';
import quotationsRoutes from './routes/quotations';
import documentsRoutes from './routes/documents';
import shipmentRoutes from './routes/shipments';
import ticketRoutes from './routes/tickets';
import financeRoutes from './routes/finance';
import dashboardRoutes from './routes/dashboard';
import aiRoutes from './routes/ai';
import tasksRoutes from './routes/tasks';
import leadsRoutes from './routes/leads';
import { errorHandler, notFound } from './middleware/validators';
import path from 'path';
import fs from 'fs';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: false,
}));

// CORS – allow localhost dev + sandbox public URLs
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  process.env.CORS_ORIGIN,
].filter(Boolean) as string[];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, server-to-server)
    if (!origin) return callback(null, true);
    // Allow any sandbox.novita.ai subdomain
    if (origin.includes('.sandbox.novita.ai')) return callback(null, true);
    // Allow explicitly listed origins
    if (allowedOrigins.includes(origin)) return callback(null, true);
    callback(null, true); // permissive for single-company internal use
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500,
  message: { success: false, message: 'Too many requests, please try again later.' },
});
app.use(limiter);

// Body parsing & compression
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(compression());

// Logging
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('combined'));
}

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), version: '1.0.0' });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/deals', dealsRoutes);
app.use('/api/rfqs', rfqsRoutes);
app.use('/api/quotations', quotationsRoutes);
app.use('/api/documents', documentsRoutes);
app.use('/api/shipments', shipmentRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/finance', financeRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/tasks', tasksRoutes);
app.use('/api/leads', leadsRoutes);
app.use('/api/admin/leads', leadImportRoutes);

// Serve uploaded files
const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
app.use('/uploads', express.static(uploadsDir));

// Error handling
app.use(notFound);
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`🚀 Logistics CRM API running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 Health: http://localhost:${PORT}/health`);
});

export default app;
