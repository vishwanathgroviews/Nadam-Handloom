import { Router } from 'express';
import customerAuthRoutes from './customer-auth.routes';
import appAuthRoutes from './app-auth.routes';
import * as commonController from './common-auth.controller';
import { rateLimit } from '../../middleware/rateLimit.middleware';

const router = Router();

router.use('/customer', customerAuthRoutes);
router.use('/app', appAuthRoutes);

router.post('/refresh', rateLimit('auth-refresh', { max: 10, windowSec: 60 }), commonController.refresh);
router.post('/logout', commonController.logout);

export default router;
