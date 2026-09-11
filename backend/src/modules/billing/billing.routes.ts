import { Router } from 'express';
import * as controller from './billing.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { requireRoles } from '../../middleware/rbac.middleware';
import { validateBody } from '../../middleware/validate.middleware';
import { rateLimit } from '../../middleware/rateLimit.middleware';
import { completeSaleSchema } from './billing.schema';

const router = Router();

router.use(authenticate);
router.use(requireRoles('ADMIN', 'STAFF'));

router.post(
  '/complete-sale',
  rateLimit('billing-complete-sale', { max: 20, windowSec: 60 }),
  validateBody(completeSaleSchema),
  controller.completeSale
);

export default router;
