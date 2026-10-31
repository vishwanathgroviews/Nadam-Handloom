// /api/v2/sales: scan to sell. Owners and Staff (sell.use); cancelling a sale is
// Owners only (sell.override). Docs Module 5, section 10.
import { Router } from 'express';
import * as c from '../controllers/sale.controller.js';
import * as v from '../validators/sale.validators.js';
import { validate } from '../middlewares/validate.js';
import { authenticate } from '../middlewares/authenticate.js';
import { requirePermission } from '../middlewares/requirePermission.js';
import { PERMISSION } from '../config/permissions.js';
import { pageQuery } from '../utils/page.js';

const id = validate(v.idParams, 'params');

const r = Router();
r.use(authenticate, requirePermission(PERMISSION.SELL_USE));
r.post('/lookup', validate(v.lookupBody), c.lookup);
r.post('/', validate(v.sellBody), c.sell);
r.get('/today', validate(pageQuery, 'query'), c.today);
r.get('/:id', id, c.get);
r.post('/:id/invoice', id, c.makeInvoice);
r.post('/:id/make-invoice', id, c.makeInvoiceLater);
r.post('/:id/cancel', id, requirePermission(PERMISSION.SELL_OVERRIDE), validate(v.cancelBody), c.cancel);

export default r;
