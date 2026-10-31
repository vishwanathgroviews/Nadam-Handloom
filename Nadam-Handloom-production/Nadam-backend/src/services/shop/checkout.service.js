// Website W6: checkout and payment with Razorpay (docs/modules/web-04-checkout.md).
//
// - Pay makes an order from the account's bag ("waiting for payment"), holds each saree for
//   15 minutes (piece → reserved) and asks Razorpay for a payment request for the exact total.
// - A payment counts only after Razorpay's own record says it was captured, for this amount,
//   in rupees, on our payment request. The page's receipt (signature) alone is never enough.
// - A payment completes an order that still holds its sarees. Paid after the hold ended or
//   after the checkout was cancelled: the sarees are claimed again if every one is still in
//   stock, otherwise the whole payment is refunded automatically. A saree never sells twice.
// - Razorpay's notices (webhook) and a background check complete payments the page missed.
import crypto from 'node:crypto';
import { prisma } from '../../config/database.js';
import { env } from '../../config/env.js';
import { PAYMENTS } from '../../config/constants.js';
import * as Bag from '../../models/bag.model.js';
import * as Address from '../../models/address.model.js';
import * as C from '../../models/checkout.model.js';
import * as Customer from '../../models/customer.model.js';
import { newOrderNumber } from '../../models/sale.model.js';
import { listedWhere } from './visibility.js';
import { presentLine, present as presentBag } from './bag.service.js';
import { fullNameOf } from './present.js';
import { addressProblem } from './addressCheck.js';
import { gateway } from '../payments/index.js';
import { paymentSignatureOk, webhookSignatureOk } from '../payments/signature.js';
import { ensureInvoice, ONLINE_METHOD_TEXT } from '../invoice.service.js';
import { notifyCustomer } from './push.service.js';
import { shopAudit } from '../audit.service.js';
import { alertOwners, alertFor } from '../ownerAlerts.service.js';
import { DTDC_TRACKING_URL } from '../order.service.js';
import { canPayOnline } from './paymentAccess.js';
import { normalizeMobile } from '../../utils/phone.js';
import { badRequest, conflict, notFound, unauthorized, unavailable } from '../../utils/errors.js';

const MIN = 60_000;
const TX = { timeout: 20_000, maxWait: 10_000 };
const paise = (v) => Math.round(Number(v) * 100);
const money = (v) => `₹${Math.round(Number(v)).toLocaleString('en-IN')}`;

const paymentsOff = () => unavailable('PAYMENTS_OFF', 'Online payment isn\'t open yet. Please order on WhatsApp, or try again soon.');
const orderNotFound = () => notFound('ORDER_NOT_FOUND', 'We couldn\'t find this order.');
const holdEnded = () => conflict('HOLD_ENDED', 'The 15 minutes are over and your sarees were released. Check your bag again.');
// Paid (another tab, Razorpay's notice) or ended while a new payment was being opened.
const closedMeanwhile = (order, now) => (order.payment?.status === 'paid'
  ? conflict('ORDER_PAID', 'This order is already paid.', { order: presentOrder(order, now) })
  : holdEnded());
const tooLarge = () => conflict('ORDER_TOO_LARGE', `Orders above ${money(env.payments.maxAmount)} can't be paid online in one go. Please order on WhatsApp and we'll help you pay.`, { maxAmount: env.payments.maxAmount });

/* ---------- The address ---------- */
export { addressProblem };
const snapshot = (a) => ({
  fullName: a.fullName.trim(), phone: normalizeMobile(a.phone), line1: a.line1.trim(), line2: a.line2?.trim() || null,
  landmark: a.landmark?.trim() || null, city: a.city.trim(), state: a.state, pincode: a.pincode, country: 'India',
});

/* ---------- The hold ---------- */
export function holdOf(order, now = new Date()) {
  const rs = order.reservations || [];
  if (!rs.length) return { held: false, until: null };
  const until = rs.reduce((m, r) => (r.expiresAt < m ? r.expiresAt : m), rs[0].expiresAt);
  return { held: rs.every((r) => r.status === 'active') && until > now, until };
}
const renewedUntil = (order, now) => new Date(Math.min(now.getTime() + PAYMENTS.HOLD_MINUTES * MIN, order.placedAt.getTime() + PAYMENTS.MAX_HOLD_MINUTES * MIN));

// Puts every saree an order still holds back in stock. reason: released | expired.
async function releaseHolds(tx, order, reason, actorId = null) {
  for (const r of order.reservations.filter((x) => x.status === 'active')) {
    const done = await tx.reservation.updateMany({ where: { id: r.id, status: 'active' }, data: { status: reason } });
    if (!done.count) continue;
    if (r.pieceId) await tx.piece.updateMany({ where: { id: r.pieceId, status: 'reserved' }, data: { status: 'in_stock' } });
    else await tx.product.update({ where: { id: r.productId }, data: { stock: { increment: r.quantity } } });
    await tx.stockLedger.create({ data: { productId: r.productId, pieceId: r.pieceId, delta: r.quantity, reason: 'release', channel: 'online', actorId, ref: order.orderNumber } });
  }
}

/* ---------- What the page sees ---------- */
// The customer's view of an order: waiting for payment (with the hold), confirming, paid
// (and later shipped, delivered), refunded, cancelled by the shop after paying (W7: the owners
// refund it in Razorpay, 6.15 A), or a checkout that ended without a payment (cancelled).
export function customerStatus(order, now = new Date()) {
  const attempts = order.attempts || [];
  const paid = order.payment?.status === 'paid';
  if (['processing', 'shipped', 'delivered'].includes(order.status) && paid) return order.status === 'processing' ? 'paid' : order.status;
  if (order.status === 'pending_payment') {
    if (attempts.some((a) => a.status === 'confirming')) return 'confirming';
    return holdOf(order, now).held ? 'awaiting_payment' : 'hold_ended';
  }
  // Cancelled by the shop after paying comes first: a refunded second payment on the same order
  // must not hide that the main payment is still to be refunded by the owners.
  if (order.status === 'cancelled' && paid) return 'cancelled_paid';
  if (attempts.some((a) => ['refunded', 'refund_due'].includes(a.status))) return 'refunded';
  return 'cancelled';
}

