// Notifications to the owners' phones (admin app) about online payments: each paid order,
// each automatic refund, and a refund Razorpay refused. Owners only (role ADMIN), only phones
// still signed in, only where the owner left "Payment notifications" on. Never slows the
// customer: sent in the background; a phone Firebase or Apple says is gone is forgotten.
import * as StaffPush from '../models/staffPush.model.js';
import { pushFor } from './push/index.js';
import { ONLINE_METHOD_TEXT } from './invoice.service.js';

const money = (v) => `₹${Math.round(Number(v)).toLocaleString('en-IN')}`;
const pieces = (n) => `${n} ${n === 1 ? 'saree' : 'sarees'}`;
const who = (order) => {
  const a = order.shippingAddress || {};
  return [a.fullName, a.city].filter(Boolean).join(', ');
};
const count = (order) => (order.items || []).reduce((n, it) => n + it.quantity, 0);

// What each notification says. data: what the app opens on a tap.
export const alertFor = {
  paid: (order) => ({
    title: `New online order · ${money(order.total)}`,
    body: [order.orderNumber, pieces(count(order)), who(order), ONLINE_METHOD_TEXT[order.payment?.method || order.paymentMethod]].filter(Boolean).join(' · '),
    data: { type: 'payment', number: order.orderNumber, orderId: order.id, event: 'paid' },
    tag: `pay-${order.orderNumber}`,
  }),
  refundStarted: (order, attempt) => ({
    title: `Refund started · ${money(attempt.amount)}`,
    body: `${order.orderNumber} · ${attempt.refundReason || 'the payment couldn\'t be used'}. Razorpay returns it to ${who(order) || 'the customer'} in 5 to 7 working days.`,
    data: { type: 'payment', number: order.orderNumber, orderId: order.id, event: 'refund_started' },
    tag: `refund-${order.orderNumber}`,
  }),
  refundStuck: (order, attempt) => ({
    title: `Refund stuck · ${money(attempt.amount)}`,
    body: `${order.orderNumber} · Razorpay refused the refund${attempt.refundError ? ` (${attempt.refundError.slice(0, 80)})` : ''}. Refund it by hand in the Razorpay dashboard.`,
    data: { type: 'payment', number: order.orderNumber, orderId: order.id, event: 'refund_stuck' },
    tag: `refund-${order.orderNumber}`,
  }),
  test: () => ({
    title: 'Payment notifications are on',
    body: 'You\'ll get a notification like this for each online payment and refund.',
    data: { type: 'test' },
    tag: 'test',
  }),
};

export async function sendTo(phones, message) {
  let sent = 0;
  for (const p of phones) {
    const r = await pushFor(p.platform).send({ ...message, token: p.token, platform: p.platform, urgent: true, channel: 'payments' }).catch((err) => ({ ok: false, error: err.message }));
    if (r.ok) sent += 1;
    else if (r.invalidToken) await StaffPush.removeById(p.id).catch(() => {});
    else if (!r.notSetUp) console.error(`[owner-alerts] not sent to a ${p.platform} phone: ${r.error}`);
  }
  return { sent, phones: phones.length };
}

export async function notifyOwners(message) {
  return sendTo(await StaffPush.ownerPhones(), message);
}

// In the background: a payment is never held up by a notification.
let pending = Promise.resolve();
export function alertOwners(message) {
  pending = pending.then(() => notifyOwners(message)).catch((err) => console.error(`[owner-alerts] ${err.message}`));
  return pending;
}
// Tests wait for the notifications already queued.
export const alertsSettled = () => pending;
