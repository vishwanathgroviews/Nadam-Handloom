import { Router } from 'express';
import * as controller from './orders.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { validateBody, validateQuery } from '../../middleware/validate.middleware';
import { rateLimit } from '../../middleware/rateLimit.middleware';
import { checkoutSchema, verifyPaymentSchema, listOrdersQuerySchema } from './orders.schema';

const router = Router();

router.use(authenticate);

router.post('/checkout', rateLimit('orders-checkout', { max: 10, windowSec: 60 }), validateBody(checkoutSchema), controller.checkout);
router.post('/:orderId/verify-payment', rateLimit('orders-verify-payment', { max: 20, windowSec: 60 }), validateBody(verifyPaymentSchema), controller.verifyPayment);
router.get('/', validateQuery(listOrdersQuerySchema), controller.listOrders);
router.get('/:orderId', controller.getOrder);
router.get('/:orderId/tracking', controller.getOrderTracking);
router.get('/:orderId/invoice', controller.getOrderInvoice);

export default router;
