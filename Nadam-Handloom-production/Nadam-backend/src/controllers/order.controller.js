// Orders and shipping (Module 7): Owners and Staff (orders.manage); cancel is Owners
// only (sell.override), unpaid checkouts Owners only (sales.view) (the routes check it).
import * as orders from '../services/order.service.js';
import { can, PERMISSION } from '../config/permissions.js';

const send = (fn) => async (req, res, next) => {
  try {
    return res.json(await fn(req.valid || {}, req));
  } catch (err) {
    return next(err);
  }
};
const who = (req) => ({ viewer: req.auth.account, ctx: req.ctx, canCancel: can(req.auth.role, PERMISSION.SELL_OVERRIDE) });

export const list = send((v) => orders.listOrders(v));
export const counts = send(() => orders.toShipCount());
export const unpaid = send((v) => orders.unpaidCheckouts(v));
export const get = send((v, req) => orders.getOrder({ id: v.id, canCancel: who(req).canCancel }));
export const ship = send((v, req) => orders.shipOrder({ ...who(req), id: v.id, carrier: v.carrier, awb: v.awb }));
export const tracking = send((v, req) => orders.changeTracking({ ...who(req), id: v.id, carrier: v.carrier, awb: v.awb }));
export const delivered = send((v, req) => orders.markDelivered({ ...who(req), id: v.id }));
export const cancel = send((v, req) => orders.cancelOrder({ ...who(req), id: v.id, reason: v.reason }));
