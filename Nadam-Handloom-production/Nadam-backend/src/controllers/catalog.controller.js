// The catalogue (everyone can read; owners change it; the routes check which).
import * as catalog from '../services/catalog.service.js';
import * as pdf from '../services/catalogPdf.service.js';

const send = (fn, status = 200) => async (req, res, next) => {
  try {
    return res.status(status).json(await fn(req.valid || {}, req));
  } catch (err) {
    return next(err);
  }
};
const who = (req) => ({ viewer: req.auth.account, ctx: req.ctx });

export const listCategories = send((v, req) => catalog.listCategories({ ...who(req), offset: v.offset, limit: v.limit }));
export const searchSubcategories = send((v) => catalog.searchSubcategories(v));
export const getCategory = send((v, req) => catalog.getCategory({ ...who(req), id: v.id, q: v.q, filter: v.filter, offset: v.offset, limit: v.limit }));
export const createCategory = send((v, req) => catalog.createCategory({ ...who(req), name: v.name, description: v.description }), 201);
export const updateCategory = send((v, req) => catalog.updateCategory({ ...who(req), id: v.id, name: v.name, description: v.description }));
export const deleteCategory = send((v, req) => catalog.deleteCategory({ ...who(req), id: v.id }));
export const reorderCategories = send((v, req) => catalog.reorder({ ...who(req), ids: v.ids }));
export const categoryPhoto = send((v, req) => catalog.setPhoto({ ...who(req), kind: 'category', id: v.id, buffer: req.file.buffer }));

export const getSubcategory = send((v, req) => catalog.getSubcategory({ ...who(req), id: v.id }));
export const createSubcategory = send((v, req) => catalog.createSubcategory({ ...who(req), categoryId: v.id, name: v.name, description: v.description, storePrice: v.storePrice, websitePrice: v.websitePrice, mrp: v.mrp }), 201);
export const updateSubcategory = send(({ id, ...changes }, req) => catalog.updateSubcategory({ ...who(req), id, ...changes }));
export const deleteSubcategory = send((v, req) => catalog.deleteSubcategory({ ...who(req), id: v.id }));
export const reorderSubcategories = send((v, req) => catalog.reorder({ ...who(req), categoryId: v.id, ids: v.ids }));
export const subcategoryPhoto = send((v, req) => catalog.setPhoto({ ...who(req), kind: 'subcategory', id: v.id, buffer: req.file.buffer }));
export const makePdf = send((v, req) => pdf.makeCataloguePdf({ ...who(req), id: v.id }));
