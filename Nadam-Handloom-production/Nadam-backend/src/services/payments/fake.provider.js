// A stand-in for Razorpay's servers, for tests (PAYMENT_PROVIDER=fake; never in production).
// Same calls as razorpay.provider.js, kept in memory. Tests "pay" with pay() and get the same
// receipt and signature the real checkout would give the page.
import crypto from 'node:crypto';
import { env } from '../../config/env.js';
import { hmac } from './signature.js';
import { RazorpayError } from './razorpay.provider.js';

const orders = new Map();
const payments = new Map();
// The next call(s) of one kind fail: { name, left, status, message }.
let failNext = null;
function failing(name, status = 503, message = 'fake outage') {
  if (failNext?.name !== name) return;
  const f = failNext;
  f.left -= 1;
  if (f.left <= 0) failNext = null;
  throw new RazorpayError(f.status ?? status, f.status === 400 ? 'BAD_REQUEST_ERROR' : 'SERVER_ERROR', f.message ?? message);
}
// Something that happens elsewhere while the next call of one kind is on its way (tests of races:
// the customer pays in another tab while this one asks Razorpay for a new payment request).
let during = null;
async function meanwhile(name) {
  if (during?.name !== name) return;
  const fn = during.fn;
  during = null;
  await fn();
}
const id = (p) => `${p}_${crypto.randomBytes(7).toString('base64url').replace(/[^A-Za-z0-9]/g, 'x').slice(0, 14)}`;

export async function createOrder({ amountPaise, receipt, notes, captureMinutes }) {
  failing('createOrder', 500);
  await meanwhile('createOrder');
  const o = { id: id('order'), entity: 'order', amount: amountPaise, currency: 'INR', receipt, notes, status: 'created', captureMinutes, created_at: Math.floor(Date.now() / 1000) };
  orders.set(o.id, o);
  return { ...o };
}
export async function fetchPayment(paymentId) {
  failing('fetchPayment');
  const p = payments.get(paymentId);
  if (!p) throw new RazorpayError(400, 'BAD_REQUEST_ERROR', 'The id provided does not exist');
  return { ...p };
}
export async function orderPayments(razorpayOrderId) {
  failing('orderPayments');
  return [...payments.values()].filter((p) => p.order_id === razorpayOrderId).map((p) => ({ ...p }));
}
export async function capturePayment(paymentId, amountPaise) {
  const p = payments.get(paymentId);
  if (!p || p.status !== 'authorized' || p.amount !== amountPaise) throw new RazorpayError(400, 'BAD_REQUEST_ERROR', 'This payment has already been captured');
  p.status = 'captured'; p.captured = true;
  return { ...p };
}
export async function refundPayment(paymentId, { notes } = {}) {
  failing('refundPayment');
  const p = payments.get(paymentId);
  if (!p || p.status !== 'captured') throw new RazorpayError(400, 'BAD_REQUEST_ERROR', 'Only captured payments can be refunded');
  p.status = 'refunded'; p.amount_refunded = p.amount;
  return { id: id('rfnd'), entity: 'refund', payment_id: paymentId, amount: p.amount, status: 'processed', notes };
}

/* ---------- For tests ---------- */
// A payment on a payment request. status: captured | authorized | failed | created.
export function pay(razorpayOrderId, { status = 'captured', method = 'upi', amount } = {}) {
  const o = orders.get(razorpayOrderId);
  const p = { id: id('pay'), entity: 'payment', order_id: razorpayOrderId, amount: amount ?? o?.amount ?? 0, currency: 'INR', status, captured: status === 'captured', method, error_description: status === 'failed' ? 'Your bank declined the payment' : null, created_at: Math.floor(Date.now() / 1000) };
  payments.set(p.id, p);
  if (o && status === 'captured') o.status = 'paid';
  return { payment: { ...p }, receipt: { razorpay_order_id: razorpayOrderId, razorpay_payment_id: p.id, razorpay_signature: hmac(`${razorpayOrderId}|${p.id}`, env.payments.keySecret) } };
}
export const setPayment = (paymentId, patch) => Object.assign(payments.get(paymentId), patch);
// failNextCall('refundPayment', { times: 3, status: 400, message: 'The balance is insufficient' })
export const failNextCall = (name, { times = 1, status, message } = {}) => { failNext = { name, left: times, status, message }; };
export const order = (razorpayOrderId) => orders.get(razorpayOrderId);
export const duringNextCall = (name, fn) => { during = { name, fn }; };
export const reset = () => { orders.clear(); payments.clear(); failNext = null; during = null; };