const iso = (d) => (d ? d.toISOString() : null);
// W7 7.7: what Buy again is offered on (an order still being paid for isn't one).
export const BUY_AGAIN = new Set(['paid', 'shipped', 'delivered', 'refunded', 'cancelled_paid']);

// handRefundAt: when Razorpay said the owners' refund of a shop-cancelled order went through.
export function presentOrder(order, now = new Date(), { handRefundAt = null } = {}) {
  const lines = new Map();
  for (const it of order.items) {
    const key = it.productId;
    const l = lines.get(key) || { slug: it.product?.slug ?? null, sku: it.product?.sku ?? null, name: it.nameSnapshot, photo: it.imageSnapshot, price: Math.round(Number(it.priceSnapshot)), quantity: 0 };
    l.quantity += it.quantity;
    lines.set(key, l);
  }
  const status = customerStatus(order, now);
  const hold = holdOf(order, now);
  const paid = order.payment?.status === 'paid';
  const refunded = (order.attempts || []).find((a) => ['refunded', 'refund_due'].includes(a.status));
  const a = order.shippingAddress || {};
  const sh = order.shipment;
  const shipped = paid && (order.status === 'shipped' || order.status === 'delivered');
  const carrier = sh?.carrier || 'DTDC';
  const list = [...lines.values()].map((l) => ({ ...l, lineTotal: l.price * l.quantity }));
  // The address is always the copy kept on the order (W7 rule 3), never the saved one.
  return {
    number: order.orderNumber,
    status,
    placedAt: order.placedAt.toISOString(),
    total: Math.round(Number(order.total)),
    pieces: list.reduce((n, l) => n + l.quantity, 0),
    lines: list,
    address: { fullName: a.fullName, mobile: a.phone, line1: a.line1, line2: a.line2 || null, landmark: a.landmark || null, city: a.city, state: a.state, pincode: a.pincode },
    holdUntil: status === 'awaiting_payment' ? hold.until.toISOString() : null,
    canPay: status === 'awaiting_payment',
    payment: paid ? { method: order.payment.method, methodText: ONLINE_METHOD_TEXT[order.payment.method] ?? 'Online', paidAt: (order.payment.capturedAt || order.payment.updatedAt).toISOString() } : null,
    refund: refunded ? { amount: Math.round(Number(refunded.amount)), status: refunded.refundStatus || 'pending', reason: refunded.refundReason } : null,
    // The reason the shop typed in the admin app is the shop's own note: not shown here.
    cancelled: status === 'cancelled_paid' ? { at: iso(order.cancelledAt), refundedAt: iso(handRefundAt) } : null,
    // W7 7.6 A: downloaded through our server (GET /orders/:number/invoice), never its stored
    // address. Made within a minute of paying; until then "being made".
    invoice: paid ? { number: order.invoice?.invoiceNumber ?? null, ready: !!order.invoice, cancelled: status === 'cancelled_paid' || !!order.invoice?.cancelledAt } : null,
    // W7 rule 4: once the shop has shipped it in the admin app.
    shipping: shipped ? {
      status: order.status, carrier, trackingNumber: sh?.awbNumber ?? null, shippedAt: iso(sh?.shippedAt), deliveredAt: iso(sh?.deliveredAt),
      trackingUrl: carrier.toUpperCase() === 'DTDC' ? DTDC_TRACKING_URL : null,
    } : null,
    canBuyAgain: BUY_AGAIN.has(status) && list.some((l) => l.slug),
    // Paid on the old website (it kept a payment, not our payment tries).
    oldWebsite: !!order.payment && !(order.attempts || []).length,
  };
}

/* ---------- Pay ---------- */
// The bag as it is now: lines that can be bought (fewer left lowers the saved number, once).
async function bagNow(accountId, tx) {
  const rows = await Bag.rowsFor(accountId, tx);
  const listed = await Bag.listedIds(rows.map((r) => r.productId), listedWhere(), tx);
  const mine = await Bag.heldFor(accountId, tx); // released below when this checkout replaces it
  const out = [];
  for (const r of rows) {
    const line = presentLine(r.product, { listed: listed.has(r.productId), asked: r.quantity, priceSeen: r.priceSeen, mine: mine.get(r.productId) ?? 0 });
    if (line.state === 'fewer') await Bag.setQuantity(r.id, line.quantity, tx);
    out.push({ row: r, line });
  }
  return out;
}
const signature = (pairs) => pairs.map((p) => `${p.slug}:${p.quantity}:${p.price}`).sort().join('|');
function orderSignature(order) {
  const m = new Map();
  for (const it of order.items) {
    const l = m.get(it.productId) || { slug: it.product?.slug, quantity: 0, price: Math.round(Number(it.priceSnapshot)) };
    l.quantity += it.quantity;
    m.set(it.productId, l);
  }
  return signature([...m.values()]);
}

