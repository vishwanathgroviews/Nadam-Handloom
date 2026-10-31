// How My orders (W7) words an order: its status badge, the line about what happens next, the
// progress steps and the amount's label. The server's statuses: awaiting_payment, confirming,
// paid (being packed), shipped, delivered, refunded, cancelled_paid (cancelled by the shop after
// paying; the owners refund it in Razorpay), hold_ended and cancelled (checkouts never paid).
import { clock } from '../pages/checkout/format.js';
import { dayMonth, dayMonthYear } from '../utils/format.js';
import { rs } from '../utils/money.js';

// Paid and going ahead: the progress line, the invoice.
export const KEPT = new Set(['paid', 'shipped', 'delivered']);

const TEXT = {
  awaiting_payment: 'Waiting for payment', confirming: 'Confirming payment', paid: 'Being packed', shipped: 'Shipped', delivered: 'Delivered',
  refunded: 'Refunded', hold_ended: 'Not paid', cancelled: 'Not paid',
};
export function statusText(o) {
  if (o.status === 'cancelled_paid') return o.cancelled?.refundedAt ? 'Cancelled · refunded' : 'Cancelled · refund on its way';
  return TEXT[o.status] || 'Order';
}
// The badge's colour (theme/orders.css).
export const badgeTone = (status) => ({ paid: 'packing', cancelled_paid: 'shopcancel', awaiting_payment: 'held' })[status] || status;

// [icon, text]: what happens next, in one line.
export function nextLine(o) {
  const s = o.status;
  if (s === 'awaiting_payment') return ['clock', `Held for you until ${clock(o.holdUntil)}. Pay to confirm it.`];
  if (s === 'confirming') return ['clock', 'Payment received. Confirming with your bank.'];
  if (s === 'paid') return ['box', `Paid ${dayMonth(o.paidAt || o.payment?.paidAt || o.placedAt)}. We pack within 2 working days.`];
  if (s === 'shipped') return ['truck', `Shipped ${dayMonth(o.shipping?.shippedAt)}${o.shipping?.trackingNumber ? ` · ${o.shipping.carrier} ${o.shipping.trackingNumber}` : ` by ${o.shipping?.carrier || 'DTDC'}`}`];
  if (s === 'delivered') return ['home', o.shipping?.deliveredAt ? `Delivered ${dayMonth(o.shipping.deliveredAt)}` : 'Delivered'];
  if (s === 'refunded') {
    const amount = rs(o.refund?.amount ?? o.total);
    return ['refresh', o.refund?.status === 'processed' ? `${amount} refunded to your account` : `${amount} is being refunded to your account (5 to 7 working days)`];
  }
  if (s === 'cancelled_paid') {
    return ['refresh', o.cancelled?.refundedAt ? `Cancelled by the shop. ${rs(o.total)} refunded on ${dayMonth(o.cancelled.refundedAt)}.` : `Cancelled by the shop. ${rs(o.total)} is being refunded.`];
  }
  return ['info', 'Not paid. Nothing was charged.'];
}

// The label under the amount.
export function amountLabel(o) {
  if (o.status === 'awaiting_payment') return 'To pay';
  if (o.status === 'confirming') return 'Paying';
  if (o.status === 'refunded') return o.refund?.status === 'processed' ? 'Refunded' : 'Being refunded';
  if (o.status === 'cancelled_paid') return o.cancelled?.refundedAt ? 'Refunded' : 'Being refunded';
  return 'Paid';
}

// The progress line (Paid → Packed → Shipped → Delivered) for a kept order:
// [{ key, icon, title, text, done, current }].
export function steps(o) {
  const sh = o.shipping;
  const shipped = o.status === 'shipped' || o.status === 'delivered';
  const paidAt = o.payment?.paidAt || o.paidAt;
  const list = [
    { key: 'paid', icon: 'check', title: 'Paid', text: paidAt ? `${dayMonth(paidAt)}, ${clock(paidAt)}` : '', done: true },
    { key: 'packed', icon: 'box', title: 'Packed', text: shipped ? dayMonth(sh?.shippedAt) : 'Within 2 working days', done: shipped },
    { key: 'shipped', icon: 'truck', title: 'Shipped', text: shipped ? `${dayMonth(sh?.shippedAt)} · ${sh?.carrier || 'DTDC'}` : 'Tracking number here', done: shipped },
    { key: 'delivered', icon: 'home', title: 'Delivered', text: o.status === 'delivered' ? dayMonth(sh?.deliveredAt) : 'Usually 3 to 7 days', done: o.status === 'delivered' },
  ];
  const now = list.findIndex((x) => !x.done);
  return list.map((x, i) => ({ ...x, current: i === now }));
}

// "17 Oct 2026, 10:12 am"
export const placedText = (o) => `${dayMonthYear(o.placedAt)}, ${clock(o.placedAt)}`;
// "Pure Pattu Butta and 2 more" (a list row has title and sarees; a whole order has lines).
export function orderTitle(o) {
  const count = o.sarees ?? o.lines?.length ?? 1;
  const first = o.title || o.lines?.[0]?.name || 'Your order';
  return count > 1 ? `${first} and ${count - 1} more` : first;
}
