// /api/v2/invoices: the invoices list, one invoice, the sales summary. Owners and Staff
// (sell.use); totals, the summary and corrections are Owners only (sales.view).
// Docs Module 6, section 10.
import { Router } from 'express';
import * as c from '../controllers/invoice.controller.js';
import * as v from '../validators/invoice.validators.js';
import { validate } from '../middlewares/validate.js';
import { authenticate } from '../middlewares/authenticate.js';
import { requirePermission } from '../middlewares/requirePermission.js';
import { rateLimit } from '../middlewares/rateLimit.js';
import { PERMISSION } from '../config/permissions.js';

const owners = requirePermission(PERMISSION.SALES_VIEW);
const summaryLimit = rateLimit({ name: 'sales-summary', max: 20 });
const id = validate(v.idParams, 'params');

const r = Router();
r.use(authenticate, requirePermission(PERMISSION.SELL_USE));
r.get('/', validate(v.listQuery, 'query'), c.list);
r.get('/without', owners, validate(v.withoutQuery, 'query'), c.without);
r.post('/summary', owners, summaryLimit, validate(v.summaryBody), c.makeSummary);
r.get('/summary/pdf', owners, summaryLimit, validate(v.summaryQuery, 'query'), c.summaryPdf);
r.get('/summary/csv', owners, summaryLimit, validate(v.summaryQuery, 'query'), c.summaryCsv);
r.get('/:id', id, c.get);
r.patch('/:id/customer', id, owners, validate(v.customerBody), c.correct);

export default r;
