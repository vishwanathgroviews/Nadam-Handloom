// Razorpay's server API (https://api.razorpay.com/v1), called directly: create a payment
// request (order), read a payment, read an order's payments, capture, refund. Basic auth with
// the key id and secret from .env. No package needed.
import { env } from '../../config/env.js';
import { unavailable } from '../../utils/errors.js';

const BASE = 'https://api.razorpay.com/v1';
const TIMEOUT_MS = 10_000;

export class RazorpayError extends Error {
  constructor(status, code, description) {
    super(description || `Razorpay error ${status}`);
    this.status = status;
    this.code = code;
  }
}

async function call(method, path, body) {
  const auth = Buffer.from(`${env.payments.keyId}:${env.payments.keySecret}`).toString('base64');
  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    throw unavailable('PAYMENTS_UNAVAILABLE', 'We couldn\'t reach our payment service just now. Please try again in a minute.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new RazorpayError(res.status, data?.error?.code, data?.error?.description);
  return data;
}

// A payment request for the exact amount, taken automatically if authorised within
// `captureMinutes`; one authorised later is never taken and Razorpay returns it.
export const createOrder = ({ amountPaise, receipt, notes, captureMinutes }) => call('POST', '/orders', {
  amount: amountPaise,
  currency: 'INR',
  receipt,
  notes,
  payment: { capture: 'automatic', capture_options: { automatic_expiry_period: captureMinutes, manual_expiry_period: captureMinutes, refund_speed: 'normal' } },
});
export const fetchPayment = (paymentId) => call('GET', `/payments/${encodeURIComponent(paymentId)}`);
export const orderPayments = async (razorpayOrderId) => (await call('GET', `/orders/${encodeURIComponent(razorpayOrderId)}/payments`)).items || [];
export const capturePayment = (paymentId, amountPaise) => call('POST', `/payments/${encodeURIComponent(paymentId)}/capture`, { amount: amountPaise, currency: 'INR' });
export const refundPayment = (paymentId, { notes, receipt } = {}) => call('POST', `/payments/${encodeURIComponent(paymentId)}/refund`, { speed: 'normal', notes, receipt });
