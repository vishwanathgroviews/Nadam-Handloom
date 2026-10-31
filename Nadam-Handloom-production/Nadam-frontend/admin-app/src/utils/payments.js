// Online payments (owners): the filter chips, the words for each state, and reading which
// payment a notification is about. The server decides every state; this only shows it.
import { todayIst } from './invoices';

export const STATUS_CHIPS = [
  ['all', 'All'], ['paid', 'Paid'], ['confirming', 'Confirming'], ['not_paid', 'Not paid'],
  ['refunded', 'Refunded'], ['refund_stuck', 'Refund stuck'], ['refund_by_hand', 'Cancelled after paying'],
];
export const PERIOD_CHIPS = [['all', 'All dates'], ['today', 'Today'], ['7d', '7 days'], ['30d', '30 days'], ['custom', 'Custom']];
export const METHOD_CHIPS = [['all', 'All methods'], ['upi', 'UPI'], ['card', 'Card'], ['netbanking', 'Net banking'], ['wallet', 'Wallet']];

export const STATUS_TONE = { paid: 'success', confirming: 'warning', not_paid: 'neutral', refunded: 'neutral', refund_stuck: 'danger', refund_by_hand: 'warning' };
export const METHOD_ICON = { upi: 'upi', card: 'card', netbanking: 'store', wallet: 'cash', emi: 'card', paylater: 'card' };

// The query for /payments. custom: { from, to } days when period is 'custom'.
export function paymentsQuery({ status = 'all', period = 'all', custom = null, method = 'all', q = '', offset = 0 } = {}) {
  const p = { status, method, offset };
  const search = q.trim();
  if (search) p.q = search; // a search looks at every date
  else if (period === 'custom' && custom) Object.assign(p, { period, from: custom.from, to: custom.to });
  else p.period = period === 'custom' ? 'all' : period;
  return Object.entries(p).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
}

// "Refund started · ₹5,800" and the like, for a row or the detail.
export function refundText(refund, rupees) {
  if (!refund) return null;
  if (refund.state === 'stuck') return `Refund stuck · ${rupees(refund.amount)}`;
  if (refund.state === 'waiting') return `Refund waiting · ${rupees(refund.amount)}`;
  if (refund.state === 'processed') return `Refunded · ${rupees(refund.amount)}`;
  return `Refund started · ${rupees(refund.amount)}`;
}

// Razorpay's notices in plain words.
const NOTICE_TEXT = {
  'payment.captured': 'Payment taken', 'payment.authorized': 'Payment approved by the bank', 'payment.failed': 'Payment failed',
  'order.paid': 'Order paid', 'refund.processed': 'Refund completed', 'refund.failed': 'Refund failed',
};
export const noticeText = (type) => NOTICE_TEXT[type] || type;

// Which payment a notification is about. Android (Firebase, Expo's shape) gives `body` as
// JSON text; iPhone (Apple) gives it as an object; either may also carry `number` itself.
export function numberFromData(data) {
  if (!data || typeof data !== 'object') return null;
  let inner = data.body;
  if (typeof inner === 'string') { try { inner = JSON.parse(inner); } catch { inner = null; } }
  const n = data.number || inner?.number;
  return typeof n === 'string' && /^NH\d{8}$/.test(n) ? n : null;
}

export const isToday = (iso, now = Date.now()) => !!iso && todayIst(Date.parse(iso)) === todayIst(now);
