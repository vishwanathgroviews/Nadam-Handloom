// Settings (Module 11): Owners only (settings.manage; the routes check it), except the
// start-up check every phone makes.
import * as settings from '../services/settings.service.js';

const send = (fn) => async (req, res, next) => {
  try {
    return res.json(await fn(req.valid || {}, req));
  } catch (err) {
    return next(err);
  }
};
const who = (req) => ({ viewer: req.auth.account, ctx: req.ctx });

// Never cached on the way: a phone must see maintenance switched off at once.
export const status = async (req, res, next) => {
  try {
    res.set('Cache-Control', 'no-store');
    res.json(await settings.status());
  } catch (err) {
    next(err);
  }
};
export const get = send((_v, req) => settings.getSettings({ ctx: req.ctx }));
export const maintenance = send((v, req) => settings.setMaintenance({ ...who(req), ...v }));
export const updates = send((v, req) => settings.setUpdates({ ...who(req), ...v }));
export const shop = send((v, req) => settings.setShop({ ...who(req), ...v }));
