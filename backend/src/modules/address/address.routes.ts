import { Router } from 'express';
import * as controller from './address.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { validateBody } from '../../middleware/validate.middleware';
import { addressSchema, updateAddressSchema } from './address.schema';

const router = Router();

router.use(authenticate);

router.get('/', controller.list);
router.post('/', validateBody(addressSchema), controller.create);
router.patch('/:id', validateBody(updateAddressSchema), controller.update);
router.delete('/:id', controller.remove);

export default router;
