// Admin app → Online payments (owners only, payments.view): every website order that reached
// Razorpay, newest first, with filters (status, days, method, search), the totals of what is
// shown, and one payment's whole story (each try, refunds, Razorpay's notices).
//
// Status, as the owners see it:
//   paid            the money is in and the order goes ahead (To ship, shipped, delivered)
//   confirming      the customer paid; Razorpay hasn't confirmed yet (the server keeps asking)
//   not_paid        the window was closed, the payment failed, or the 15 minutes ended
//   refunded        a payment that couldn't be used went back (late, a different amount, twice)
//   refund_stuck    Razorpay refused that refund: refund it by hand in the dashboard
//   refund_by_hand  paid, then cancelled in the admin app: refunded by hand (decision 6.15 A)
import { prisma } from '../config/database.js';
import { customerOf, townOf } from './order.service.js';
import { ONLINE_METHOD_TEXT } from './invoice.service.js';
import { REFUND_STUCK_AFTER, holdOf } from './shop/checkout.service.js';
import { istDate, istTime, istRange } from '../utils/day.js';
import { resolvePeriod } from '../utils/period.js';
import { badRequest, notFound } from '../utils/errors.js';
import { PAGE_SIZE } from '../utils/page.js';

export const STATUSES = ['paid', 'confirming', 'not_paid', 'refunded', 'refund_stuck', 'refund_by_hand'];
export const STATUS_TEXT = {
  paid: 'Paid', confirming: 'Confirming', not_paid: 'Not paid', refunded: 'Refunded', refund_stuck: 'Refund stuck', refund_by_hand: 'Cancelled after paying',
};
export const METHODS = Object.keys(ONLINE_METHOD_TEXT);
const PAID_STATES = ['processing', 'shipped', 'delivered'];
const ORDER_TEXT = { pending_payment: 'Waiting for payment', processing: 'To ship', shipped: 'Shipped', delivered: 'Delivered', cancelled: 'Cancelled' };
const TRY_TEXT = { created: 'Window opened, not paid', confirming: 'Confirming with the bank', paid: 'Paid', failed: 'Failed', refunded: 'Refunded', refund_due: 'Refund waiting' };

const num = (d) => (d == null ? null : Number(d));
const iso = (d) => (d ? d.toISOString() : null);
const when = (d) => (d ? `${istDate(d)}, ${istTime(d)}` : null);

const stuckTry = { OR: [{ status: 'refund_due', refundTries: { gte: REFUND_STUCK_AFTER } }, { refundStatus: 'failed' }] };
const isStuck = (a) => (a.status === 'refund_due' && a.refundTries >= REFUND_STUCK_AFTER) || a.refundStatus === 'failed';
const hasRefund = (a) => a.status === 'refunded' || a.status === 'refund_due';

export function statusOf(o) {
  const tries = o.attempts || [];
  if (tries.some(isStuck)) return 'refund_stuck';
  const paid = o.payment?.status === 'paid';
  if (paid && PAID_STATES.includes(o.status)) return 'paid';
  if (paid && o.status === 'cancelled') return 'refund_by_hand';
  if (tries.some(hasRefund)) return 'refunded';
  if (o.status === 'pending_payment' && tries.some((a) => a.status === 'confirming')) return 'confirming';
  return 'not_paid';
}

// The database filter for each status (the same rules as statusOf).
const WHERE = {
  paid: { payment: { is: { status: 'paid' } }, status: { in: PAID_STATES } },
  confirming: { status: 'pending_payment', attempts: { some: { status: 'confirming' } } },
  not_paid: {
    AND: [
      { OR: [{ payment: { is: null } }, { payment: { is: { status: { not: 'paid' } } } }] },
      { attempts: { none: { status: { in: ['refunded', 'refund_due', 'confirming'] } } } },
    ],
  },
  refunded: { attempts: { some: { status: { in: ['refunded', 'refund_due'] } } } },
  refund_stuck: { attempts: { some: stuckTry } },
  refund_by_hand: { payment: { is: { status: 'paid' } }, status: 'cancelled' },
};
// Every website order that reached Razorpay (the old website's too: a Payment row, no tries).
const BASE = { channel: 'online', OR: [{ attempts: { some: {} } }, { payment: { isNot: null } }] };

