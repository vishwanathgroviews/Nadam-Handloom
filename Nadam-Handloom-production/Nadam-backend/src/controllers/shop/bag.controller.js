// /api/v2/shop/bag/check (anyone) and /api/v2/shop/me/bag (signed in): the bag (W5). Never
// cached: stock and prices change all day.
import * as bag from '../../services/shop/bag.service.js';

const send = (fn) => async (req, res, next) => {
  try {
    const out = await fn(req.valid || {}, req);
    res.set('Cache-Control', 'no-store');
    return res.json(out);
  } catch (err) {
    return next(err);
  }
};

const accountId = (req) => req.customer.accountId;

export const check = send((v) => bag.check({ items: v.items }));
export const getBag = send((_v, req) => bag.getBag({ accountId: accountId(req) }));
export const setItem = send((v, req) => bag.setItem({ accountId: accountId(req), slug: v.slug, quantity: v.quantity, priceSeen: v.priceSeen }));
export const removeItem = send((v, req) => bag.removeItem({ accountId: accountId(req), slug: v.slug }));
export const merge = send((v, req) => bag.merge({ accountId: accountId(req), items: v.items }));
export const clear = send((_v, req) => bag.clear({ accountId: accountId(req) }));
