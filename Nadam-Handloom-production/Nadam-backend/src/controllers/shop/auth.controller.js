// /api/v2/shop/auth: website sign-in. Read the checked request, call the service, reply.
import * as auth from '../../services/shop/auth.service.js';
import * as sessions from '../../services/shop/session.service.js';
import { readSignInCookie, setSignInCookie, clearSignInCookie } from './cookie.js';

const handle = (fn) => async (req, res, next) => {
  try {
    return await fn(req, res);
  } catch (err) {
    // A sign-in that has ended takes its cookie with it.
    if (err?.status === 401) clearSignInCookie(res);
    return next(err);
  }
};

// A signed-in reply: the 30-day key goes in the cookie, never in the body.
function signedIn(res, out, extra = {}) {
  setSignInCookie(res, out.refreshToken, out.expiresAt);
  return res.json({ status: 'signed_in', ...extra, ...out.body });
}

export const requestCode = handle(async (req, res) => res.status(202).json(await auth.requestCode({ ...req.valid, ctx: req.ctx })));

export const verifyCode = handle(async (req, res) => {
  const r = await auth.verifyCode({ ...req.valid, ctx: req.ctx });
  if (r.status === 'signed_in') return signedIn(res, r);
  return res.json(r);
});

export const complete = handle(async (req, res) => {
  const r = await auth.completeProfile({ ...req.valid, ctx: req.ctx });
  return signedIn(res, r, { isNew: true });
});

export const refresh = handle(async (req, res) => signedIn(res, await sessions.refresh({ refreshToken: readSignInCookie(req), ctx: req.ctx })));

export const logout = handle(async (req, res) => {
  await sessions.logout({ refreshToken: readSignInCookie(req), pushToken: req.valid.pushToken, ctx: req.ctx });
  clearSignInCookie(res);
  return res.status(204).end();
});

export const logoutAll = handle(async (req, res) => {
  await sessions.logoutAll({ accountId: req.customer.accountId, ctx: req.ctx });
  clearSignInCookie(res);
  return res.status(204).end();
});
