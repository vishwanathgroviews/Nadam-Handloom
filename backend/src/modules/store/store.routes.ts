import { Router } from 'express';
import * as controller from './store.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { requireRoles } from '../../middleware/rbac.middleware';
import { validateBody } from '../../middleware/validate.middleware';
import { updateStorePhoneSchema } from './store.schema';

const router = Router();

// Public storefront contact information (used by Customer Web)
router.get('/contact', controller.getStoreContact);
router.get('/phone', controller.getStoreContact);
router.get('/settings', controller.getStoreContact);

// Admin management endpoints
router.put(
  '/settings',
  authenticate,
  requireRoles('ADMIN'),
  validateBody(updateStorePhoneSchema),
  controller.updateStoreSettings
);
router.patch(
  '/settings',
  authenticate,
  requireRoles('ADMIN'),
  validateBody(updateStorePhoneSchema),
  controller.updateStoreSettings
);

export default router;
