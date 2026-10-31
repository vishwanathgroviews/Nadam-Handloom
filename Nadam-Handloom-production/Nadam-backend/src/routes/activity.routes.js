// /api/v2/activity: Owners only (activity.view). Docs Module 10, section 10.
import { Router } from 'express';
import * as c from '../controllers/activity.controller.js';
import * as v from '../validators/activity.validators.js';
import { validate } from '../middlewares/validate.js';
import { authenticate } from '../middlewares/authenticate.js';
import { requirePermission } from '../middlewares/requirePermission.js';
import { PERMISSION } from '../config/permissions.js';
import { pageQuery } from '../utils/page.js';

const r = Router();
r.use(authenticate, requirePermission(PERMISSION.ACTIVITY_VIEW));
r.get('/', validate(v.listQuery, 'query'), c.list);
r.get('/people', validate(pageQuery, 'query'), c.people);

export default r;
