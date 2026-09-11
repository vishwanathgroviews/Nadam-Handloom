import { Router } from 'express';
import * as controller from './analytics.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { requireRoles } from '../../middleware/rbac.middleware';
import { validateQuery } from '../../middleware/validate.middleware';
import { analyticsQuerySchema } from './analytics.schema';

const router = Router();

router.use(authenticate);
// Admin-only — deliberately stricter than /admin/dashboard (ADMIN+STAFF),
// which stays a today-only snapshot shared with staff. Full revenue
// history/trends/rankings are an owner-level view.
router.use(requireRoles('ADMIN'));

router.get('/summary', validateQuery(analyticsQuerySchema), controller.getSummary);
router.get('/top-subcategories', validateQuery(analyticsQuerySchema), controller.getTopSubcategories);

export default router;
