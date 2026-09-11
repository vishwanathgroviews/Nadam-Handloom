import { Router } from 'express';
import * as controller from './app-auth.controller';
import { validateBody } from '../../middleware/validate.middleware';
import { rateLimit } from '../../middleware/rateLimit.middleware';
import {
  appActivationSchema,
  appOtpVerifySchema,
  appMpinSetupSchema,
  appLoginSchema,
  appMpinForgotSchema,
  appMpinResetSchema,
} from './auth.schema';

const router = Router();

// Staff/admin accounts are provisioned by an ADMIN (POST /admin/users) — this
// activates a pending one via mobile + OTP, it never creates a new account.
router.post('/activate', rateLimit('app-activate', { max: 5, windowSec: 60 }), validateBody(appActivationSchema), controller.activate);
router.post('/otp/verify', rateLimit('app-otp-verify', { max: 5, windowSec: 60 }), validateBody(appOtpVerifySchema), controller.verifyOtp);
router.post('/mpin/setup', rateLimit('app-mpin-setup', { max: 5, windowSec: 60 }), validateBody(appMpinSetupSchema), controller.mpinSetup);
router.post('/login', rateLimit('app-login', { max: 5, windowSec: 60 }), validateBody(appLoginSchema), controller.login);
router.post('/mpin/forgot', rateLimit('app-mpin-forgot', { max: 5, windowSec: 60 }), validateBody(appMpinForgotSchema), controller.mpinForgot);
router.post('/mpin/reset', rateLimit('app-mpin-reset', { max: 5, windowSec: 60 }), validateBody(appMpinResetSchema), controller.mpinReset);

export default router;
