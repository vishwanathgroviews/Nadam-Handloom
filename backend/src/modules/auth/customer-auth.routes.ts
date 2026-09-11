import { Router } from 'express';
import * as controller from './customer-auth.controller';
import { validateBody } from '../../middleware/validate.middleware';
import { rateLimit } from '../../middleware/rateLimit.middleware';
import {
  customerRegisterSchema,
  customerOtpVerifySchema,
  customerOtpResendSchema,
  customerMpinSetupSchema,
  customerLoginSchema,
  customerMpinForgotSchema,
  customerMpinResetSchema,
} from './auth.schema';

const router = Router();

router.post('/register', rateLimit('customer-register', { max: 5, windowSec: 60 }), validateBody(customerRegisterSchema), controller.register);
router.post('/otp/verify', rateLimit('customer-otp-verify', { max: 5, windowSec: 60 }), validateBody(customerOtpVerifySchema), controller.verifyOtp);
router.post('/otp/resend', rateLimit('customer-otp-resend', { max: 5, windowSec: 60 }), validateBody(customerOtpResendSchema), controller.resendOtp);
router.post('/mpin/setup', rateLimit('customer-mpin-setup', { max: 5, windowSec: 60 }), validateBody(customerMpinSetupSchema), controller.mpinSetup);
router.post('/login', rateLimit('customer-login', { max: 5, windowSec: 60 }), validateBody(customerLoginSchema), controller.login);
router.post('/mpin/forgot', rateLimit('customer-mpin-forgot', { max: 5, windowSec: 60 }), validateBody(customerMpinForgotSchema), controller.mpinForgot);
router.post('/mpin/reset', rateLimit('customer-mpin-reset', { max: 5, windowSec: 60 }), validateBody(customerMpinResetSchema), controller.mpinReset);

export default router;
