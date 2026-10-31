// Scan to sell: Owners and Staff (sell.use); cancel is Owners only (the routes check it).
import * as sales from '../services/sale.service.js';

const send = (fn, status = 200) => async (req, res, next) => {
  try {
    const out = await fn(req.valid || {}, req);
    return res.status(typeof status === 'function' ? status(out) : status).json(out);
  } catch (err) {
    return next(err);
  }
};
const who = (req) => ({ viewer: req.auth.account, ctx: req.ctx });

export const lookup = send((v, req) => sales.lookup({ ...who(req), code: v.code }));
// 201 for a new sale; 200 when the phone repeated a "Complete sale" that had already worked.
export const sell = send((v, req) => sales.sell({ ...who(req), ...v }), (out) => (out.repeated ? 200 : 201));
export const today = send((v, req) => sales.today({ ...who(req), offset: v.offset, limit: v.limit }));
export const get = send((v, req) => sales.getSale({ ...who(req), id: v.id }));
export const makeInvoice = send((v, req) => sales.makeInvoice({ ...who(req), id: v.id }));
export const makeInvoiceLater = send((v, req) => sales.makeInvoiceLater({ ...who(req), id: v.id }));
export const cancel = send((v, req) => sales.cancelSale({ ...who(req), id: v.id, reason: v.reason }));
