// /api/v2/payments: Online payments from the website, owners only (payments.view).
// (Razorpay's notices, /payments/razorpay/webhook, are read before this, in app.js.)
import { Router } from 'express';
import * as c from '../controllers/onlinePayments.controller.js';
import * as v from '../validators/onlinePayments.validators.js';
import { validate } from '../middlewares/validate.js';
import { authenticate } from '../middlewares/authenticate.js';
import { requirePermission } from '../middlewares/requirePermission.js';
import { PERMISSION } from '../config/permissions.js';

const r = Router();
r.use(authenticate, requirePermission(PERMISSION.PAYMENTS_VIEW));
r.get('/', validate(v.listQuery, 'query'), c.list);
r.get('/:number', validate(v.numberParams, 'params'), c.get);

export default r;
