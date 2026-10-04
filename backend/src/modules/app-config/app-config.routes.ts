import { Router } from 'express';
import * as controller from './app-config.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { requireRoles } from '../../middleware/rbac.middleware';
import { validateBody } from '../../middleware/validate.middleware';
import { updateAppConfigSchema } from './app-config.schema';

const router = Router();

// Public on purpose: the staff app reads it before anyone has signed in (an
// out-of-date build must be told to update before it tries to log in), and so
// does the storefront.
router.get('/', controller.getAppConfig);

// Owner-only — these switches can lock the whole shop out of the app.
router.put('/', authenticate, requireRoles('ADMIN'), validateBody(updateAppConfigSchema), controller.updateAppConfig);

export default router;
