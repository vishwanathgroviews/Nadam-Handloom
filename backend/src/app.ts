import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';

import { env } from './config/env';
import authRoutes from './modules/auth/auth.routes';
import userRoutes from './modules/user/user.routes';
import adminRoutes from './modules/admin/admin.routes';
import catalogRoutes from './modules/catalog/catalog.routes';
import catalogAdminRoutes from './modules/catalog/catalog.admin.routes';
import catalogPdfRoutes from './modules/catalog-pdf/catalog-pdf.routes';
import analyticsRoutes from './modules/analytics/analytics.routes';
import inventoryRoutes from './modules/inventory/inventory.routes';
import notificationsRoutes from './modules/notifications/notifications.routes';
import retentionRoutes from './modules/retention/retention.routes';
import addressRoutes from './modules/address/address.routes';
import ordersRoutes from './modules/orders/orders.routes';
import webhookRoutes from './modules/webhooks/webhooks.routes';
import invoicesRoutes from './modules/invoices/invoices.routes';
import billingRoutes from './modules/billing/billing.routes';
import { errorHandler } from './middleware/error.middleware';

const app = express();

app.set('trust proxy', 1);

// Middleware
app.use(helmet());
// FRONTEND_URL plus any extra dev/LAN origins from CORS_ALLOWED_ORIGINS (see
// env.ts) — a function origin lets both be honored without changing
// FRONTEND_URL's single-URL shape that other code (fetchImageBuffer) relies on.
const allowedOrigins = [
  env.FRONTEND_URL,
  ...(env.CORS_ALLOWED_ORIGINS ? env.CORS_ALLOWED_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean) : []),
];
app.use(cors({
  origin(origin, callback) {
    // No Origin header means a non-browser client (native app, curl,
    // server-to-server) — CORS doesn't apply, let it through.
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));
app.use(morgan('dev'));
app.use(
  express.json({
    // Explicit rather than relying on Express's implicit 100kb default —
    // generous enough for the largest legitimate payload (a 200-item label
    // print job) while still bounding request size. Product images and
    // label PDFs go through multer/binary responses, not this parser.
    limit: '256kb',
    // Captures the exact raw bytes alongside the parsed body — webhook
    // signature verification needs to HMAC the bytes as sent, and
    // re-stringifying the parsed JSON is not guaranteed to reproduce them.
    verify: (req, _res, buf) => {
      (req as express.Request).rawBody = buf;
    },
  })
);
app.use(express.urlencoded({ extended: true, limit: '256kb' }));
app.use(cookieParser());

// Routes
app.use('/api/v1/webhooks', webhookRoutes);
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/user', userRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/admin', catalogAdminRoutes);
app.use('/api/v1/admin', catalogPdfRoutes);
app.use('/api/v1/admin/analytics', analyticsRoutes);
app.use('/api/v1/admin/inventory', inventoryRoutes);
app.use('/api/v1/admin/notifications', notificationsRoutes);
app.use('/api/v1/admin/retention', retentionRoutes);
app.use('/api/v1/admin/invoices', invoicesRoutes);
app.use('/api/v1/admin/billing', billingRoutes);
app.use('/api/v1/catalog', catalogRoutes);
app.use('/api/v1/addresses', addressRoutes);
app.use('/api/v1/orders', ordersRoutes);

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date() });
});

// Error handling
app.use(errorHandler);

export default app;