// Holds `quantity` pieces of one saree for the order: tagged pieces first, then the old
// stock counter. Returns the order lines, or null when the stock is no longer there.
async function holdLine(tx, { order, row, line, expiresAt, lineNo }) {
  const productId = row.productId;
  const candidates = await tx.piece.findMany({ where: { productId, status: 'in_stock' }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], select: { id: true }, take: line.quantity + 10 });
  const pieces = [];
  for (const c of candidates) {
    if (pieces.length === line.quantity) break;
    const r = await tx.piece.updateMany({ where: { id: c.id, status: 'in_stock' }, data: { status: 'reserved' } });
    if (r.count) pieces.push(c.id);
  }
  let fromCounter = 0;
  if (pieces.length < line.quantity) {
    const rest = line.quantity - pieces.length;
    const r = await tx.product.updateMany({ where: { id: productId, stock: { gte: rest } }, data: { stock: { decrement: rest } } });
    if (r.count) fromCounter = rest;
  }
  if (pieces.length + fromCounter < line.quantity) return null;
  const base = { orderId: order.id, productId, nameSnapshot: line.name, priceSnapshot: line.price, imageSnapshot: line.photo?.url ?? null };
  let n = lineNo;
  for (const pieceId of pieces) {
    await tx.orderItem.create({ data: { ...base, pieceId, quantity: 1, lineNo: n } });
    n += 1;
    await tx.reservation.create({ data: { productId, pieceId, quantity: 1, orderId: order.id, expiresAt, status: 'active' } });
    await tx.stockLedger.create({ data: { productId, pieceId, delta: -1, reason: 'reserve', channel: 'online', ref: order.orderNumber } });
  }
  if (fromCounter) {
    await tx.orderItem.create({ data: { ...base, quantity: fromCounter, lineNo: n } });
    n += 1;
    await tx.reservation.create({ data: { productId, quantity: fromCounter, orderId: order.id, expiresAt, status: 'active' } });
    await tx.stockLedger.create({ data: { productId, delta: -fromCounter, reason: 'reserve', channel: 'online', ref: order.orderNumber } });
  }
  return n;
}

class StockGone extends Error {}

// What the page needs to open Razorpay's window for one payment request.
async function openPayment(order, account, now = new Date()) {
  let rz;
  try {
    rz = await gateway().createOrder({
      amountPaise: paise(order.total),
      receipt: order.orderNumber,
      notes: { orderId: order.id, orderNumber: order.orderNumber, source: 'nandamhandlooms.com' },
      captureMinutes: PAYMENTS.CAPTURE_MINUTES,
    });
  } catch (err) {
    console.error(`[checkout] Razorpay order for ${order.orderNumber} failed: ${err.message}`);
    // Razorpay's own limit on the account, lower than ours: say so instead of "try again".
    if (err.status === 400 && /amount/i.test(err.message)) return { tooLarge: true };
    return null;
  }
  // The order may have been paid (another tab, Razorpay's notice) or its hold may have ended
  // while Razorpay was asked: then no new payment request is put on it, and a paid payment is
  // never marked "created" again. (Razorpay's unused request simply expires.)
  const opened = await prisma.$transaction(async (tx) => {
    await C.lockOrder(order.id, tx);
    const cur = await C.findById(order.id, tx);
    if (cur.status !== 'pending_payment' || cur.payment?.status === 'paid' || !holdOf(cur, now).held) return false;
    await tx.paymentAttempt.create({ data: { orderId: order.id, razorpayOrderId: rz.id, amount: order.total } });
    await tx.payment.upsert({
      where: { orderId: order.id },
      create: { orderId: order.id, provider: 'razorpay', razorpayOrderId: rz.id, amount: order.total, status: 'created' },
      update: { razorpayOrderId: rz.id, status: 'created' },
    });
    return true;
  }, TX);
  const fresh = await C.findById(order.id);
  if (!opened) return { closed: true, order: fresh };
  const until = holdOf(fresh, now).until;
  return {
    order: presentOrder(fresh, now),
    razorpay: {
      keyId: env.payments.keyId,
      mode: env.payments.mode,
      orderId: rz.id,
      amount: paise(order.total),
      currency: 'INR',
      name: env.company.name,
      description: `Order ${order.orderNumber}`,
      prefill: { name: fullNameOf(account) || order.shippingAddress?.fullName || '', email: account.email || '', contact: `+91${account.phone || order.shippingAddress?.phone || ''}` },
      notes: { orderNumber: order.orderNumber },
      // Razorpay's window closes itself when the hold ends.
      timeoutSeconds: Math.max(60, Math.floor((until.getTime() - now.getTime()) / 1000)),
    },
  };
}

