// /api/v2/products and /api/v2/tags: sarees and their tags. Owners and Staff
// (products.manage). Docs Module 4, section 10.
import { Router } from 'express';
import * as c from '../controllers/product.controller.js';
import * as v from '../validators/product.validators.js';
import { validate } from '../middlewares/validate.js';
import { authenticate } from '../middlewares/authenticate.js';
import { requirePermission } from '../middlewares/requirePermission.js';
import { photoUpload } from '../middlewares/upload.js';
import { PERMISSION } from '../config/permissions.js';

const manage = requirePermission(PERMISSION.PRODUCTS_MANAGE);
const id = validate(v.idParams, 'params');
const tagId = validate(v.tagParams, 'params');

export const productRoutes = Router();
const r = productRoutes;
r.use(authenticate, manage);
r.get('/', validate(v.listQuery, 'query'), c.list);
r.post('/', photoUpload, validate(v.createBody), c.create);
r.get('/:id', id, c.get);
r.patch('/:id', id, validate(v.patchBody), c.update);
r.delete('/:id', id, c.remove);
r.post('/:id/photos', id, photoUpload, c.addPhoto);
r.put('/:id/photos/order', id, validate(v.photoOrderBody), c.orderPhotos);
r.delete('/:id/photos/:photoId', validate(v.photoParams, 'params'), c.deletePhoto);
r.post('/:id/tags', id, validate(v.addTagsBody), c.addTags);
r.post('/:id/tags/:pieceId/change', tagId, validate(v.codeBody), c.changeTag);
r.post('/:id/tags/:pieceId/replace', tagId, validate(v.codeBody), c.replaceTag);
r.post('/:id/tags/:pieceId/damaged', tagId, c.markDamaged);
r.post('/:id/tags/:pieceId/back-in-stock', tagId, c.backInStock);
r.post('/:id/tags/:pieceId/remove', tagId, c.removeTag);

export const tagRoutes = Router();
tagRoutes.use(authenticate, manage);
tagRoutes.post('/check', validate(v.checkBody), c.checkTags);
tagRoutes.get('/:code', validate(v.codeParams, 'params'), c.findTag);
