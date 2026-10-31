// /api/v2/analytics: Owners only (analytics.view). Docs Module 9, section 10.
import { Router } from 'express';
import * as c from '../controllers/analytics.controller.js';
import * as v from '../validators/analytics.validators.js';
import { validate } from '../middlewares/validate.js';
import { authenticate } from '../middlewares/authenticate.js';
import { requirePermission } from '../middlewares/requirePermission.js';
import { PERMISSION } from '../config/permissions.js';

const r = Router();
r.use(authenticate, requirePermission(PERMISSION.ANALYTICS_VIEW));
r.get('/', validate(v.periodQuery, 'query'), c.summary);
r.get('/stock', c.stock);
r.get('/people/:id', validate(v.personParams, 'params'), validate(v.periodQuery, 'query'), c.person);

export default r;
