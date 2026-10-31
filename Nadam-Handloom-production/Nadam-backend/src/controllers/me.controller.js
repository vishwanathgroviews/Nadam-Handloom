// The signed-in person's own account.
import * as me from '../services/me.service.js';
import * as devices from '../services/device.service.js';
import * as biometric from '../services/biometric.service.js';
import { pageOf } from '../utils/page.js';

const send = (fn) => async (req, res, next) => {
  try {
    return res.json(await fn(req.valid || {}, req));
  } catch (err) {
    return next(err);
  }
};

export const getMe = send((_v, req) => me.getMe(req.auth));
// 20 at a time; this phone first. `total` is every phone signed in.
export const listDevices = send(async (v, req) => {
  const page = pageOf(await devices.listDevices(req.auth.accountId, req.auth.device.id), v);
  return { devices: page.items, nextOffset: page.nextOffset, total: page.total };
});
export const signOutDevice = send((v, req) => devices.signOutDevice({ accountId: req.auth.accountId, deviceRowId: v.id, currentDeviceRowId: req.auth.device.id, ctx: req.ctx }));
export const signOutOthers = send((_v, req) => devices.signOutOtherDevices({ accountId: req.auth.accountId, currentSessionId: req.auth.session.id, currentDeviceRowId: req.auth.device.id, ctx: req.ctx }));
export const verifyPin = send((v, req) => me.verifyCurrentPin({ auth: req.auth, pin: v.pin, ctx: req.ctx }));
export const changePin = send((v, req) => me.changePin({ auth: req.auth, ...v, ctx: req.ctx }));
export const enableBiometric = send((v, req) => biometric.enable({ auth: req.auth, deviceRowId: req.auth.device.id, accountId: req.auth.accountId, publicKey: v.publicKey, pin: v.pin, ctx: req.ctx }));
export const disableBiometric = send((_v, req) => biometric.disable({ deviceRowId: req.auth.device.id, accountId: req.auth.accountId, ctx: req.ctx }));
