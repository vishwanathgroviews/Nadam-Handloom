import { Router } from 'express';
import * as controller from './admin.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { requireRoles } from '../../middleware/rbac.middleware';
import { validateBody, validateQuery } from '../../middleware/validate.middleware';
import { provisionUserSchema, listAdminOrdersQuerySchema, updateShipmentSchema, auditLogQuerySchema } from './admin.schema';
import * as storeController from '../store/store.controller';
import { updateStorePhoneSchema } from '../store/store.schema';

const router = Router();

router.use(authenticate);

// Staff/admin provisioning — ADMIN only.
router.get('/users', requireRoles('ADMIN'), controller.getUsers);
router.post('/users', requireRoles('ADMIN'), validateBody(provisionUserSchema), controller.createUser);
// Revoking is owner-only and deliberately separate from deleting: the
// account and its history stay, only access goes.
router.delete('/users/:userId/access', requireRoles('ADMIN'), controller.revokeUserAccess);

// Order & shipment management — ADMIN and STAFF both process shipments.
router.get('/orders', requireRoles('ADMIN', 'STAFF'), validateQuery(listAdminOrdersQuerySchema), controller.listOrders);
router.get('/orders/:orderId', requireRoles('ADMIN', 'STAFF'), controller.getOrder);
router.patch(
  '/orders/:orderId/shipment',
  requireRoles('ADMIN', 'STAFF'),
  validateBody(updateShipmentSchema),
  controller.updateShipment
);

// Audit log & sessions — owner-only ("lost phone = lost store control otherwise").
router.get('/audit-log', requireRoles('ADMIN'), validateQuery(auditLogQuerySchema), controller.getAuditLog);
router.get('/sessions', requireRoles('ADMIN'), controller.getSessions);
router.delete('/sessions/:sessionId', requireRoles('ADMIN'), controller.revokeSession);

// Dashboard — both roles use it as their home-screen summary.
router.get('/dashboard', requireRoles('ADMIN', 'STAFF'), controller.getDashboard);

// Store Settings (Single editable store phone number) — ADMIN can view and edit.
router.get('/store-settings', requireRoles('ADMIN', 'STAFF'), storeController.getStoreContact);
router.put('/store-settings', requireRoles('ADMIN'), validateBody(updateStorePhoneSchema), storeController.updateStoreSettings);
router.patch('/store-settings', requireRoles('ADMIN'), validateBody(updateStorePhoneSchema), storeController.updateStoreSettings);

export default router;
