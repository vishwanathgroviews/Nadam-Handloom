// Razorpay's two signatures (docs/modules/web-04-checkout.md section 7):
// - the payment receipt the page gets: HMAC-SHA256 of "<our razorpay order id>|<payment id>"
//   with the key secret (always our stored order id, never the one the page sends back);
// - each webhook notice: HMAC-SHA256 of the exact bytes received, with the webhook secret.
// Compared in constant time.
import crypto from 'node:crypto';

function sameHex(expected, given) {
  if (typeof given !== 'string' || !/^[a-f0-9]{64}$/i.test(given)) return false;
  return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(given.toLowerCase(), 'hex'));
}

export const hmac = (data, secret) => crypto.createHmac('sha256', secret).update(data).digest('hex');

export function paymentSignatureOk({ razorpayOrderId, razorpayPaymentId, signature, secret }) {
  if (!secret || !razorpayOrderId || !razorpayPaymentId) return false;
  return sameHex(hmac(`${razorpayOrderId}|${razorpayPaymentId}`, secret), signature);
}

export function webhookSignatureOk({ rawBody, signature, secret }) {
  if (!secret || !Buffer.isBuffer(rawBody)) return false;
  return sameHex(hmac(rawBody, secret), signature);
}
