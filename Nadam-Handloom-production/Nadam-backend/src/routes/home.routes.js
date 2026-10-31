// /api/v2/home: the Home tab. Docs Module 8, section 10.
import { Router } from 'express';
import * as c from '../controllers/home.controller.js';
import { authenticate } from '../middlewares/authenticate.js';
import { requirePermission } from '../middlewares/requirePermission.js';
import { PERMISSION } from '../config/permissions.js';

const r = Router();
r.use(authenticate);
r.get('/', c.get);
r.get('/stock', requirePermission(PERMISSION.SALES_VIEW), c.stock);

export default r;
