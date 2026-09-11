import { Router } from 'express';
import * as controller from './notifications.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { requireRoles } from '../../middleware/rbac.middleware';
import { validateBody } from '../../middleware/validate.middleware';
import { registerDeviceSchema, unregisterDeviceSchema } from './notifications.schema';

const router = Router();

router.use(authenticate);
router.use(requireRoles('ADMIN', 'STAFF'));

router.post('/devices', validateBody(registerDeviceSchema), controller.registerDevice);
router.delete('/devices', validateBody(unregisterDeviceSchema), controller.unregisterDevice);

export default router;
