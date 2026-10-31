// /api/v2/settings: Owners only (settings.manage). /api/v2/app-status: the start-up
// check, no sign-in. Docs Module 11, section 10.
import { Router } from 'express';
import * as c from '../controllers/settings.controller.js';
import * as v from '../validators/settings.validators.js';
import { validate } from '../middlewares/validate.js';
import { authenticate } from '../middlewares/authenticate.js';
import { requirePermission } from '../middlewares/requirePermission.js';
import { PERMISSION } from '../config/permissions.js';

const r = Router();
r.use(authenticate, requirePermission(PERMISSION.SETTINGS_MANAGE));
r.get('/', c.get);
r.patch('/maintenance', validate(v.maintenanceBody), c.maintenance);
r.patch('/updates', validate(v.updatesBody), c.updates);
r.patch('/shop', validate(v.shopBody), c.shop);

export const appStatus = c.status;
export default r;