// Pay: an order from the bag, the sarees held, and a payment request. `expect` is what the
// page showed (the total and each line); anything different → BAG_CHANGED with the bag now.
export async function checkout({ accountId, addressId, expect, ctx }) {
  if (!env.payments.enabled) throw paymentsOff();
  const account = await Customer.findById(accountId);
  if (!canPayOnline(account)) throw paymentsOff();
  const address = await Address.findOwn(accountId, addressId);
  if (!address) throw notFound('ADDRESS_NOT_FOUND', 'Choose a delivery address.');
  const problem = addressProblem(address);
  if (problem) throw badRequest('ADDRESS_INVALID', `Please check this address: ${problem.message.charAt(0).toLowerCase()}${problem.message.slice(1)}`, { field: problem.field, addressId });
  const now = new Date();

  const result = await prisma.$transaction(async (tx) => {
    await C.lockCheckout(accountId, tx);
    await Bag.lockFor(accountId, tx);
    const bag = await bagNow(accountId, tx);
    const buy = bag.filter((b) => b.line.quantity > 0);
    if (!buy.length) return { empty: true, bag };
    if (buy.length > PAYMENTS.MAX_LINES) return { changed: true, bag };
    const total = buy.reduce((n, b) => n + b.line.lineTotal, 0);
    const sig = signature(buy.map((b) => ({ slug: b.line.slug, quantity: b.line.quantity, price: b.line.price })));
    if (!expect || expect.amount !== total || signature(expect.lines) !== sig) {
      await Bag.acknowledgePrices(accountId, tx); // the page shows today's prices next
      return { changed: true, bag };
    }
    if (total > env.payments.maxAmount) return { tooLarge: true }; // nothing held
    // One open checkout per customer: the same sarees still held → reuse it; anything else
    // earlier is cancelled and its sarees released.
    let reuse = null;
    for (const listed of await C.openCheckouts(accountId, tx)) {
      await C.lockOrder(listed.id, tx);
      const open = await C.findById(listed.id, tx); // as it is now: paid or ended a moment ago?
      if (open.status !== 'pending_payment') continue;
      const sameAndHeld = !reuse && orderSignature(open) === sig && holdOf(open, now).held && now < new Date(open.placedAt.getTime() + PAYMENTS.MAX_HOLD_MINUTES * MIN - MIN);
      if (sameAndHeld && open.addressId === address.id) { reuse = open; continue; }
      await releaseHolds(tx, open, 'released');
      await tx.order.updateMany({ where: { id: open.id, status: 'pending_payment' }, data: { status: 'cancelled', cancelledAt: now, cancelReason: 'Replaced by a newer checkout' } });
    }
    if (reuse) {
      const until = renewedUntil(reuse, now);
      await tx.reservation.updateMany({ where: { orderId: reuse.id, status: 'active' }, data: { expiresAt: until } });
      return { order: reuse, reused: true };
    }
    const orderNumber = await newOrderNumber(tx);
    const order = await tx.order.create({
      data: {
        orderNumber, authAccountId: accountId, addressId: address.id, channel: 'online', status: 'pending_payment',
        subtotal: total, total, shippingAddress: snapshot(address), invoiceRequired: true,
      },
    });
    const expiresAt = new Date(now.getTime() + PAYMENTS.HOLD_MINUTES * MIN);
    let lineNo = 1;
    for (const b of buy) {
      lineNo = await holdLine(tx, { order, row: b.row, line: b.line, expiresAt, lineNo });
      if (lineNo === null) throw new StockGone(); // sold a moment ago: nothing is kept
    }
    return { order };
  }, TX).catch(async (err) => {
    if (err instanceof StockGone) return { changed: true, bag: null };
    throw err;
  });

  if (result.tooLarge) throw tooLarge();
  if (result.empty) throw conflict('BAG_EMPTY', 'Your bag has nothing that can be bought now.', { bag: presentBag(result.bag.map((b) => b.line)) });
  if (result.changed) {
    const bag = result.bag ?? (await prisma.$transaction(async (tx) => bagNow(accountId, tx)));
    throw conflict('BAG_CHANGED', 'Something in your bag changed just now. Check it, then pay.', { bag: presentBag(bag.map((b) => b.line)) });
  }
  const opened = await openPayment(result.order, account, now);
  if (opened?.tooLarge) {
    await abandon(result.order.id, 'Above Razorpay\'s limit for one payment');
    throw tooLarge();
  }
  if (opened?.closed) throw closedMeanwhile(opened.order, now);
  if (!opened) {
    if (!result.reused) await abandon(result.order.id, 'Our payment service could not be reached');
    throw unavailable('PAYMENTS_UNAVAILABLE', 'We couldn\'t open the payment just now. Nothing was charged. Please try again in a minute.');
  }
  if (!result.reused) await shopAudit('shop_checkout_started', { accountId, ctx, metadata: { orderNumber: result.order.orderNumber, total: Number(result.order.total) } });
  return opened;
}

// Pay again (after closing the window or a failed payment): a fresh payment request and a
// fresh 15 minutes, while the sarees are still held (30 minutes in all at most).
export async function payAgain({ accountId, number }) {
  if (!env.payments.enabled) throw paymentsOff();
  const account = await Customer.findById(accountId);
  if (!canPayOnline(account)) throw paymentsOff();
  const now = new Date();
  const order = await prisma.$transaction(async (tx) => {
    const o = await C.findOwn(number, accountId, tx);
    if (!o) throw orderNotFound();
    await C.lockOrder(o.id, tx);
    const fresh = await C.findById(o.id, tx);
    if (fresh.payment?.status === 'paid') throw conflict('ORDER_PAID', 'This order is already paid.', { order: presentOrder(fresh, now) });
    if (fresh.status !== 'pending_payment' || !holdOf(fresh, now).held) throw holdEnded();
    if (now >= new Date(fresh.placedAt.getTime() + PAYMENTS.MAX_HOLD_MINUTES * MIN - MIN)) throw holdEnded();
    await tx.reservation.updateMany({ where: { orderId: fresh.id, status: 'active' }, data: { expiresAt: renewedUntil(fresh, now) } });
    return fresh;
  }, TX);
  const opened = await openPayment(order, account, now);
  if (opened?.tooLarge) throw tooLarge();
  if (opened?.closed) throw closedMeanwhile(opened.order, now);
  if (!opened) throw unavailable('PAYMENTS_UNAVAILABLE', 'We couldn\'t open the payment just now. Nothing was charged. Please try again in a minute.');
  return opened;
}

// "Change my bag": the checkout ends and its sarees go back on sale. A payment that still
// arrives is handled like any late payment.
export async function cancelCheckout({ accountId, number, ctx }) {
  const now = new Date();
  const order = await prisma.$transaction(async (tx) => {
    const o = await C.findOwn(number, accountId, tx);
    if (!o) throw orderNotFound();
    await C.lockOrder(o.id, tx);
    const fresh = await C.findById(o.id, tx);
    if (fresh.status !== 'pending_payment') return fresh;
    await releaseHolds(tx, fresh, 'released');
    await tx.order.updateMany({ where: { id: fresh.id, status: 'pending_payment' }, data: { status: 'cancelled', cancelledAt: now, cancelReason: 'The customer went back to change the bag' } });
    return C.findById(fresh.id, tx);
  }, TX);
  await shopAudit('shop_checkout_cancelled', { accountId, ctx, metadata: { orderNumber: order.orderNumber } });
  return { order: presentOrder(order, now) };
}