const INCLUDE = {
  payment: true,
  attempts: { orderBy: { createdAt: 'desc' } },
  items: { select: { quantity: true, imageSnapshot: true } },
  authAccount: { select: { phone: true, email: true, userProfile: { select: { firstName: true, lastName: true } } } },
};

// A search: an order number, a Razorpay id, a mobile number, or a customer's name.
async function searchWhere(q) {
  const t = q.trim();
  if (!t) return null;
  if (/^nh\d+$/i.test(t)) return { orderNumber: { startsWith: t.toUpperCase() } };
  if (/^(pay|order)_[A-Za-z0-9]+$/.test(t)) {
    return { OR: [{ payment: { is: { OR: [{ razorpayPaymentId: t }, { razorpayOrderId: t }] } } }, { attempts: { some: { OR: [{ razorpayPaymentId: t }, { razorpayOrderId: t }] } } }] };
  }
  const digits = t.replace(/\D/g, '');
  const rows = digits.length >= 4 && digits.length === t.replace(/[\s+-]/g, '').length
    ? await prisma.$queryRaw`SELECT o.id FROM "Order" o LEFT JOIN "AuthAccount" a ON a.id = o."authAccountId" WHERE o.channel = 'online' AND (o."shippingAddress"->>'phone' LIKE ${`%${digits.slice(-10)}%`} OR a.phone LIKE ${`%${digits.slice(-10)}%`}) LIMIT 500`
    : await prisma.$queryRaw`SELECT o.id FROM "Order" o WHERE o.channel = 'online' AND o."shippingAddress"->>'fullName' ILIKE ${`%${t.replace(/[%_\\]/g, '')}%`} LIMIT 500`;
  return { id: { in: rows.map((r) => r.id) } };
}

function periodWhere({ period, from, to }, now) {
  if (period === 'all') return null;
  let r;
  try {
    r = resolvePeriod({ period, from, to }, now).range;
  } catch (err) {
    throw badRequest('BAD_PERIOD', err.message);
  }
  const span = istRange(r.from, r.to);
  return { placedAt: { gte: span.from, lte: span.to } };
}

const methodWhere = (method) => (method && method !== 'all' ? { OR: [{ payment: { is: { method } } }, { attempts: { some: { method } } }] } : null);
const and = (...parts) => ({ AND: parts.filter(Boolean) });

function refundOf(o) {
  const a = (o.attempts || []).find(hasRefund) || (o.attempts || []).find((x) => x.refundStatus === 'failed');
  if (!a) return null;
  return {
    amount: num(a.amount),
    state: isStuck(a) ? 'stuck' : a.status === 'refund_due' ? 'waiting' : a.refundStatus === 'processed' ? 'processed' : 'started',
    reason: a.refundReason,
    error: a.refundError,
    refundId: a.refundId,
  };
}
const methodOf = (o) => o.payment?.method || (o.attempts || []).find((a) => a.method)?.method || null;

function presentRow(o) {
  const status = statusOf(o);
  const c = customerOf(o);
  const method = methodOf(o);
  return {
    id: o.id,
    number: o.orderNumber,
    status,
    statusText: STATUS_TEXT[status],
    orderStatus: o.status,
    total: num(o.total),
    method,
    methodText: ONLINE_METHOD_TEXT[method] ?? null,
    customer: c.name,
    mobile: c.mobile,
    town: townOf(o),
    sarees: o.items.reduce((n, it) => n + it.quantity, 0),
    imageUrl: o.items.find((it) => it.imageSnapshot)?.imageSnapshot ?? null,
    placedAt: iso(o.placedAt),
    when: when(o.placedAt),
    paidAt: iso(o.payment?.status === 'paid' ? o.payment.capturedAt || o.payment.updatedAt : null),
    tries: (o.attempts || []).length,
    refund: refundOf(o),
  };
}

