// Module 7: orders and shipping. Owners and Staff see and ship orders (orders.manage);
// Owners cancel an order not yet shipped (sell.override) and see unpaid checkouts
// (sales.view). Rules: docs/modules/module-07-orders.md, sections 5, 6 and 8.
//
// - To ship is oldest first (6.2). A tracking number is on one order only (6.5);
//   changing it keeps the old one in the history (6.6).
// - Mark delivered by hand (6.8); "Check delivery" after 10 days.
// - Cancel: owners, not shipped, the same month as the order (6.3). Sarees go back
//   in stock and the invoice is marked CANCELLED; the app never moves money.
// - A website order's customer is told when it ships and when it is delivered (website W7).
import { prisma } from '../config/database.js';
import { env } from '../config/env.js';
import * as O from '../models/order.model.js';
import * as S from '../models/sale.model.js';
import { displayNameOf } from '../models/authAccount.model.js';
import { audit } from './audit.service.js';
import { shopDetails } from './settings.service.js';
import { stampCancelled, PAID_BY_TEXT, ONLINE_METHOD_TEXT } from './invoice.service.js';
import { invoiceShare } from './sale.service.js';
import { tellCustomer, noticeFor } from './shop/orderNotices.service.js';
import { tagNumber } from '../utils/tags.js';
import { istDate, istTime, istSameMonth, istDayStart } from '../utils/day.js';
import { badRequest, conflict, notFound } from '../utils/errors.js';
import { pageOf, PAGE_SIZE } from '../utils/page.js';

export const PAGE = PAGE_SIZE;
export const TABS = ['to_ship', 'shipped', 'delivered'];
export const DTDC_TRACKING_URL = 'https://www.dtdc.com/track-your-shipment/';
export const CHECK_DELIVERY_DAYS = 10;
const num = (d) => (d == null ? null : Number(d));
const iso = (d) => (d ? d.toISOString() : null);
const DAY = 86400000;
const NOT_FOUND = () => notFound('NOT_FOUND', 'This order isn\'t in the shop\'s records.');

// "H1001830791": capitals, no spaces or dashes.
export const tidyAwb = (v) => String(v ?? '').toUpperCase().replace(/[\s-]/g, '');
export const isAwb = (v) => /^[A-Z0-9]{8,20}$/.test(v);

/* ---------- the customer and the address ---------- */