export async function getOrder({ accountId, number }) {
  const order = await C.findOwn(number, accountId);
  if (!order) throw orderNotFound();
  const now = new Date();
  const refunds = customerStatus(order, now) === 'cancelled_paid' ? await C.handRefunds([order.payment?.razorpayPaymentId]) : new Map();
  return { order: presentOrder(order, now, { handRefundAt: refunds.get(order.payment?.razorpayPaymentId) ?? null }) };
}

/* ---------- Checking a payment ---------- */
// The page's receipt after paying: signature first, then Razorpay's own record.
export async function verify({ accountId, number, razorpayOrderId, razorpayPaymentId, razorpaySignature, ctx }) {
  const order = await C.findOwn(number, accountId);
  if (!order) throw orderNotFound();
  const attempt = order.attempts.find((a) => a.razorpayOrderId === razorpayOrderId);
  if (!attempt) throw badRequest('PAYMENT_NOT_FOUND', 'This payment isn\'t for this order.');
  if (!paymentSignatureOk({ razorpayOrderId: attempt.razorpayOrderId, razorpayPaymentId, signature: razorpaySignature, secret: env.payments.keySecret })) {
    await shopAudit('shop_payment_signature_bad', { accountId, ctx, metadata: { orderNumber: number } });
    throw badRequest('PAYMENT_NOT_VERIFIED', 'We couldn\'t confirm this payment. If money left your account, it is safe: we confirm it with Razorpay shortly, or it is returned.');
  }
  let payment;
  try {
    payment = await gateway().fetchPayment(razorpayPaymentId);
  } catch {
    // Razorpay couldn't be asked just now: the background check and the notice finish it.
    // An earlier try of the same request may have failed: this one is still being confirmed.
    await prisma.paymentAttempt.updateMany({ where: { id: attempt.id, status: { in: ['created', 'failed'] } }, data: { status: 'confirming', razorpayPaymentId } });
    return { order: presentOrder(await C.findById(order.id)) };
  }
  await settle(attempt, payment, { signature: razorpaySignature });
  return { order: presentOrder(await C.findById(order.id)) };
}

// One payment, from the page, a notice or the background check. Never trusts the status
// alone: the order, the amount and the currency must match our payment request.
export async function settle(attempt, payment, { signature = null } = {}) {
  if (payment.order_id !== attempt.razorpayOrderId) return 'mismatch';
  const amountOk = payment.currency === 'INR' && Number(payment.amount) === paise(attempt.amount);
  if (payment.status === 'captured' && !amountOk) {
    await markRefund(attempt, payment, 'The amount paid didn\'t match the order');
    return refundNow(attempt.id);
  }
  if (!amountOk) return 'mismatch';
  if (payment.status === 'captured') return complete(attempt, payment, { signature });
  if (payment.status === 'authorized') {
    // Normally taken by itself within moments; taken here while the sarees are still held.
    const order = await C.findById(attempt.orderId);
    if (order.status === 'pending_payment' && holdOf(order).held) {
      try {
        const captured = await gateway().capturePayment(payment.id, paise(attempt.amount));
        return complete(attempt, captured, { signature });
      } catch {
        const again = await gateway().fetchPayment(payment.id).catch(() => null);
        if (again?.status === 'captured') return complete(attempt, again, { signature });
      }
    }
    await prisma.paymentAttempt.updateMany({ where: { id: attempt.id, status: { in: ['created', 'confirming'] } }, data: { status: 'confirming', razorpayPaymentId: payment.id } });
    return 'confirming';
  }
  if (payment.status === 'failed') {
    // One payment request can have several tries (Razorpay's window lets the customer try
    // again): a failed try never overrides an attempt already confirming another try's payment.
    const mine = { OR: [{ status: 'created' }, { status: 'confirming', OR: [{ razorpayPaymentId: null }, { razorpayPaymentId: payment.id }] }] };
    await prisma.paymentAttempt.updateMany({ where: { id: attempt.id, ...mine }, data: { status: 'failed', razorpayPaymentId: payment.id, method: payment.method ?? null, failureReason: (payment.error_description || 'Payment failed').slice(0, 200) } });
    return 'failed';
  }
  if (payment.status === 'refunded') {
    await prisma.paymentAttempt.updateMany({ where: { id: attempt.id, status: { in: ['created', 'confirming'] } }, data: { status: 'failed', failureReason: 'Returned by Razorpay (not taken in time)' } });
    return 'failed';
  }
  await prisma.paymentAttempt.updateMany({ where: { id: attempt.id, status: 'created' }, data: { status: 'confirming', razorpayPaymentId: payment.id } });
  return 'confirming';
}

