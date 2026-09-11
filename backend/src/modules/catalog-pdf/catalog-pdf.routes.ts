import { Router } from 'express';
import * as controller from './catalog-pdf.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { requireRoles } from '../../middleware/rbac.middleware';
import { rateLimit } from '../../middleware/rateLimit.middleware';

const router = Router();

router.use(authenticate);
router.use(requireRoles('ADMIN', 'STAFF'));

router.get('/subcategories/:subcategoryId/catalog-pdf', controller.getStatus);

// Fetches every active product's photo and composes a PDF per call — real
// CPU + network cost, worth bounding even for trusted staff accounts.
router.post(
  '/subcategories/:subcategoryId/catalog-pdf',
  rateLimit('catalog-pdf-generate', { max: 10, windowSec: 60 }),
  controller.generate
);

export default router;
