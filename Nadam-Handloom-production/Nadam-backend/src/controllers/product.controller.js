// Products (sarees) and tags: Owners and Staff (products.manage; the routes check it).
import * as products from '../services/product.service.js';

const send = (fn, status = 200) => async (req, res, next) => {
  try {
    const out = await fn(req.valid || {}, req);
    return res.status(typeof status === 'function' ? status(out) : status).json(out);
  } catch (err) {
    return next(err);
  }
};
const who = (req) => ({ viewer: req.auth.account, ctx: req.ctx });

export const list = send((v) => products.listProducts(v));
export const get = send((v) => products.getProduct({ id: v.id }));
// 201 for a new saree; 200 when the phone repeated a save that had already worked.
export const create = send((v, req) => products.createProduct({ ...who(req), ...v, photo: req.file.buffer }), (out) => (out.repeated ? 200 : 201));
export const update = send(({ id, ...changes }, req) => products.updateProduct({ ...who(req), id, ...changes }));
export const remove = send((v, req) => products.deleteProduct({ ...who(req), id: v.id }));

export const addPhoto = send((v, req) => products.addPhoto({ ...who(req), id: v.id, photo: req.file.buffer }));
export const orderPhotos = send((v, req) => products.orderPhotos({ ...who(req), id: v.id, ids: v.ids }));
export const deletePhoto = send((v, req) => products.deletePhoto({ ...who(req), id: v.id, photoId: v.photoId }));

export const addTags = send((v, req) => products.addTags({ ...who(req), id: v.id, codes: v.codes }));
export const changeTag = send((v, req) => products.changeTag({ ...who(req), id: v.id, pieceId: v.pieceId, code: v.code }));
export const replaceTag = send((v, req) => products.replaceTag({ ...who(req), id: v.id, pieceId: v.pieceId, code: v.code }));
export const markDamaged = send((v, req) => products.setDamaged({ ...who(req), id: v.id, pieceId: v.pieceId, damaged: true }));
export const backInStock = send((v, req) => products.setDamaged({ ...who(req), id: v.id, pieceId: v.pieceId, damaged: false }));
export const removeTag = send((v, req) => products.removeTag({ ...who(req), id: v.id, pieceId: v.pieceId }));

export const checkTags = send((v) => products.checkTags({ codes: v.codes }));
export const findTag = send((v) => products.findByTag({ code: v.code }));
