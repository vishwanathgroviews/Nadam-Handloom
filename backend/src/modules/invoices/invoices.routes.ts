import { Router } from 'express';
import * as controller from './invoices.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { requireRoles } from '../../middleware/rbac.middleware';
import { validateBody, validateQuery } from '../../middleware/validate.middleware';
import { rateLimit } from '../../middleware/rateLimit.middleware';
import { listInvoicesQuerySchema, salesReportSchema } from './invoices.schema';

const router = Router();

router.use(authenticate);
router.use(requireRoles('ADMIN', 'STAFF'));

router.get('/', validateQuery(listInvoicesQuerySchema), controller.list);
router.get('/:id', controller.getById);

// Aggregates every order in range and composes a PDF per call — real CPU
// cost, worth bounding even for trusted staff accounts.
router.post('/report', rateLimit('invoices-report', { max: 10, windowSec: 60 }), validateBody(salesReportSchema), controller.report);

export default router;
