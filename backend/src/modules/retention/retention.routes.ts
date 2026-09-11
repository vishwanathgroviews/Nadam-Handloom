import { Router } from 'express';
import * as controller from './retention.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { requireRoles } from '../../middleware/rbac.middleware';
import { rateLimit } from '../../middleware/rateLimit.middleware';

const router = Router();

router.use(authenticate);
router.use(requireRoles('ADMIN'));

router.get('/preview', controller.getPurgePreview);
// Destructive and already runs automatically — a manual trigger is for
// ops/testing, not a routine action, so it's rate-limited tightly.
router.post('/purge', rateLimit('retention-purge', { max: 3, windowSec: 60 }), controller.runPurge);
router.get('/export-csv', controller.exportCsv);

export default router;