// The money is in. Complete the order if it can be filled; otherwise refund it.
async function complete(attempt, payment, { signature }) {
  const now = new Date();
  const out = await prisma.$transaction(async (tx) => {
    await C.lockOrder(attempt.orderId, tx);
    const order = await C.findById(attempt.orderId, tx);
    const att = await tx.paymentAttempt.findUnique({ where: { id: attempt.id } });
    if (order.payment?.status === 'paid' && order.payment.razorpayPaymentId === payment.id) return { result: 'paid', already: true, order };
    // The same payment told again (the page and Razorpay's notices): nothing to do.
    if (att.status === 'paid' && att.razorpayPaymentId === payment.id) return { result: 'paid', already: true, order };
    // A second payment on a request that already paid (Razorpay normally refuses it): refunded,
    // and the paid request's record is left as it is.
    if (att.status === 'paid') return { result: 'refund-extra', order };
    if (['refunded', 'refund_due'].includes(att.status)) return { result: 'refunded', already: true, order };
    if (order.payment?.status === 'paid') return { result: 'refund', reason: 'Paid twice: this order was already paid', order };
    const held = order.status === 'pending_payment' && order.reservations.length > 0 && order.reservations.every((r) => r.status === 'active');
    if (held) {
      for (const r of order.reservations) {
        // Each hold is claimed only while it is still active: a sweep that doesn't take our lock
        // (the old server's, on the same database) may have released it a moment ago and put the
        // saree back on sale. Then the saree is taken from stock again, or the payment refunded.
        const claimed = await tx.reservation.updateMany({ where: { id: r.id, status: 'active' }, data: { status: 'converted' } });
        if (r.pieceId) {
          const ok = await tx.piece.updateMany({ where: { id: r.pieceId, status: claimed.count ? { in: ['reserved', 'in_stock'] } : 'in_stock' }, data: { status: 'sold_online', soldAt: now } });
          if (!ok.count) throw new StockGone();
        } else if (!claimed.count) {
          const ok = await tx.product.updateMany({ where: { id: r.productId, stock: { gte: r.quantity } }, data: { stock: { decrement: r.quantity } } });
          if (!ok.count) throw new StockGone();
        }
        await tx.stockLedger.create({ data: { productId: r.productId, pieceId: r.pieceId, delta: claimed.count ? 0 : -r.quantity, reason: 'online_sale', channel: 'online', ref: order.orderNumber } });
      }
    } else {
      // Paid after the hold ended, or after the checkout was cancelled: every saree must
      // still be in stock, or nothing is taken.
      for (const it of order.items) {
        if (it.pieceId) {
          const ok = await tx.piece.updateMany({ where: { id: it.pieceId, status: 'in_stock' }, data: { status: 'sold_online', soldAt: now } });
          if (!ok.count) throw new StockGone();
        } else {
          const ok = await tx.product.updateMany({ where: { id: it.productId, stock: { gte: it.quantity } }, data: { stock: { decrement: it.quantity } } });
          if (!ok.count) throw new StockGone();
        }
        await tx.stockLedger.create({ data: { productId: it.productId, pieceId: it.pieceId, delta: -it.quantity, reason: 'online_sale', channel: 'online', ref: order.orderNumber } });
      }
      await tx.reservation.updateMany({ where: { orderId: order.id, status: 'active' }, data: { status: 'converted' } });
    }
    await tx.order.update({
      where: { id: order.id },
      data: { status: 'processing', paymentMethod: payment.method ?? null, cancelledAt: null, cancelledById: null, cancelReason: null },
    });
    await tx.payment.upsert({
      where: { orderId: order.id },
      create: { orderId: order.id, provider: 'razorpay', razorpayOrderId: attempt.razorpayOrderId, razorpayPaymentId: payment.id, razorpaySignature: signature, status: 'paid', amount: order.total, method: payment.method ?? null, capturedAt: now },
      update: { razorpayOrderId: attempt.razorpayOrderId, razorpayPaymentId: payment.id, ...(signature ? { razorpaySignature: signature } : {}), status: 'paid', method: payment.method ?? null, capturedAt: now },
    });
    await tx.paymentAttempt.update({ where: { id: attempt.id }, data: { status: 'paid', razorpayPaymentId: payment.id, method: payment.method ?? null, capturedAt: now } });
    const shipment = await tx.shipment.findUnique({ where: { orderId: order.id } });
    if (!shipment) await tx.shipment.create({ data: { orderId: order.id } });
    // The sarees bought leave the customer's bag, and any other unpaid checkout of theirs
    // ends (one open checkout per customer; this payment settled it).
    if (order.authAccountId) {
      await tx.bagItem.deleteMany({ where: { authAccountId: order.authAccountId, productId: { in: [...new Set(order.items.map((i) => i.productId))] } } });
      for (const other of (await C.openCheckouts(order.authAccountId, tx)).filter((o) => o.id !== order.id)) {
        await releaseHolds(tx, other, 'released');
        await tx.order.updateMany({ where: { id: other.id, status: 'pending_payment' }, data: { status: 'cancelled', cancelledAt: now, cancelReason: `Settled by the payment of order ${order.orderNumber}` } });
      }
    }
    return { result: 'paid', order };
  }, TX).catch(async (err) => {
    if (!(err instanceof StockGone)) throw err;
    return { result: 'refund', reason: 'Paid after the sarees were sold', order: null };
  });

  if (out.result === 'paid' && !out.already) {
    await afterPaid(out.order.id);
    return 'paid';
  }
  if (out.result === 'paid' || out.result === 'refunded') return out.result;
  if (out.result === 'refund-extra') {
    try {
      await gateway().refundPayment(payment.id, { notes: { orderNumber: out.order.orderNumber, reason: 'Second payment on a paid request' } });
      await shopAudit('shop_payment_refunded', { accountId: out.order.authAccountId, metadata: { orderNumber: out.order.orderNumber, paymentId: payment.id, reason: 'Second payment on a paid request' } });
      alertOwners(alertFor.refundStarted(out.order, { amount: Number(payment.amount) / 100, refundReason: 'Paid a second time on the same request' }));
    } catch (err) {
      // Not lost: Online payments shows the order as "Refund stuck" (refund it by hand in
      // Razorpay's dashboard), and the owners are told once.
      console.error(`[checkout] could not refund a second payment ${payment.id}: ${err.message}`);
      const error = `The second payment ${payment.id} wasn't refunded: ${String(err.message || err)}`.slice(0, 300);
      const first = await prisma.paymentAttempt.updateMany({ where: { id: attempt.id, alertedAt: null }, data: { refundStatus: 'failed', refundError: error, alertedAt: new Date() } });
      if (first.count) alertOwners(alertFor.refundStuck(out.order, { amount: Number(payment.amount) / 100, refundError: error }));
      return 'refund failed';
    }
    return 'refunded';
  }
  if (!(await markRefund(attempt, payment, out.reason))) {
    const now2 = await prisma.paymentAttempt.findUnique({ where: { id: attempt.id }, select: { status: true } });
    return now2.status === 'paid' ? 'paid' : 'refunded'; // settled a moment ago (the page and a notice at once)
  }
  return refundNow(attempt.id);
}

