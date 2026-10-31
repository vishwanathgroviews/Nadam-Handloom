// /api/v2/auth: public sign-in endpoints (no access token needed).
import { Router } from 'express';
import * as c from '../controllers/auth.controller.js';
import * as v from '../validators/auth.validators.js';
import { validate } from '../middlewares/validate.js';
import { rateLimit } from '../middlewares/rateLimit.js';

const r = Router();
r.use(rateLimit({ name: 'auth' }));

r.post('/setup/request-code', validate(v.requestCodeBody), c.requestSetupCode);
r.post('/setup/verify-code', validate(v.verifyCodeBody), c.verifySetupCode);
r.post('/forgot/request-code', validate(v.requestCodeBody), c.requestResetCode);
r.post('/forgot/verify-code', validate(v.verifyCodeBody), c.verifyResetCode);
r.post('/pin/set', validate(v.setPinBody), c.setPin);
r.post('/login', validate(v.loginBody), c.login);
r.post('/device/request-code', validate(v.deviceCodeRequestBody), c.requestDeviceCode);
r.post('/device/verify-code', validate(v.deviceCodeVerifyBody), c.verifyDeviceCode);
r.post('/biometric/challenge', validate(v.biometricChallengeBody), c.biometricChallenge);
r.post('/biometric/login', validate(v.biometricLoginBody), c.biometricLogin);
r.post('/refresh', validate(v.refreshBody), c.refresh);
r.post('/logout', validate(v.logoutBody), c.logout);

export default r;
