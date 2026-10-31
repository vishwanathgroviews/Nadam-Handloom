// Online payments (owners) and this phone's notifications.
import * as payments from '../services/onlinePayments.service.js';
import * as push from '../services/staffPush.service.js';

const send = (fn) => async (req, res, next) => {
  try {
    return res.json(await fn(req.valid || {}, req));
  } catch (err) {
    return next(err);
  }
};
const me = (req) => ({ device: req.auth.device, accountId: req.auth.accountId, role: req.auth.role });

export const list = send((v) => payments.listPayments(v));
export const get = send((v) => payments.getPayment(v.number));

export const pushStatus = send((_v, req) => push.status(me(req)));
export const pushRegister = send((v, req) => push.register({ ...me(req), token: v.token, platform: v.platform, payments: v.payments }));
export const pushSet = send((v, req) => push.setPayments({ ...me(req), payments: v.payments }));
export const pushRemove = send((_v, req) => push.remove(me(req)));
export const pushTest = send((_v, req) => push.test(me(req)));