async function afterPaid(orderId) {
  const order = await C.findById(orderId);
  try {
    await ensureInvoice(orderId, 'system');
  } catch (err) {
    console.error(`[checkout] invoice for ${order.orderNumber} not made yet (retried every minute): ${err.message}`);
  }
  if (order.authAccountId) {
    await notifyCustomer({
      accountId: order.authAccountId, type: 'order_paid', title: 'Order confirmed',
      body: `Thank you! Order ${order.orderNumber} is paid (${money(order.total)}). We pack it within 2 working days.`, link: `/order/${order.orderNumber}`,
    }).catch(() => {});
  }
  await shopAudit('shop_order_paid', { accountId: order.authAccountId, metadata: { orderNumber: order.orderNumber, total: Number(order.total), method: order.payment?.method ?? null } });
  alertOwners(alertFor.paid(order)); // the owners' phones, in the background
}

// The order can't be filled with this payment: it stays (or becomes) cancelled and the
// whole payment goes back.
// false: this attempt was settled a moment ago (paid, or its refund already decided).
async function markRefund(attempt, payment, reason) {
  const now = new Date();
  return prisma.$transaction(async (tx) => {
    await C.lockOrder(attempt.orderId, tx);
    const att = await tx.paymentAttempt.findUnique({ where: { id: attempt.id }, select: { status: true } });
    if (['paid', 'refunded', 'refund_due'].includes(att.status)) return false;
    const order = await C.findById(attempt.orderId, tx);
    if (order.payment?.status !== 'paid' && order.status !== 'cancelled') {
      await releaseHolds(tx, order, 'released');
      await tx.order.update({ where: { id: order.id }, data: { status: 'cancelled', cancelledAt: now, cancelReason: `${reason}; refunded` } });
    } else if (order.status === 'cancelled' && order.payment?.status !== 'paid') {
      await tx.order.update({ where: { id: order.id }, data: { cancelReason: `${reason}; refunded` } });
    }
    await tx.paymentAttempt.update({ where: { id: attempt.id }, data: { status: 'refund_due', razorpayPaymentId: payment.id, method: payment.method ?? null, capturedAt: now, refundReason: reason } });
    return true;
  }, TX);
}

// Starts the refund with Razorpay. Refused (for example, not enough balance on the account):
// tried again later and later (1, 5, 15, 60 minutes, then every 6 hours); after the third
// refusal the owners are told once, and Online payments shows it as "Refund stuck".
const REFUND_WAIT_MIN = [1, 5, 15, 60, 360];
export const REFUND_STUCK_AFTER = 3;
async function refundNow(attemptId) {
  const att = await prisma.paymentAttempt.findUnique({ where: { id: attemptId }, include: { order: { select: { id: true, orderNumber: true, authAccountId: true, shippingAddress: true, total: true } } } });
  if (att.status !== 'refund_due') return 'refunded';
  let r;
  try {
    r = await gateway().refundPayment(att.razorpayPaymentId, { notes: { orderNumber: att.order.orderNumber, reason: att.refundReason?.slice(0, 200) ?? '' } });
  } catch (err) {
    const tries = att.refundTries + 1;
    const wait = REFUND_WAIT_MIN[Math.min(tries - 1, REFUND_WAIT_MIN.length - 1)];
    const stuck = tries >= REFUND_STUCK_AFTER && !att.alertedAt;
    await prisma.paymentAttempt.update({
      where: { id: att.id },
      data: { refundTries: tries, refundError: String(err.message || err).slice(0, 300), nextRefundAt: new Date(Date.now() + wait * MIN), ...(stuck ? { alertedAt: new Date() } : {}) },
    });
    console.error(`[checkout] refund for ${att.order.orderNumber} not started yet (try ${tries}, again in ${wait} min): ${err.message}`);
    if (stuck) alertOwners(alertFor.refundStuck(att.order, { ...att, refundError: String(err.message || err) }));
    return 'refunded';
  }
  await prisma.paymentAttempt.update({ where: { id: att.id }, data: { status: 'refunded', refundId: r.id, refundStatus: r.status === 'processed' ? 'processed' : 'pending', refundedAt: new Date(), refundError: null, nextRefundAt: null } });
  if (att.order.authAccountId) {
    await notifyCustomer({
      accountId: att.order.authAccountId, type: 'payment_failed', title: 'Your payment is being refunded',
      body: `We couldn't keep order ${att.order.orderNumber}: ${att.refundReason?.toLowerCase() ?? 'it couldn\'t be filled'}. ${money(att.amount)} goes back to your account in 5 to 7 working days.`, link: `/order/${att.order.orderNumber}`,
    }).catch(() => {});
  }
  await shopAudit('shop_payment_refunded', { accountId: att.order.authAccountId, metadata: { orderNumber: att.order.orderNumber, amount: Number(att.amount), reason: att.refundReason } });
  alertOwners(alertFor.refundStarted(att.order, att));
  return 'refunded';
}

async function abandon(orderId, reason) {
  await prisma.$transaction(async (tx) => {
    await C.lockOrder(orderId, tx);
    const order = await C.findById(orderId, tx);
    if (order.status !== 'pending_payment') return;
    await releaseHolds(tx, order, 'released');
    await tx.order.update({ where: { id: orderId }, data: { status: 'cancelled', cancelledAt: new Date(), cancelReason: reason } });
  }, TX);
}

