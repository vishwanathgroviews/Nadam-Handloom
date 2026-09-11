import { Router } from 'express';
import * as controller from './admin.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { requireRoles } from '../../middleware/rbac.middleware';
import { validateBody, validateQuery } from '../../middleware/validate.middleware';
import { provisionUserSchema, listAdminOrdersQuerySchema, updateShipmentSchema, auditLogQuerySchema } from './admin.schema';

const router = Router();

router.use(authenticate);

// Staff/admin provisioning — ADMIN only.
router.get('/users', requireRoles('ADMIN'), controller.getUsers);
router.post('/users', requireRoles('ADMIN'), validateBody(provisionUserSchema), controller.createUser);

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

export default router;
