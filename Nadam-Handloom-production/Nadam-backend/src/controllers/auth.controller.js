// Sign-in endpoints: read the checked request, call the service, send the reply.
import * as auth from '../services/auth.service.js';
import * as sessions from '../services/session.service.js';
import * as biometric from '../services/biometric.service.js';

const send = (fn, status = 200) => async (req, res, next) => {
  try {
    const result = await fn(req.valid, req);
    if (status === 204) return res.status(204).end();
    return res.status(status).json(result);
  } catch (err) {
    return next(err);
  }
};

export const requestSetupCode = send((v, req) => auth.requestSetupCode({ mobile: v.mobile, ctx: req.ctx }), 202);
export const verifySetupCode = send((v, req) => auth.verifySetupCode({ ...v, ctx: req.ctx }));
export const requestResetCode = send((v, req) => auth.requestResetCode({ mobile: v.mobile, ctx: req.ctx }), 202);
export const verifyResetCode = send((v, req) => auth.verifyResetCode({ ...v, ctx: req.ctx }));
export const setPin = send((v, req) => auth.setPin({ ...v, ctx: req.ctx }));
export const login = send((v, req) => auth.login({ ...v, ctx: req.ctx }));
export const requestDeviceCode = send((v, req) => auth.requestDeviceCode({ ...v, ctx: req.ctx }), 202);
export const verifyDeviceCode = send((v, req) => auth.verifyDeviceCode({ ...v, ctx: req.ctx }));
export const refresh = send((v, req) => sessions.refresh({ refreshToken: v.refreshToken, deviceId: req.ctx.deviceId, ctx: req.ctx }));
export const logout = send((v, req) => sessions.logout({ refreshToken: v.refreshToken, ctx: req.ctx }), 204);
export const biometricChallenge = send((v) => biometric.createChallenge(v));
export const biometricLogin = send((v, req) => biometric.login({ ...v, ctx: req.ctx }));