/* ---------- Razorpay's notices (webhook) ---------- */
// The payment request a notice is about: ours, or one the old website made (it has a Payment
// row but no attempt; one is made so it follows the same rules).
async function attemptFor(razorpayOrderId) {
  const att = await C.attemptByRazorpayOrder(razorpayOrderId);
  if (att) return att;
  const legacy = await C.paymentByRazorpayOrder(razorpayOrderId);
  if (!legacy) return null;
  return prisma.paymentAttempt.upsert({ where: { razorpayOrderId }, create: { orderId: legacy.orderId, razorpayOrderId, amount: legacy.amount }, update: {} });
}

export async function handleWebhook({ rawBody, signature, eventId }) {
  if (!env.payments.webhookSecret) throw unavailable('WEBHOOK_NOT_CONFIGURED', 'Payment notices are not set up.');
  if (!webhookSignatureOk({ rawBody, signature, secret: env.payments.webhookSecret })) throw unauthorized('BAD_SIGNATURE', 'Invalid signature.');
  let event;
  try { event = JSON.parse(rawBody.toString('utf8')); } catch { throw badRequest('BAD_EVENT', 'Not JSON.'); }
  const id = eventId || `h_${crypto.createHash('sha256').update(rawBody).digest('hex').slice(0, 40)}`;
  if (await prisma.paymentEvent.findUnique({ where: { id } })) return { ok: true, duplicate: true };
  const type = String(event.event || '');
  const payment = event.payload?.payment?.entity ?? null;
  const refund = event.payload?.refund?.entity ?? null;
  let result = 'ignored';
  if (payment && ['payment.captured', 'payment.authorized', 'payment.failed', 'order.paid'].includes(type)) {
    // A payment without a Razorpay order (a QR code, a payment link made in the dashboard) isn't
    // a website payment: noted and answered, so Razorpay never retries it or turns the notices off.
    const attempt = payment.order_id ? await attemptFor(payment.order_id) : null;
    result = !payment.order_id ? 'not a website payment' : attempt ? await settle(attempt, payment) : 'unknown order';
  } else if (refund && ['refund.processed', 'refund.failed'].includes(type)) {
    const failed = type === 'refund.failed';
    const r = await prisma.paymentAttempt.updateMany({ where: { razorpayPaymentId: refund.payment_id, refundId: refund.id }, data: { refundStatus: failed ? 'failed' : 'processed' } });
    // Not one of ours: the owners refunded a paid order by hand in Razorpay's dashboard (an order
    // cancelled in the admin app, 6.15 A). Kept here, so the customer's order page shows it (W7).
    const byHand = !r.count && !!(await prisma.payment.findFirst({ where: { razorpayPaymentId: refund.payment_id, status: 'paid' }, select: { id: true } }));
    result = r.count ? `refund ${type.split('.')[1]}` : byHand ? `refund by hand ${type.split('.')[1]}` : 'unknown refund';
    // Razorpay couldn't complete a refund it had started: the owners refund it by hand.
    if (failed && r.count) {
      const att = await prisma.paymentAttempt.findFirst({ where: { razorpayPaymentId: refund.payment_id, refundId: refund.id }, include: { order: { select: { id: true, orderNumber: true, shippingAddress: true, total: true } } } });
      const first = await prisma.paymentAttempt.updateMany({ where: { id: att.id, alertedAt: null }, data: { alertedAt: new Date(), refundError: 'Razorpay could not complete the refund' } });
      if (first.count) alertOwners(alertFor.refundStuck(att.order, { ...att, refundError: 'Razorpay could not complete the refund' }));
    }
  }
  await prisma.paymentEvent.create({ data: { id, type: type.slice(0, 60), razorpayOrderId: payment?.order_id ?? null, razorpayPaymentId: payment?.id ?? refund?.payment_id ?? null, result: String(result).slice(0, 60) } }).catch(() => {});
  return { ok: true, result };
}

/* ---------- Background (src/jobs/payments.job.js) ---------- */
// Holds whose 15 minutes are up: the sarees go back on sale. The order stays "waiting for
// payment" (the admin app's Unpaid checkouts); a late payment is handled by complete().
export async function endExpiredHolds(now = new Date()) {
  let ended = 0;
  for (const { orderId } of await C.expiredHolds(now)) {
    await prisma.$transaction(async (tx) => {
      await C.lockOrder(orderId, tx);
      const order = await C.findById(orderId, tx);
      const due = { ...order, reservations: order.reservations.filter((r) => r.status === 'active' && r.expiresAt <= now) };
      await releaseHolds(tx, due, 'expired');
      ended += due.reservations.length;
    }, TX);
  }
  return ended;
}

// Payments the page couldn't confirm, notices that may have been lost, refunds to retry,
// invoices not made yet.
export async function checkPending(now = new Date()) {
  let checked = 0;
  for (const att of await C.attemptsToCheck(now)) {
    checked += 1;
    try {
      if (att.status === 'refund_due') { await refundNow(att.id); continue; }
      if (att.status === 'confirming' && att.createdAt < new Date(now.getTime() - PAYMENTS.CONFIRM_DAYS * 86400_000)) {
        await prisma.paymentAttempt.update({ where: { id: att.id }, data: { status: 'failed', failureReason: 'Not confirmed by the bank in 3 days', lastCheckedAt: now } });
        continue;
      }
      await prisma.paymentAttempt.update({ where: { id: att.id }, data: { lastCheckedAt: now } });
      const payments = await gateway().orderPayments(att.razorpayOrderId);
      const best = payments.find((p) => p.status === 'captured') || payments.find((p) => p.status === 'authorized') || payments[0];
      if (best) await settle(att, best);
    } catch (err) {
      console.error(`[payments] check of ${att.razorpayOrderId} failed: ${err.message}`);
    }
  }
  for (const { id } of await C.paidWithoutInvoice(new Date(now.getTime() - 30 * 86400_000))) {
    await ensureInvoice(id, 'system').catch((err) => console.error(`[payments] invoice still not made: ${err.message}`));
  }
  return checked;
}
