// /api/v2/shop/me: the signed-in customer's own account.
import * as profile from '../../services/shop/profile.service.js';
import * as addresses from '../../services/shop/address.service.js';
import * as account from '../../services/shop/account.service.js';
import * as sessions from '../../services/shop/session.service.js';

const send = (fn, status = 200) => async (req, res, next) => {
  try {
    const out = await fn(req.valid || {}, req);
    if (status === 204) return res.status(204).end();
    return res.status(status).json(out);
  } catch (err) {
    return next(err);
  }
};

const who = (req) => ({ account: req.customer.account, ctx: req.ctx });

export const getMe = send((_v, req) => ({ customer: profile.getMe(req.customer.account) }));
export const updateMe = send((v, req) => profile.updateMe({ ...who(req), patch: v }));
export const setAvatar = send((_v, req) => profile.setAvatar({ ...who(req), file: req.file }));
export const removeAvatar = send((_v, req) => profile.removeAvatar(who(req)));
export const requestMobileCode = send((v, req) => profile.requestMobileChange({ ...who(req), mobile: v.mobile }), 202);
export const verifyMobileCode = send((v, req) => profile.verifyMobileChange({ ...who(req), mobile: v.mobile, code: v.code }));

export const listSessions = send(async (_v, req) => ({ sessions: await sessions.listSessions({ accountId: req.customer.accountId, currentSessionId: req.customer.session.id }) }));
export const signOutSession = send((v, req) => sessions.signOutSession({ accountId: req.customer.accountId, id: v.id, currentSessionId: req.customer.session.id, ctx: req.ctx }));

export const listAddresses = send((_v, req) => addresses.list(req.customer.accountId));
export const addAddress = send((v, req) => addresses.add({ accountId: req.customer.accountId, v, ctx: req.ctx }), 201);
export const updateAddress = send((v, req) => {
  const { id, ...rest } = v;
  return addresses.update({ accountId: req.customer.accountId, id, v: rest, ctx: req.ctx });
});
export const removeAddress = send((v, req) => addresses.remove({ accountId: req.customer.accountId, id: v.id, ctx: req.ctx }));
export const makeDefaultAddress = send((v, req) => addresses.makeDefault({ accountId: req.customer.accountId, id: v.id, ctx: req.ctx }));

export const requestDeletion = send((v, req) => account.requestDeletion({ ...who(req), reason: v.reason }));
export const cancelDeletion = send((_v, req) => account.cancelDeletion(who(req)));
