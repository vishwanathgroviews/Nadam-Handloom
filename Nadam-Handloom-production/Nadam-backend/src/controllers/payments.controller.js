// Razorpay's notices (webhook), at /api/v2/payments/razorpay/webhook. The body arrives as raw
// bytes (express.raw in app.js): the signature is checked on exactly what Razorpay sent.
// Answered quickly; a repeat of the same notice (Razorpay's event id) is answered and skipped.
import { handleWebhook } from '../services/shop/checkout.service.js';
import * as fake from '../services/payments/fake.provider.js';

export async function razorpayWebhook(req, res, next) {
  try {
    const out = await handleWebhook({ rawBody: Buffer.isBuffer(req.body) ? req.body : Buffer.from(''), signature: req.get('x-razorpay-signature'), eventId: req.get('x-razorpay-event-id') });
    return res.json(out);
  } catch (err) {
    return next(err);
  }
}

// The stand-in for Razorpay's payment window, for the website's browser tests only: mounted
// only with PAYMENT_PROVIDER=fake (refused in production by config/env.js). It "pays" a payment
// request and answers the receipt the real window would give the page.
export function fakePay(req, res) {
  const { orderId, status = 'captured', method = 'upi' } = req.body || {};
  if (typeof orderId !== 'string' || !fake.order(orderId)) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'No such payment request.' } });
  if (!['captured', 'authorized', 'failed'].includes(status)) return res.status(400).json({ error: { code: 'BAD_STATUS', message: 'Unknown status.' } });
  return res.json(fake.pay(orderId, { status, method: String(method).slice(0, 20) }));
}
