// The Express application: security headers, JSON body, request context,
// routes, then 404 and error handling. No listening here (see server.js),
// so tests can use the app directly.
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env.js';
import { storage } from './services/storage/index.js';
import routes from './routes/index.js';
import { requestContext } from './middlewares/requestContext.js';
import { notFound, errorHandler } from './middlewares/errorHandler.js';
import { razorpayWebhook, fakePay } from './controllers/payments.controller.js';

export function createApp() {
  const app = express();
  app.set('trust proxy', env.TRUST_PROXY);
  app.disable('x-powered-by');
  app.use(helmet());
  // Website W6: Razorpay's notices, read as raw bytes (their signature covers the exact body).
  // Before the JSON reader, outside /shop (the website switch must never block a payment).
  app.post('/api/v2/payments/razorpay/webhook', express.raw({ type: () => true, limit: '256kb' }), razorpayWebhook);
  app.use(express.json({ limit: '50kb' }));
  app.use(requestContext);
  // The website's browser tests "pay" through this when payments use the stand-in (never live).
  if (env.payments.provider === 'fake' && !env.isProduction) app.post('/api/v2/payments/fake/pay', fakePay);
  // Logs method, path, status and time only: never bodies (they carry PINs and codes).
  if (env.LOG_REQUESTS === 'true' && !env.isTest) app.use(morgan(':method :url :status :response-time ms'));
  app.use('/api/v2', routes);
  // Photos and PDFs stored in the local folder (development); production uses S3 addresses.
  // Cross-origin: the website (another address during development) shows profile pictures.
  if (env.STORAGE_PROVIDER === 'local') {
    app.use('/uploads', express.static(storage().root, {
      maxAge: '7d', immutable: true, index: false, dotfiles: 'deny',
      setHeaders: (res) => res.set('Cross-Origin-Resource-Policy', 'cross-origin'),
    }));
  }
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
