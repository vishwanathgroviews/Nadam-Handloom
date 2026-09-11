import { Router } from 'express';
import * as controller from './inventory.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { requireRoles } from '../../middleware/rbac.middleware';
import { validateBody, validateQuery } from '../../middleware/validate.middleware';
import { scanLookupSchema, scanSellSchema, receivePiecesSchema, ledgerQuerySchema } from './inventory.schema';

const router = Router();

router.use(authenticate);
router.use(requireRoles('ADMIN', 'STAFF'));

router.post('/scan-lookup', validateBody(scanLookupSchema), controller.scanLookup);
router.post('/scan-sell', validateBody(scanSellSchema), controller.scanSell);
router.post('/products/:productId/pieces', validateBody(receivePiecesSchema), controller.receivePieces);
router.get('/products/:productId/pieces', controller.listPieces);
router.get('/ledger', validateQuery(ledgerQuerySchema), controller.getLedger);
router.get('/low-stock', controller.getLowStock);

export default router;
