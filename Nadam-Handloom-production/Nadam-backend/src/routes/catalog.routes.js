// /api/v2/catalog: categories and subcategories. Reading and catalogue PDFs need
// catalog.view (owners and staff); every change needs catalog.edit (owners).
import { Router } from 'express';
import * as c from '../controllers/catalog.controller.js';
import * as v from '../validators/catalog.validators.js';
import { validate } from '../middlewares/validate.js';
import { authenticate } from '../middlewares/authenticate.js';
import { requirePermission } from '../middlewares/requirePermission.js';
import { rateLimit } from '../middlewares/rateLimit.js';
import { photoUpload } from '../middlewares/upload.js';
import { PERMISSION } from '../config/permissions.js';
import { pageQuery } from '../utils/page.js';

const r = Router();
const view = requirePermission(PERMISSION.CATALOG_VIEW);
const edit = requirePermission(PERMISSION.CATALOG_EDIT);
const id = validate(v.idParams, 'params');
r.use(authenticate);

r.get('/categories', view, validate(pageQuery, 'query'), c.listCategories);
r.post('/categories', edit, validate(v.categoryBody), c.createCategory);
r.put('/categories/order', edit, validate(v.orderBody), c.reorderCategories);
r.get('/categories/:id', view, id, validate(v.listQuery, 'query'), c.getCategory);
r.patch('/categories/:id', edit, id, validate(v.categoryPatch), c.updateCategory);
r.delete('/categories/:id', edit, id, c.deleteCategory);
r.put('/categories/:id/photo', edit, id, photoUpload, c.categoryPhoto);
r.post('/categories/:id/subcategories', edit, id, validate(v.subcategoryBody), c.createSubcategory);
r.put('/categories/:id/subcategories/order', edit, id, validate(v.orderBody), c.reorderSubcategories);

r.get('/subcategories', view, validate(v.listQuery, 'query'), c.searchSubcategories);
r.get('/subcategories/:id', view, id, c.getSubcategory);
r.patch('/subcategories/:id', edit, id, validate(v.subcategoryPatch), c.updateSubcategory);
r.delete('/subcategories/:id', edit, id, c.deleteSubcategory);
r.put('/subcategories/:id/photo', edit, id, photoUpload, c.subcategoryPhoto);
r.post('/subcategories/:id/catalogue-pdf', view, id, rateLimit({ name: 'catalogue-pdf', max: 10 }), c.makePdf);

export default r;
