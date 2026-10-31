// The website's shop pages: home, catalogue, lists, saree page. Public and cacheable for a
// minute (no personal data in any of these replies).
import * as shop from '../../services/shop/catalog.service.js';

const send = (fn) => async (req, res, next) => {
  try {
    const out = await fn(req.valid || {}, req);
    res.set('Cache-Control', 'public, max-age=60');
    return res.json(out);
  } catch (err) {
    return next(err);
  }
};

export const home = send(() => shop.home());
export const catalog = send(() => shop.catalog());
export const list = send((v) => shop.list(v));
export const product = send((v) => shop.product(v.slug));
