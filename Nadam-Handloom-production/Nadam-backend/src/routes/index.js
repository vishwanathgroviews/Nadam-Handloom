// Everything lives under /api/v2, so the old backend (/api/v1) can run beside it
// on the same domain during the switch-over.
import { Router } from 'express';
import authRoutes from './auth.routes.js';
import meRoutes from './me.routes.js';
import teamRoutes from './team.routes.js';
import catalogRoutes from './catalog.routes.js';
import { productRoutes, tagRoutes } from './product.routes.js';
import saleRoutes from './sale.routes.js';
import invoiceRoutes from './invoice.routes.js';
import orderRoutes from './order.routes.js';
import homeRoutes from './home.routes.js';
import analyticsRoutes from './analytics.routes.js';
import activityRoutes from './activity.routes.js';
import settingsRoutes, { appStatus } from './settings.routes.js';
import shopRoutes from './shop/index.js';
import paymentsRoutes from './payments.routes.js';
import { health } from '../controllers/health.controller.js';

const r = Router();
r.get('/health', health);
r.get('/app-status', appStatus); // Module 11: maintenance and updates, before sign-in
r.use('/auth', authRoutes);
r.use('/me', meRoutes);
r.use('/team', teamRoutes);
r.use('/catalog', catalogRoutes);
r.use('/products', productRoutes);
r.use('/tags', tagRoutes);
r.use('/sales', saleRoutes);
r.use('/invoices', invoiceRoutes);
r.use('/orders', orderRoutes);
r.use('/home', homeRoutes);
r.use('/analytics', analyticsRoutes);
r.use('/activity', activityRoutes);
r.use('/settings', settingsRoutes);
r.use('/payments', paymentsRoutes); // Online payments (owners)
// The new website (W1 onwards): customers only.
r.use('/shop', shopRoutes);

export default r;
