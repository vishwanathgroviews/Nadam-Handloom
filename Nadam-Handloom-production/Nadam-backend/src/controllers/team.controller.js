// The team (owners only; the route checks team.manage first).
import * as team from '../services/team.service.js';

const send = (fn, status = 200) => async (req, res, next) => {
  try {
    return res.status(status).json(await fn(req.valid || {}, req));
  } catch (err) {
    return next(err);
  }
};
const who = (req) => ({ viewer: req.auth.account, ctx: req.ctx });

export const list = send((v, req) => team.listTeam({ viewer: req.auth.account, tab: v.tab, q: v.q, offset: v.offset, limit: v.limit }));
export const get = send((v, req) => team.getMember({ viewer: req.auth.account, id: v.id }));
export const invite = send((v, req) => team.invite({ ...who(req), name: v.name, mobile: v.mobile, role: v.role }), 201);
export const rename = send((v, req) => team.rename({ ...who(req), id: v.id, name: v.name }));
export const changeRole = send((v, req) => team.changeRole({ ...who(req), id: v.id, role: v.role }));
export const remove = send((v, req) => team.remove({ ...who(req), id: v.id }));
export const reinvite = send((v, req) => team.reinvite({ ...who(req), id: v.id, role: v.role }));
export const makeMainOwner = send((v, req) => team.makeMainOwner({ ...who(req), id: v.id }));
export const signOutPhone = send((v, req) => team.signOutPhone({ ...who(req), id: v.id, deviceRowId: v.deviceId }));
export const signOutAllPhones = send((v, req) => team.signOutAllPhones({ ...who(req), id: v.id }));
