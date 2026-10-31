// /api/v2/me: the signed-in person's own account (access token required).
import { Router } from 'express';
import * as c from '../controllers/me.controller.js';
import * as v from '../validators/auth.validators.js';
import { validate } from '../middlewares/validate.js';
import { authenticate } from '../middlewares/authenticate.js';
import { rateLimit } from '../middlewares/rateLimit.js';
import { pageQuery } from '../utils/page.js';
import * as p from '../controllers/onlinePayments.controller.js';
import * as vp from '../validators/onlinePayments.validators.js';

const r = Router();
r.use(authenticate);

r.get('/', c.getMe);
r.get('/devices', validate(pageQuery, 'query'), c.listDevices);
r.post('/devices/sign-out-others', c.signOutOthers);
r.delete('/devices/:id', validate(v.deviceRowParams, 'params'), c.signOutDevice);
r.post('/pin/verify', rateLimit({ name: 'pin-verify' }), validate(v.verifyPinBody), c.verifyPin);
r.post('/pin/change', validate(v.changePinBody), c.changePin);
r.post('/biometric', validate(v.enableBiometricBody), c.enableBiometric);
r.delete('/biometric', c.disableBiometric);
// This phone's notifications (owners: one for each online payment).
r.get('/push', p.pushStatus);
r.put('/push', validate(vp.pushBody), p.pushRegister);
r.patch('/push', validate(vp.pushPatch), p.pushSet);
r.delete('/push', p.pushRemove);
r.post('/push/test', rateLimit({ name: 'push-test', max: 5 }), p.pushTest);

export default r;
