// /api/v2/orders: online and WhatsApp orders, and shipping. Owners and Staff
// (orders.manage); cancel is Owners only (sell.override); unpaid checkouts Owners only
// (sales.view). Docs Module 7, section 10.
import { Router } from 'express';
import * as c from '../controllers/order.controller.js';
import * as v from '../validators/order.validators.js';
import { validate } from '../middlewares/validate.js';
import { authenticate } from '../middlewares/authenticate.js';
import { requirePermission } from '../middlewares/requirePermission.js';
import { PERMISSION } from '../config/permissions.js';
import { pageQuery } from '../utils/page.js';

const id = validate(v.idParams, 'params');

const r = Router();
r.use(authenticate, requirePermission(PERMISSION.ORDERS_MANAGE));
r.get('/', validate(v.listQuery, 'query'), c.list);
r.get('/counts', c.counts);
r.get('/unpaid', requirePermission(PERMISSION.SALES_VIEW), validate(pageQuery, 'query'), c.unpaid);
r.get('/:id', id, c.get);
r.post('/:id/ship', id, validate(v.trackingBody), c.ship);
r.patch('/:id/tracking', id, validate(v.trackingBody), c.tracking);
r.post('/:id/delivered', id, c.delivered);
r.post('/:id/cancel', id, requirePermission(PERMISSION.SELL_OVERRIDE), validate(v.cancelBody), c.cancel);

export default r;
