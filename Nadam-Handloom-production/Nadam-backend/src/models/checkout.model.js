// Website W6: the queries behind checkout and payment. A website order is an Order with
// channel "online"; its sarees are held by Reservation rows while the customer pays.
import { prisma } from '../config/database.js';

// One checkout at a time per customer (two tabs pressing Pay), and one change at a time per
// order (the page, Razorpay's notice and the hold sweep can all reach it at once).
export const lockCheckout = (accountId, db) => db.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`shop-checkout:${accountId}`}))`;
export const lockOrder = (orderId, db) => db.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`shop-order:${orderId}`}))`;

export const ORDER_INCLUDE = {
  items: { orderBy: [{ lineNo: { sort: 'asc', nulls: 'last' } }, { id: 'asc' }], include: { product: { select: { slug: true, sku: true } } } },
  reservations: true,
  payment: true,
  attempts: { orderBy: { createdAt: 'desc' } },
  invoice: { select: { id: true, invoiceNumber: true, storageKey: true, cancelledAt: true } },
  shipment: { select: { status: true, carrier: true, awbNumber: true, shippedAt: true, deliveredAt: true } },
};

export const findOwn = (orderNumber, authAccountId, db = prisma) =>
  db.order.findFirst({ where: { orderNumber, authAccountId, channel: 'online' }, include: ORDER_INCLUDE });

export const findById = (id, db = prisma) => db.order.findUnique({ where: { id }, include: ORDER_INCLUDE });

// My orders (W7, rule 2): the customer's website orders that were paid (being packed, shipped,
// delivered, cancelled by the shop after paying), refunded, being confirmed with the bank, or a
// checkout whose sarees are still held. Never a checkout that ended without a payment.
export const shownWhere = (authAccountId, now) => ({
  authAccountId,
  channel: 'online',
  OR: [
    { payment: { is: { status: 'paid' } } },
    { attempts: { some: { status: { in: ['refunded', 'refund_due'] } } } },
    { status: 'pending_payment', attempts: { some: { status: 'confirming' } } },
    { status: 'pending_payment', reservations: { some: {}, every: { status: 'active', expiresAt: { gt: now } } } },
  ],
});

// Newest first; `take` one more than a page tells whether there is another.
export const listOwn = (authAccountId, { now, skip = 0, take = 20 }, db = prisma) =>
  db.order.findMany({ where: shownWhere(authAccountId, now), include: ORDER_INCLUDE, orderBy: [{ placedAt: 'desc' }, { id: 'desc' }], skip, take });

// Razorpay's notices of refunds the owners made by hand in its dashboard (an order cancelled
// in the admin app after paying, W6 6.15 A): paymentId → when the refund went through.
export async function handRefunds(paymentIds, db = prisma) {
  const ids = [...new Set(paymentIds.filter(Boolean))];
  if (!ids.length) return new Map();
  const rows = await db.paymentEvent.findMany({ where: { type: 'refund.processed', razorpayPaymentId: { in: ids } }, orderBy: { receivedAt: 'asc' }, select: { razorpayPaymentId: true, receivedAt: true } });
  const out = new Map();
  for (const r of rows) if (!out.has(r.razorpayPaymentId)) out.set(r.razorpayPaymentId, r.receivedAt); // the first one
  return out;
}

export const openCheckouts = (authAccountId, db = prisma) =>
  db.order.findMany({ where: { authAccountId, channel: 'online', status: 'pending_payment' }, include: ORDER_INCLUDE, orderBy: { placedAt: 'desc' } });

export const attemptByRazorpayOrder = (razorpayOrderId, db = prisma) => db.paymentAttempt.findUnique({ where: { razorpayOrderId } });

// An order made by the old website (/api/v1): it has a Payment row but no attempts.
export const paymentByRazorpayOrder = (razorpayOrderId, db = prisma) => db.payment.findUnique({ where: { razorpayOrderId } });

/* ---------- For the background jobs ---------- */
export const expiredHolds = (now, take = 200, db = prisma) =>
  db.reservation.findMany({ where: { status: 'active', expiresAt: { lte: now } }, select: { orderId: true }, distinct: ['orderId'], take });

export const attemptsToCheck = (now, db = prisma) => db.paymentAttempt.findMany({
  where: {
    OR: [
      // The page said paid but Razorpay hadn't confirmed: every minute, for up to 3 days.
      { status: 'confirming' },
      // A payment request not known to be paid (the window closed, a try failed, the page never
      // came back): looked at again every 5 minutes for 2 hours, in case a payment went through
      // and its notice was lost. A retry after a failed try is the same request.
      {
        status: { in: ['created', 'failed'] },
        createdAt: { lte: new Date(now.getTime() - 3 * 60_000), gte: new Date(now.getTime() - 2 * 3600_000) },
        OR: [{ lastCheckedAt: null }, { lastCheckedAt: { lte: new Date(now.getTime() - 5 * 60_000) } }],
      },
      // A refund that couldn't be started: tried again when its wait is over.
      { status: 'refund_due', OR: [{ nextRefundAt: null }, { nextRefundAt: { lte: now } }] },
    ],
  },
  orderBy: { updatedAt: 'asc' },
  take: 50,
});

export const paidWithoutInvoice = (since, db = prisma) => db.order.findMany({
  where: { channel: 'online', status: { in: ['processing', 'shipped', 'delivered'] }, invoice: { is: null }, payment: { is: { status: 'paid' } }, placedAt: { gte: since } },
  select: { id: true },
  take: 20,
});