function address(order) {
  return order.shippingAddress && typeof order.shippingAddress === 'object' ? order.shippingAddress : {};
}
// The ship-to card in clean lines: no blank name, no stray commas (old problem 6).
export function addressLines(order) {
  const a = address(order);
  if (order.channel === 'whatsapp') return String(a.line1 || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const place = [a.city, [a.state, a.pincode].filter(Boolean).join(' ')].filter((x) => x && x.trim()).join(', ');
  // Website W6: the landmark the customer gave, so the courier finds the house.
  return [a.line1, a.line2, a.landmark ? `Near ${String(a.landmark).replace(/^near\s+/i, '')}` : '', place].map((l) => (l || '').trim()).filter(Boolean);
}
export function customerOf(order) {
  const a = address(order);
  const p = order.authAccount?.userProfile;
  const accountName = p ? [p.firstName, p.lastName].filter(Boolean).join(' ').trim() : '';
  return {
    name: (a.fullName || '').trim() || accountName || (order.channel === 'whatsapp' ? 'WhatsApp customer' : 'Online customer'),
    mobile: a.phone || order.authAccount?.phone || null,
    email: order.authAccount?.email || null,
    lines: addressLines(order),
  };
}
// The town, for the list: the online address's city, or a WhatsApp address's last
// line without its PIN code.
export function townOf(order) {
  const a = address(order);
  if (order.channel === 'online') return (a.city || '').trim() || null;
  const last = (addressLines(order).at(-1) || '').replace(/[,\s-]*\d{6}\s*$/, '').trim();
  const part = last.split(',').map((x) => x.trim()).filter(Boolean).at(-1) || '';
  // An old one-line address: its last word before the PIN code is usually the town.
  return (part.split(/\s+/).length > 3 ? part.split(/\s+/).at(-1) : part) || null;
}

/* ---------- the WhatsApp message (as the old app's, with the customer's name) ---------- */

// site: the shop's website address (Module 11 settings), for product links.
export function shipmentMessage(order, site = (env.WEBSITE_URL || '').replace(/\/$/, '')) {
  const c = customerOf(order);
  const name = c.name === 'WhatsApp customer' || c.name === 'Online customer' ? 'there' : c.name.split(/\s+/)[0];
  const carrier = order.shipment?.carrier || 'DTDC';
  const seen = new Set();
  const items = order.items.filter((it) => { const k = it.product?.slug || it.nameSnapshot; if (seen.has(k)) return false; seen.add(k); return true; })
    .map((it) => (site && it.product?.slug ? `${it.nameSnapshot}\n${site}/product/${it.product.slug}` : it.nameSnapshot));
  const tracking = carrier.toUpperCase() === 'DTDC'
    ? `Tracking ID (AWB): ${order.shipment.awbNumber}\nTrack it here: ${DTDC_TRACKING_URL}`
    : `Tracking number: ${order.shipment.awbNumber}`;
  return `Hi ${name}, your ${env.company.name} order ${order.orderNumber} has shipped via ${carrier}.\n\n${tracking}\n\nYour order:\n${items.join('\n\n')}\n\nThank you for shopping with us!`;
}

/* ---------- the lists ---------- */

function presentRow(o) {
  const sh = o.shipment;
  const shippedDays = sh?.shippedAt ? Math.floor((istDayStart().getTime() - istDayStart(sh.shippedAt).getTime()) / DAY) : null;
  return {
    id: o.id,
    orderNumber: o.orderNumber,
    channel: o.channel,
    status: o.status,
    placedAt: iso(o.placedAt),
    date: istDate(o.placedAt),
    time: istTime(o.placedAt),
    waitingDays: o.status === 'processing' ? Math.floor((istDayStart().getTime() - istDayStart(o.placedAt).getTime()) / DAY) : null,
    customer: customerOf(o).name,
    town: townOf(o),
    sarees: o.items.reduce((t, it) => t + it.quantity, 0),
    imageUrl: o.items.find((it) => it.imageSnapshot)?.imageSnapshot ?? null,
    total: num(o.total),
    carrier: sh?.carrier ?? null,
    awb: sh?.awbNumber ?? null,
    shippedAt: iso(sh?.shippedAt),
    shippedDate: sh?.shippedAt ? istDate(sh.shippedAt) : null,
    deliveredDate: sh?.deliveredAt ? istDate(sh.deliveredAt) : null,
    checkDelivery: o.status === 'shipped' && shippedDays != null && shippedDays > CHECK_DELIVERY_DAYS,
  };
}

export async function listOrders({ tab = 'to_ship', q = '', offset = 0, limit = PAGE }) {
  const counts = Object.fromEntries(await Promise.all(TABS.map(async (t) => [t, await O.countTab(t)])));
  if (q.trim()) return { orders: (await O.search(q)).map(presentRow), nextOffset: null, counts, searching: true };
  let rows = await O.listPage(tab, { skip: offset, take: limit + 1 });
  let nextOffset = null;
  if (rows.length > limit) { rows = rows.slice(0, limit); nextOffset = offset + limit; }
  return { orders: rows.map(presentRow), nextOffset, counts, searching: false };
}

export const toShipCount = async () => ({ toShip: await O.countTab('to_ship') });

/* ---------- one order ---------- */

async function namesFor(ids) {
  const list = [...new Set(ids.filter(Boolean))];
  if (!list.length) return new Map();
  const people = await prisma.authAccount.findMany({ where: { id: { in: list } }, include: { adminProfile: true, userProfile: true } });
  return new Map(people.map((p) => [p.id, displayNameOf(p)]));
}

function cancelBlock(order, viewerCanCancel) {
  if (order.status === 'cancelled') return 'ALREADY_CANCELLED';
  if (!viewerCanCancel) return 'OWNERS_ONLY';
  if (order.status !== 'processing') return 'SHIPPED';
  if (!istSameMonth(order.placedAt)) return 'NOT_THIS_MONTH';
  return null;
}

async function orderReply(order, { canCancel }) {
  const sh = order.shipment;
  const sellerId = order.channel === 'whatsapp' ? (await S.sellers([order.orderNumber])).get(order.orderNumber) ?? null : null;
  const changes = await O.trackingChanges(order.id);
  const names = await namesFor([sellerId, sh?.shippedById, sh?.deliveredById, order.cancelledById, ...changes.map((e) => e.authAccountId)]);
  const who = (id) => (id ? names.get(id) ?? 'Former team member' : null);
  const when = (d) => `${istDate(d)}, ${istTime(d)}`;
  const events = [{ at: when(order.placedAt), text: order.channel === 'online' ? 'Ordered on the website' : `WhatsApp order made${sellerId ? ` by ${who(sellerId)}` : ''}` }];
  const paidOnline = `Paid online (Razorpay)${ONLINE_METHOD_TEXT[order.payment?.method] ? ` · ${ONLINE_METHOD_TEXT[order.payment.method]}` : ''}`;
  if (order.channel === 'online' && order.payment?.status === 'paid') events.push({ at: when(order.payment.capturedAt || order.payment.updatedAt), text: paidOnline });
  if (sh?.shippedAt) events.push({ at: when(sh.shippedAt), text: `Shipped${sh.shippedById ? ` by ${who(sh.shippedById)}` : ''}` });
  for (const e of changes) events.push({ at: when(e.createdAt), text: `Tracking number changed${e.authAccountId ? ` by ${who(e.authAccountId)}` : ''}: ${e.metadata?.from?.awb} → ${e.metadata?.to?.awb}` });
  if (sh?.deliveredAt) events.push({ at: when(sh.deliveredAt), text: `Marked delivered${sh.deliveredById ? ` by ${who(sh.deliveredById)}` : ''}` });
  if (order.cancelledAt) events.push({ at: when(order.cancelledAt), text: `Cancelled${order.cancelledById ? ` by ${who(order.cancelledById)}` : ''}: ${order.cancelReason || 'no reason given'}` });

  const blocked = cancelBlock(order, canCancel);
  const shipped = order.status === 'shipped' || order.status === 'delivered';
  const inv = order.invoice;
  return {
    order: {
      ...presentRow({ ...order, items: order.items }),
      customer: customerOf(order),
      lines: order.items.map((it) => ({ id: it.id, code: it.piece?.barcode ?? null, number: it.piece ? tagNumber(it.piece.barcode) : null, name: it.nameSnapshot, imageUrl: it.imageSnapshot, quantity: it.quantity, price: num(it.priceSnapshot) })),
      payment: order.channel === 'online' ? { text: order.payment?.status === 'paid' ? paidOnline : 'Not paid', paid: order.payment?.status === 'paid' } : { text: PAID_BY_TEXT[order.paymentMethod] ?? 'Not recorded (old app)', paid: true },
      invoice: inv ? { id: inv.id, number: inv.invoiceNumber, url: inv.url, cancelled: !!inv.cancelledAt, ...invoiceShare(inv.invoiceNumber, num(inv.totalAmount)) } : null,
      events,
      cancelled: order.cancelledAt ? { reason: order.cancelReason ?? null, by: who(order.cancelledById) } : null,
      message: shipped && sh?.awbNumber ? shipmentMessage(order, (await shopDetails()).website) : null,
      trackingUrl: shipped && (sh?.carrier || '').toUpperCase() === 'DTDC' ? DTDC_TRACKING_URL : null,
    },
    actions: {
      ship: order.status === 'processing',
      changeTracking: order.status === 'shipped',
      markDelivered: order.status === 'shipped',
      sendTracking: shipped && !!sh?.awbNumber && !!customerOf(order).mobile,
      cancel: !blocked,
      cancelBlocked: blocked,
    },
  };
}

export async function getOrder({ id, canCancel }) {
  const order = await O.findOne(id);
  if (!order) throw NOT_FOUND();
  return orderReply(order, { canCancel });
}

/* ---------- shipping ---------- */

function checkTracking({ carrier, awb }) {
  const number = tidyAwb(awb);
  if (!isAwb(number)) throw badRequest('AWB_INVALID', 'Scan the label, or type its number: 8 to 20 letters and digits.');
  const name = String(carrier || 'DTDC').trim().replace(/\s+/g, ' ');
  if (name.length < 2 || name.length > 40) throw badRequest('CARRIER_INVALID', 'Type the courier\'s name.');
  return { number, carrier: name.toUpperCase() === 'DTDC' ? 'DTDC' : name };
}

async function refuseTaken(tx, number, orderId) {
  const taken = await O.shipmentWithAwb(number, orderId, tx);
  if (taken) {
    const name = (address(taken.order).fullName || '').trim();
    throw conflict('AWB_TAKEN', `${number} is already on order ${taken.order.orderNumber}${name ? ` (${name})` : ''}. Check the label.`, { orderId: taken.order.id, orderNumber: taken.order.orderNumber });
  }
}

export async function shipOrder({ viewer, id, carrier, awb, canCancel, ctx }) {
  const t = checkTracking({ carrier, awb });
  const order = await O.findOne(id);
  if (!order) throw NOT_FOUND();
  if (order.status === 'cancelled') throw conflict('ALREADY_CANCELLED', 'This order was cancelled.');
  if (order.status !== 'processing') throw conflict('ALREADY_SHIPPED', `This order was already shipped${order.shipment?.awbNumber ? ` (${order.shipment.carrier} ${order.shipment.awbNumber})` : ''}.`);
  if (order.channel === 'online' && order.payment?.status !== 'paid') throw conflict('NOT_PAID', 'This online order isn\'t paid yet.');
  // The lock makes "check, then save" safe when two phones scan the same label.
  await prisma.$transaction(async (tx) => {
    await O.lockAwb(tx);
    await refuseTaken(tx, t.number, id);
    const claim = await tx.order.updateMany({ where: { id, status: 'processing' }, data: { status: 'shipped' } });
    if (claim.count !== 1) throw conflict('ALREADY_SHIPPED', 'This order was just shipped on another phone.');
    await tx.shipment.upsert({
      where: { orderId: id },
      create: { orderId: id, carrier: t.carrier, awbNumber: t.number, status: 'shipped', shippedAt: new Date(), shippedById: viewer.id },
      update: { carrier: t.carrier, awbNumber: t.number, status: 'shipped', shippedAt: new Date(), shippedById: viewer.id },
    });
  });
  await audit('order_marked_shipped', { accountId: viewer.id, ctx, metadata: { orderId: id, orderNumber: order.orderNumber, awbNumber: t.number, carrier: t.carrier, actorId: viewer.id, summary: `${order.orderNumber} shipped · ${t.carrier} ${t.number}` } });
  tellCustomer(order, noticeFor.shipped(order, { carrier: t.carrier, awb: t.number })); // in the background
  return getOrder({ id, canCancel });
}

// 6.6: a wrong tracking number; the old one stays in the history.
export async function changeTracking({ viewer, id, carrier, awb, canCancel, ctx }) {
  const t = checkTracking({ carrier, awb });
  const order = await O.findOne(id);
  if (!order) throw NOT_FOUND();
  if (order.status !== 'shipped') throw conflict('NOT_SHIPPED', order.status === 'delivered' ? 'This order was delivered; its tracking number can\'t change now.' : 'This order isn\'t shipped yet. Use Ship.');
  const before = { carrier: order.shipment.carrier, awb: order.shipment.awbNumber };
  if (before.awb === t.number && before.carrier === t.carrier) throw badRequest('SAME_AWB', 'That is already this order\'s tracking number.');
  await prisma.$transaction(async (tx) => {
    await O.lockAwb(tx);
    await refuseTaken(tx, t.number, id);
    await tx.shipment.update({ where: { orderId: id }, data: { carrier: t.carrier, awbNumber: t.number } });
  });
  await audit('order_tracking_changed', { accountId: viewer.id, ctx, metadata: { orderId: id, orderNumber: order.orderNumber, from: before, to: { carrier: t.carrier, awb: t.number }, actorId: viewer.id, summary: `${order.orderNumber}: tracking ${before.awb} → ${t.number}` } });
  return getOrder({ id, canCancel });
}

// 6.8: the customer has the parcel.
export async function markDelivered({ viewer, id, canCancel, ctx }) {
  const order = await O.findOne(id);
  if (!order) throw NOT_FOUND();
  if (order.status === 'delivered') return getOrder({ id, canCancel });
  if (order.status !== 'shipped') throw conflict('NOT_SHIPPED', 'Only a shipped order can be marked delivered.');
  const claimed = await prisma.$transaction(async (tx) => {
    const claim = await tx.order.updateMany({ where: { id, status: 'shipped' }, data: { status: 'delivered' } });
    if (!claim.count) return false;
    await tx.shipment.update({ where: { orderId: id }, data: { status: 'delivered', deliveredAt: new Date(), deliveredById: viewer.id } });
    return true;
  });
  await audit('order_marked_delivered', { accountId: viewer.id, ctx, metadata: { orderId: id, orderNumber: order.orderNumber, actorId: viewer.id, summary: `${order.orderNumber} marked delivered` } });
  if (claimed) tellCustomer(order, noticeFor.delivered(order)); // once, in the background
  return getOrder({ id, canCancel });
}

/* ---------- cancel (6.3) ---------- */

export async function cancelOrder({ viewer, id, reason, ctx }) {
  const order = await O.findOne(id);
  if (!order) throw NOT_FOUND();
  const blocked = cancelBlock(order, true);
  if (blocked === 'ALREADY_CANCELLED') throw conflict('ALREADY_CANCELLED', 'This order was already cancelled.');
  if (blocked === 'SHIPPED') throw conflict('SHIPPED', 'This order has been shipped, so it can\'t be cancelled here.');
  if (blocked === 'NOT_THIS_MONTH') throw conflict('NOT_THIS_MONTH', `Only this month's orders can be cancelled. This one is from ${istDate(order.placedAt)}.`);
  const now = new Date();
  const restocked = [];
  const channel = order.channel === 'online' ? 'online' : 'whatsapp';
  await prisma.$transaction(async (tx) => {
    const claim = await tx.order.updateMany({ where: { id, status: 'processing' }, data: { status: 'cancelled', cancelledAt: now, cancelledById: viewer.id, cancelReason: reason } });
    if (claim.count !== 1) throw conflict('SHIPPED', 'This order was just shipped or cancelled on another phone.');
    for (const it of order.items) {
      if (it.pieceId) {
        const back = await tx.piece.updateMany({ where: { id: it.pieceId, status: { in: ['sold_online', 'sold_offline'] } }, data: { status: 'in_stock', soldAt: null } });
        if (back.count !== 1) continue;
        restocked.push(it.piece.barcode);
      } else {
        await tx.product.update({ where: { id: it.productId }, data: { stock: { increment: it.quantity } } });
      }
      await tx.stockLedger.create({ data: { productId: it.productId, pieceId: it.pieceId, delta: it.quantity, reason: 'order_cancelled', channel, actorId: viewer.id, ref: order.orderNumber } });
    }
    if (order.invoice) await tx.invoice.update({ where: { id: order.invoice.id }, data: { cancelledAt: now } });
  });
  await audit('order_cancelled', {
    accountId: viewer.id, ctx,
    metadata: { orderId: id, orderNumber: order.orderNumber, channel: order.channel, total: num(order.total), reason, backInStock: restocked, refundDue: order.channel === 'online' ? num(order.total) : null, actorId: viewer.id, summary: `${order.orderNumber} cancelled (${reason}). ${restocked.length} back in stock.` },
  });
  if (order.invoice) {
    try { await stampCancelled(id); } catch (e) { console.error(`[order] ${order.orderNumber} cancelled; invoice not stamped yet: ${e.message}`); }
  }
  const reply = await getOrder({ id, canCancel: true });
  return { ...reply, backInStock: restocked, refundDue: order.channel === 'online' ? num(order.total) : null };
}

/* ---------- unpaid checkouts (6.7) ---------- */

// Grouped by customer: one row per person, with how many times they tried.
export async function unpaidCheckouts({ offset = 0, limit = PAGE_SIZE } = {}) {
  const orders = await O.unpaidCheckouts();
  const groups = new Map();
  for (const o of orders) {
    const key = o.authAccountId || o.id;
    const g = groups.get(key) || { latest: o, tries: 0, orders: [] };
    g.tries += 1;
    g.orders.push(o);
    groups.set(key, g);
  }
  const customers = [...groups.values()].map(({ latest, tries }) => {
    const c = customerOf(latest);
    return {
      id: latest.authAccountId || latest.id,
      name: c.name,
      mobile: c.mobile,
      email: c.email,
      tries,
      lastAt: iso(latest.placedAt),
      last: `${istDate(latest.placedAt)}, ${istTime(latest.placedAt)}`,
      amount: num(latest.total),
      sarees: latest.items.reduce((t, it) => t + it.quantity, 0),
      items: latest.items.map((it) => it.nameSnapshot),
      imageUrl: latest.items.find((it) => it.imageSnapshot)?.imageSnapshot ?? null,
    };
  });
  const page = pageOf(customers, { offset, limit });
  return { customers: page.items, nextOffset: page.nextOffset, total: page.total, totals: { customers: customers.length, checkouts: orders.length } };
}