// The list. filters: { status: 'all' | one of STATUSES, period, from, to, method, q }.
export async function listPayments({ status = 'all', period = 'all', from, to, method = 'all', q = '', offset = 0, limit = PAGE_SIZE }, now = new Date()) {
  const common = and(BASE, periodWhere({ period, from, to }, now), methodWhere(method), await searchWhere(q));
  const where = status === 'all' ? common : and(common, WHERE[status]);
  const [rows, total, paid, refunded, counts] = await Promise.all([
    prisma.order.findMany({ where, include: INCLUDE, orderBy: [{ placedAt: 'desc' }, { id: 'desc' }], skip: offset, take: limit }),
    prisma.order.count({ where }),
    prisma.order.aggregate({ where: and(where, WHERE.paid), _sum: { total: true }, _count: { _all: true } }),
    prisma.paymentAttempt.aggregate({ where: { status: { in: ['refunded', 'refund_due'] }, order: where }, _sum: { amount: true }, _count: { _all: true } }),
    Promise.all(STATUSES.map(async (s) => [s, await prisma.order.count({ where: and(common, WHERE[s]) })])),
  ]);
  return {
    payments: rows.map(presentRow),
    nextOffset: offset + rows.length < total ? offset + rows.length : null,
    total,
    totals: { paid: num(paid._sum.total) ?? 0, paidCount: paid._count._all, refunded: num(refunded._sum.amount) ?? 0, refundedCount: refunded._count._all },
    counts: Object.fromEntries(counts),
    period: period === 'all' ? null : resolvePeriod({ period, from, to }, now).range,
  };
}

// One payment's whole story.
export async function getPayment(number) {
  const o = await prisma.order.findFirst({
    where: { orderNumber: number, channel: 'online' },
    include: {
      ...INCLUDE,
      attempts: { orderBy: { createdAt: 'asc' } },
      items: { orderBy: [{ lineNo: { sort: 'asc', nulls: 'last' } }, { id: 'asc' }], include: { product: { select: { sku: true } } } },
      reservations: true,
      invoice: { select: { invoiceNumber: true } },
      shipment: { select: { status: true, awbNumber: true, carrier: true } },
    },
  });
  if (!o) throw notFound('PAYMENT_NOT_FOUND', 'We couldn\'t find this online order.');
  const row = presentRow(o);
  const ids = o.attempts.map((a) => a.razorpayOrderId).concat(o.payment?.razorpayOrderId ? [o.payment.razorpayOrderId] : []);
  const events = ids.length ? await prisma.paymentEvent.findMany({ where: { razorpayOrderId: { in: [...new Set(ids)] } }, orderBy: { receivedAt: 'asc' } }) : [];
  const hold = o.status === 'pending_payment' ? holdOf(o) : null;
  // Merge identical items (one line per piece) into one line per saree.
  const lines = new Map();
  for (const it of o.items) {
    const l = lines.get(it.productId) || { name: it.nameSnapshot, sku: it.product?.sku ?? null, imageUrl: it.imageSnapshot, price: num(it.priceSnapshot), quantity: 0 };
    l.quantity += it.quantity;
    lines.set(it.productId, l);
  }
  return {
    payment: {
      ...row,
      orderStatusText: ORDER_TEXT[o.status] ?? o.status,
      customer: customerOf(o),
      items: [...lines.values()],
      invoiceNumber: o.invoice?.invoiceNumber ?? null,
      razorpayPaymentId: o.payment?.status === 'paid' ? o.payment.razorpayPaymentId : null,
      razorpayOrderId: o.payment?.razorpayOrderId ?? null,
      hold: hold ? { held: hold.held, until: iso(hold.until), untilText: hold.until ? istTime(hold.until) : null } : null,
      cancelReason: o.cancelReason,
      canOpenOrder: o.status !== 'pending_payment',
      tries: o.attempts.map((a) => ({
        razorpayOrderId: a.razorpayOrderId,
        status: a.status,
        statusText: a.status === 'failed' && a.failureReason ? `Failed: ${a.failureReason}` : TRY_TEXT[a.status] ?? a.status,
        amount: num(a.amount),
        method: a.method,
        methodText: ONLINE_METHOD_TEXT[a.method] ?? null,
        paymentId: a.razorpayPaymentId,
        when: when(a.createdAt),
        paidWhen: when(a.capturedAt),
        refund: hasRefund(a) || a.refundStatus ? {
          amount: num(a.amount), reason: a.refundReason, refundId: a.refundId, state: isStuck(a) ? 'stuck' : a.status === 'refund_due' ? 'waiting' : a.refundStatus || 'started',
          tries: a.refundTries, error: a.refundError, when: when(a.refundedAt),
        } : null,
      })),
      notices: events.map((e) => ({ type: e.type, result: e.result, when: when(e.receivedAt) })),
    },
  };
}
