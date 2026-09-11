import { Router } from 'express';
import { UserController } from './user.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { requireRoles } from '../../middleware/rbac.middleware';
import { validateBody } from '../../middleware/validate.middleware';
import { updateProfileSchema } from './user.schema';

const router = Router();
const userController = new UserController();

router.use(authenticate);

router.get('/profile', userController.getProfile);
router.put('/profile', validateBody(updateProfileSchema), userController.updateProfile);
router.get('/me', requireRoles('ADMIN', 'STAFF'), userController.getMe);

export default router;
