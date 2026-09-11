import { Router } from 'express';
import * as controller from './webhooks.controller';
import { rateLimit } from '../../middleware/rateLimit.middleware';

const router = Router();

// No JWT here — Razorpay's servers call this, not our users. The signature
// check inside the controller is the real gate. Rate-limited anyway as
// defense in depth against a flood of junk requests to a guessable URL.
router.post('/razorpay', rateLimit('webhook-razorpay', { max: 60, windowSec: 60 }), controller.razorpayWebhook);

export default router;
