// Module 5: scan to sell. Owners and Staff sell (sell.use); only Owners sell a saree
// an online checkout is holding, or cancel a sale (sell.override). Rules:
// docs/modules/module-05-scan-to-sell.md, sections 5, 6 and 8.
//
// - A saree is never sold twice: each tag is claimed only if it is still what the
//   bill saw (in stock, or held by the checkout an owner chose to cancel).
// - One bill = one order: every saree is sold together, or none is.
// - Safe to repeat: the phone's clientRef returns the sale already made.
// - The sale never waits on its invoice: if the PDF fails, "Make the invoice again".
// - Cancel: owners, the same day (India time), with a reason. The sarees go back in
//   stock and the invoice is kept, stamped CANCELLED.
import { prisma } from '../config/database.js';
import { can, PERMISSION } from '../config/permissions.js';
import * as S from '../models/sale.model.js';
import { onlineSince } from '../models/stats.model.js';
import { SOLD, isUniqueClash } from '../models/product.model.js';
import { appRoleOf, displayNameOf } from '../models/authAccount.model.js';
import { audit } from './audit.service.js';
import { ensureInvoice, stampCancelled, isStamped, customerOf, PAID_BY_TEXT } from './invoice.service.js';
import { normalizeTag, isValidTag, tagNumber, isBareNumber } from '../utils/tags.js';
import { sumMoney } from '../utils/gst.js';
import { istDayStart, istSameDay, istSameMonth, istDate, istDay, istTime } from '../utils/day.js';
import { badRequest, conflict, forbidden, notFound, unavailable } from '../utils/errors.js';
import { pageOf, PAGE_SIZE } from '../utils/page.js';

export const PAYMENT_METHODS = ['cash', 'upi', 'card'];
export const LIMITS = { linesPerBill: 100, maxPrice: 1000000 };

const num = (d) => (d == null ? null : Number(d));
const iso = (d) => (d ? d.toISOString() : null);
const rupees = (n) => `₹${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const isOwner = (viewer) => can(appRoleOf(viewer), PERMISSION.SALES_VIEW);
const canSellHeld = (viewer) => can(appRoleOf(viewer), PERMISSION.SELL_OVERRIDE);
const isCancelled = (o) => o.status === 'cancelled' || !!o.cancelledAt;
const WHERE_SOLD = { sold_offline: 'at the counter', sold_online: 'online' };
const NOT_FOUND = () => notFound('NOT_FOUND', 'This sale isn\'t in the shop\'s records.');

/* ---------- one saree ---------- */

// The online checkout holding this tag right now (its 15 minutes not over).
const activeHold = (pc, now = new Date()) => pc.reservations.find((r) => r.expiresAt > now) ?? null;

function sareeOf(pc) {
  const p = pc.product;
  const sub = p.subcategory;
  return {
    pieceId: pc.id,
    productId: p.id,
    code: pc.barcode,
    number: tagNumber(pc.barcode),
    name: sub?.name ?? p.name,
    sku: p.sku,
    imageUrl: p.images[0]?.url ?? null,
    storePrice: num(sub?.storePrice),
    websitePrice: num(sub?.onlinePrice),
    mrp: num(sub?.mrp),
    channel: p.channelVisibility,
    status: pc.status,
    soldAt: iso(pc.soldAt),
  };
}

// Why this saree can't be sold now, or null when it can (rule "Sellable", section 8).
function problemOf(pc, viewer, now = new Date()) {
  const p = pc.product;
  const code = pc.barcode;
  if (p.deletedAt || pc.status === 'removed') return { code: 'DELETED', message: `${code} was on a saree that was deleted. It can't be sold.` };
  if (SOLD.includes(pc.status)) return { code: 'ALREADY_SOLD', message: `${code} is already sold (${WHERE_SOLD[pc.status]}${pc.soldAt ? `, ${istDay(pc.soldAt)}` : ''}).` };
  if (pc.status === 'retired') return { code: 'TAG_RETIRED', message: `${code} was a damaged tag and was replaced. Scan the saree's new tag.` };
  if (pc.status === 'damaged') return { code: 'DAMAGED', message: `${code}: saree damaged, not for sale. If it is fine, mark it back in stock on the saree page.` };
  if (p.channelVisibility === 'online_only') return { code: 'ONLINE_ONLY', message: `${code} is set to Online only. Change it to Online + store on the saree page to sell it here.` };
  if (!p.isActive || p.channelVisibility === 'hidden') return { code: 'SWITCHED_OFF', message: `${code} is switched off: not for sale.` };
  if (!['in_stock', 'reserved'].includes(pc.status)) return { code: 'NOT_FOR_SALE', message: `${code} isn't in stock (${pc.status}).` };
  const hold = activeHold(pc, now);
  if (hold) {
    const until = istTime(hold.expiresAt);
    const sellAnyway = canSellHeld(viewer);
    return {
      code: 'HELD_ONLINE',
      message: sellAnyway
        ? `A customer is paying for ${code} online right now (until ${until}). Sell anyway cancels that online checkout.`
        : `A customer is paying for ${code} online right now. Ask an owner, or wait until ${until}.`,
      heldUntil: iso(hold.expiresAt),
      checkoutOrderNumber: hold.order?.orderNumber ?? null,
      canSellAnyway: sellAnyway,
    };
  }
  return null;
}

// Scan on the bill or in Price check: the saree, its store price and whether it can be sold.
export async function lookup({ viewer, code }) {
  const tidy = normalizeTag(code);
  // A typed number alone ("10" for the old tag NH10) is searched by its number, however short.
  if (!isValidTag(tidy) && !/^[0-9]{1,6}$/.test(tidy)) throw badRequest('TAG_INVALID', 'That doesn\'t look like a tag. Scan it again or type the number on it.');
  let pc = await S.pieceByTag(tidy);
  if (pc?.status === 'removed') pc = null;
  if (!pc && isBareNumber(tidy)) {
    const matches = await S.piecesByNumber(tidy);
    const open = matches.filter((m) => m.status === 'in_stock' || m.status === 'reserved');
    if (matches.length === 1) [pc] = matches;
    else if (open.length === 1) [pc] = open;
    else if (matches.length > 1) {
      throw conflict('AMBIGUOUS_CODE', `${matches.length} tags carry the number ${tidy}. Scan the tag or type the whole code.`, { matches: matches.map((m) => ({ code: m.barcode, name: m.product.subcategory?.name ?? m.product.name, status: m.status })) });
    }
  }
  if (!pc) throw notFound('TAG_UNKNOWN', `No saree has ${tidy}.`, { code: tidy });
  const problem = problemOf(pc, viewer);
  return { saree: sareeOf(pc), sellable: !problem, problem };
}

/* ---------- selling ---------- */

const lineError = (i, pc, reason, message, extra = {}) =>
  conflict('LINE_CHANGED', message, { line: i, pieceId: pc?.id ?? null, code: pc?.barcode ?? null, reason, ...extra });

// An owner's "Sell anyway": the online checkout holding the saree is cancelled, and
// every saree it held goes back in stock, in the same step as the sale (6.8).
async function cancelCheckout(tx, orderId, { viewer, saleNumber, soldPieceId, now }) {
  const holds = await tx.reservation.findMany({ where: { orderId, status: 'active' } });
  for (const r of holds) {
    if (r.pieceId) await tx.piece.updateMany({ where: { id: r.pieceId, status: 'reserved' }, data: { status: 'in_stock' } });
    else await tx.product.update({ where: { id: r.productId }, data: { stock: { increment: r.quantity } } });
    await tx.reservation.update({ where: { id: r.id }, data: { status: 'released' } });
    await tx.stockLedger.create({
      data: { productId: r.productId, pieceId: r.pieceId, delta: r.quantity, reason: 'release', channel: 'online', actorId: viewer.id, ref: r.pieceId === soldPieceId ? `override:${saleNumber}` : orderId },
    });
  }
  await tx.order.updateMany({
    where: { id: orderId, status: { in: ['pending_payment', 'active'] } },
    data: { status: 'cancelled', cancelledAt: now, cancelledById: viewer.id, cancelReason: `Sold at the counter (order ${saleNumber})` },
  });
}

// An expired hold the old backend's sweep hasn't cleared yet: cleared now.
async function clearExpiredHolds(tx, pc, now) {
  for (const r of pc.reservations.filter((x) => x.expiresAt <= now)) {
    await tx.reservation.update({ where: { id: r.id }, data: { status: 'expired' } });
    await tx.stockLedger.create({ data: { productId: pc.productId, pieceId: pc.id, delta: 1, reason: 'release', channel: 'online', ref: r.orderId } });
  }
  if (pc.status === 'reserved') await tx.piece.updateMany({ where: { id: pc.id, status: 'reserved' }, data: { status: 'in_stock' } });
}

function shippingAddressFor(channel, customer) {
  if (channel === 'whatsapp') {
    // The shape every order uses, so Module 7's To ship reads one set of fields.
    return { fullName: customer.name, phone: customer.mobile, line1: customer.address, line2: null, city: '', state: '', pincode: '' };
  }
  // A counter customer is saved only when given (6.5).
  return { ...(customer.name ? { fullName: customer.name } : {}), ...(customer.mobile ? { phone: customer.mobile } : {}) };
}

async function sellInTx(tx, { viewer, clientRef, lines, channel, paymentMethod, invoice, customer }) {
  // The same bill sent twice at the same moment: the second waits here for the first,
  // then returns its sale instead of finding the sarees "just sold".
  await S.lockBill(tx, clientRef);
  const existing = await S.findByClientRef(clientRef, tx);
  if (existing) return { existing };
  const now = new Date();
  const orderNumber = await S.newOrderNumber(tx);
  const sold = [];
  const checkouts = new Map();
  for (const [i, line] of lines.entries()) {
    const pc = await S.pieceById(line.pieceId, tx);
    if (!pc) throw lineError(i, null, 'GONE', 'A saree on this bill isn\'t in the shop any more. Remove it to continue.', { pieceId: line.pieceId });
    const problem = problemOf(pc, viewer, now);
    if (problem?.code === 'HELD_ONLINE') {
      // "Sell anyway" is the owner's choice for this saree only (line.sellHeld).
      if (!line.sellHeld || !problem.canSellAnyway) {
        throw conflict('HELD_ONLINE', problem.message, { line: i, pieceId: pc.id, code: pc.barcode, heldUntil: problem.heldUntil, canSellAnyway: problem.canSellAnyway });
      }
    } else if (problem) {
      const just = problem.code === 'ALREADY_SOLD' ? `${pc.barcode} was just sold${pc.status === 'sold_online' ? ' online' : ' on another phone'}. Remove it to continue.` : `${problem.message} Remove it to continue.`;
      throw lineError(i, pc, problem.code, just);
    }
    const storePrice = num(pc.product.subcategory.storePrice);
    if (Math.round(storePrice * 100) !== Math.round(line.storePrice * 100)) {
      throw lineError(i, pc, 'PRICE_CHANGED', `The store price of ${pc.barcode} changed to ${rupees(storePrice)}. Check the bill and try again.`, { storePrice });
    }

    let expected = pc.status;
    const hold = activeHold(pc, now);
    if (hold) {
      if (!checkouts.has(hold.orderId)) {
        await cancelCheckout(tx, hold.orderId, { viewer, saleNumber: orderNumber, soldPieceId: pc.id, now });
        checkouts.set(hold.orderId, hold.order?.orderNumber ?? null);
      }
      expected = 'in_stock';
    }
    if (pc.reservations.some((r) => r.expiresAt <= now) || (pc.status === 'reserved' && !hold)) {
      await clearExpiredHolds(tx, pc, now);
      expected = 'in_stock';
    }
    // The claim: only if the tag is still what this bill saw. A second phone selling
    // the same saree at the same moment waits here, then finds it sold.
    const claim = await tx.piece.updateMany({ where: { id: pc.id, status: expected }, data: { status: 'sold_offline', soldAt: now } });
    if (claim.count !== 1) throw lineError(i, pc, 'ALREADY_SOLD', `${pc.barcode} was just sold on another phone. Remove it to continue.`);
    await tx.stockLedger.create({
      data: { productId: pc.productId, pieceId: pc.id, delta: -1, reason: 'offline_sale', channel: channel === 'whatsapp' ? 'whatsapp' : 'store', actorId: viewer.id, ref: orderNumber },
    });
    sold.push({ pc, price: line.price, storePrice });
  }

  const total = sumMoney(sold.map((s) => s.price));
  const order = await tx.order.create({
    data: {
      orderNumber,
      channel,
      status: channel === 'whatsapp' ? 'processing' : 'delivered',
      subtotal: total,
      total,
      shippingAddress: shippingAddressFor(channel, customer),
      invoiceRequired: invoice,
      clientRef,
      paymentMethod,
      placedAt: now,
    },
  });
  await tx.orderItem.createMany({
    data: sold.map(({ pc, price, storePrice }, i) => ({
      orderId: order.id, productId: pc.productId, pieceId: pc.id, nameSnapshot: pc.product.subcategory?.name ?? pc.product.name, priceSnapshot: price, storePrice, imageSnapshot: pc.product.images[0]?.url ?? null, quantity: 1, lineNo: i + 1,
    })),
  });
  if (channel === 'whatsapp') await tx.shipment.create({ data: { orderId: order.id } });
  return { order, sold, checkouts: [...checkouts.entries()].map(([id, number]) => ({ id, orderNumber: number })) };
}

export async function sell({ viewer, clientRef, lines, channel, paymentMethod, invoice, customer = {}, ctx }) {
  const done = await S.findByClientRef(clientRef);
  if (done) return { ...(await saleReply(done, viewer, { skipAccess: true })), repeated: true };
  if (lines.some((l) => l.sellHeld) && !canSellHeld(viewer)) throw forbidden('FORBIDDEN', 'Only owners can sell a saree an online checkout is holding.');

  let made;
  for (let attempt = 1; !made; attempt += 1) {
    try {
      made = await prisma.$transaction((tx) => sellInTx(tx, { viewer, clientRef, lines, channel, paymentMethod, invoice, customer }));
    } catch (e) {
      if (isUniqueClash(e, 'clientRef')) {
        const again = await S.findByClientRef(clientRef);
        if (again) return { ...(await saleReply(again, viewer, { skipAccess: true })), repeated: true };
      }
      if (!isUniqueClash(e, 'orderNumber') || attempt >= 4) throw e;
    }
  }
  if (made.existing) return { ...(await saleReply(made.existing, viewer, { skipAccess: true })), repeated: true };
  const { order, sold, checkouts } = made;

  // Every bargain is recorded, under the old app's event name so old entries show too.
  for (const s of sold) {
    if (Math.round(s.price * 100) === Math.round(s.storePrice * 100)) continue;
    await audit('offline_sale_price_override', {
      accountId: viewer.id,
      ctx,
      metadata: {
        orderId: order.id, orderNumber: order.orderNumber, productId: s.pc.productId, pieceId: s.pc.id, code: s.pc.barcode, categoryStorePrice: s.storePrice, salePrice: s.price, actorId: viewer.id,
        summary: `Sold at ${rupees(s.price)} (store price ${rupees(s.storePrice)}), order ${order.orderNumber}`,
      },
    });
  }
  if (checkouts.length) {
    await audit('offline_sale_held_override', {
      accountId: viewer.id, ctx, metadata: { orderId: order.id, orderNumber: order.orderNumber, cancelledCheckouts: checkouts, actorId: viewer.id, summary: `Sold anyway: online checkout ${checkouts.map((c) => c.orderNumber).join(', ')} cancelled` },
    });
  }
  await audit('sale_completed', {
    accountId: viewer.id,
    ctx,
    metadata: { orderId: order.id, orderNumber: order.orderNumber, channel, paymentMethod, total: num(order.total), sarees: sold.length, invoice, actorId: viewer.id, summary: `Sale ${order.orderNumber}: ${sold.length} saree${sold.length === 1 ? '' : 's'}, ${rupees(order.total)}, ${PAID_BY_TEXT[paymentMethod]}` },
  });

  let invoiceFailed = false;
  if (invoice) {
    try {
      await ensureInvoice(order.id, viewer.id);
    } catch (e) {
      invoiceFailed = true;
      console.error(`[sale] ${order.orderNumber} is saved but its invoice could not be made: ${e.message}`);
    }
  }
  const fresh = await S.findSale(order.id);
  return { ...(await saleReply(fresh, viewer, { skipAccess: true })), repeated: false, invoiceFailed };
}

/* ---------- reading ---------- */

async function namesFor(ids) {
  const list = [...new Set(ids.filter(Boolean))];
  if (!list.length) return new Map();
  const people = await prisma.authAccount.findMany({ where: { id: { in: list } }, include: { adminProfile: true, userProfile: true } });
  return new Map(people.map((x) => [x.id, displayNameOf(x)]));
}
const person = (id, names) => (id ? { id, name: names.get(id) ?? 'Former team member' } : null);

// The store price on each bargained line, from the bargain records.
export async function bargainsFor(orderId) {
  const rows = await prisma.authEvent.findMany({ where: { eventType: 'offline_sale_price_override', metadata: { path: ['orderId'], equals: orderId } }, select: { metadata: true } });
  const out = new Map();
  for (const r of rows) out.set(r.metadata.pieceId ?? r.metadata.productId, num(r.metadata.categoryStorePrice));
  return out;
}

export const invoiceShare = (number, total) => ({
  fileName: `Nandam-Invoice-${number}.pdf`,
  caption: `Nandam Handlooms – invoice ${number} for ${rupees(total)}. Thank you for shopping with us.`,
});

function invoiceOf(order) {
  const inv = order.invoice;
  if (!order.invoiceRequired) return { required: false };
  if (!inv) return { required: true, ready: false };
  return { required: true, ready: true, number: inv.invoiceNumber, url: inv.url, cancelled: !!inv.cancelledAt, stamped: isStamped(inv), ...invoiceShare(inv.invoiceNumber, num(inv.totalAmount)) };
}

function cancelBlock(order, viewer) {
  if (isCancelled(order)) return 'ALREADY_CANCELLED';
  if (!canSellHeld(viewer)) return 'OWNERS_ONLY';
  if (!istSameDay(order.placedAt)) return 'NOT_TODAY';
  if (order.shipment && order.shipment.status !== 'not_shipped') return 'SHIPPED';
  return null;
}

async function saleReply(order, viewer, { skipAccess = false } = {}) {
  const sellerId = (await S.sellers([order.orderNumber])).get(order.orderNumber) ?? null;
  if (!skipAccess && !isOwner(viewer) && sellerId !== viewer.id) {
    throw forbidden('NOT_YOURS', 'This sale was made by someone else. Ask an owner if you need it.');
  }
  const [names, bargains] = await Promise.all([namesFor([sellerId, order.cancelledById]), bargainsFor(order.id)]);
  const lines = order.items.map((it) => {
    const price = num(it.priceSnapshot);
    // The line's own store price (Module 10), else the bargain record (older sales).
    const storePrice = num(it.storePrice) ?? bargains.get(it.pieceId) ?? bargains.get(it.productId) ?? null;
    return { id: it.id, pieceId: it.pieceId, productId: it.productId, code: it.piece?.barcode ?? null, number: it.piece ? tagNumber(it.piece.barcode) : null, name: it.nameSnapshot, imageUrl: it.imageSnapshot, quantity: it.quantity, price, storePrice: storePrice ?? price };
  });
  const savings = sumMoney(lines.map((l) => Math.max(0, l.storePrice - l.price) * l.quantity));
  const blocked = cancelBlock(order, viewer);
  const inv = invoiceOf(order);
  const cancelled = isCancelled(order);
  return {
    sale: {
      id: order.id,
      orderNumber: order.orderNumber,
      placedAt: iso(order.placedAt),
      date: istDate(order.placedAt),
      time: istTime(order.placedAt),
      channel: order.channel,
      paymentMethod: order.paymentMethod,
      total: num(order.total),
      savings,
      lines,
      customer: (() => { const c = customerOf(order); return c.name || c.mobile || c.address ? c : null; })(),
      soldBy: person(sellerId, names),
      status: cancelled ? 'cancelled' : 'done',
      cancelled: cancelled ? { at: iso(order.cancelledAt), by: person(order.cancelledById, names), reason: order.cancelReason ?? null } : null,
      shipping: order.channel === 'whatsapp' ? { status: order.shipment?.status ?? 'not_shipped', awbNumber: order.shipment?.awbNumber ?? null } : null,
      invoice: inv,
    },
    actions: {
      cancel: !blocked,
      cancelBlocked: blocked,
      makeInvoice: (inv.required && !inv.ready && !cancelled) || (cancelled && inv.ready && !inv.stamped),
      // Module 6 (6.5): a sale recorded without an invoice gets one later, in its own month.
      makeInvoiceLater: !inv.required && !cancelled && istSameMonth(order.placedAt),
      makeInvoiceLaterBlocked: inv.required || cancelled ? null : istSameMonth(order.placedAt) ? null : 'NOT_THIS_MONTH',
    },
  };
}

export async function getSale({ viewer, id }) {
  const order = await S.findSale(id);
  if (!order) throw NOT_FOUND();
  return saleReply(order, viewer);
}

// Today's sales, newest first. Owners: everyone's, with the day's totals, and today's
// paid online orders too, so the total matches Home (Module 8). Staff: their own, no
// totals (6.13).
export async function today({ viewer, now = new Date(), offset = 0, limit = PAGE_SIZE }) {
  const owner = isOwner(viewer);
  const from = istDayStart(now);
  const to = new Date(from.getTime() + 24 * 60 * 60 * 1000);
  const [all, online] = await Promise.all([S.salesSince(from, to), owner ? onlineSince(from, to) : []]);
  const sellerOf = await S.sellers(all.map((o) => o.orderNumber));
  const orders = owner ? all : all.filter((o) => sellerOf.get(o.orderNumber) === viewer.id);
  const names = await namesFor([...sellerOf.values()]);
  const row = (o) => ({
    id: o.id,
    orderNumber: o.orderNumber,
    placedAt: iso(o.placedAt),
    time: istTime(o.placedAt),
    channel: o.channel,
    paymentMethod: o.channel === 'online' ? 'online' : o.paymentMethod,
    total: num(o.total),
    sarees: o.items.reduce((t, it) => t + it.quantity, 0),
    imageUrl: o.items.find((it) => it.imageSnapshot)?.imageSnapshot ?? null,
    soldBy: o.channel === 'online' ? null : person(sellerOf.get(o.orderNumber), names),
    customer: o.channel === 'online' ? customerOf(o).name || null : null,
    invoiceNumber: o.invoice?.invoiceNumber ?? null,
    invoiceRequired: o.channel === 'online' ? true : o.invoiceRequired,
    cancelled: isCancelled(o),
  });
  const sales = [...orders, ...online].sort((a, b) => b.placedAt - a.placedAt).map(row);
  let totals = null;
  if (owner) {
    const live = sales.filter((s) => !s.cancelled);
    const by = (key, m) => sumMoney(live.filter((s) => (s[key] ?? 'unknown') === m).map((s) => s.total));
    totals = {
      count: live.length,
      amount: sumMoney(live.map((s) => s.total)),
      sarees: live.reduce((t, s) => t + s.sarees, 0),
      cancelled: sales.length - live.length,
      byPayment: { cash: by('paymentMethod', 'cash'), upi: by('paymentMethod', 'upi'), card: by('paymentMethod', 'card'), online: by('paymentMethod', 'online'), unknown: by('paymentMethod', 'unknown') },
      byChannel: Object.fromEntries(['store', 'whatsapp', 'online'].map((c) => [c, { amount: by('channel', c), bills: live.filter((s) => s.channel === c).length }])),
    };
  }
  // The day's totals cover every sale; the list comes 20 at a time. counts: bills and sarees
  // (not cancelled) over the whole day, for everyone (Home uses them; staff see no money).
  const kept = sales.filter((x) => !x.cancelled);
  const counts = { bills: kept.length, sarees: kept.reduce((t, x) => t + x.sarees, 0) };
  const page = pageOf(sales, { offset, limit });
  return { date: istDate(now), scope: owner ? 'everyone' : 'mine', sales: page.items, nextOffset: page.nextOffset, total: page.total, totals, counts };
}

/* ---------- the invoice again ---------- */

export async function makeInvoice({ viewer, id, ctx }) {
  const order = await S.findSale(id);
  if (!order) throw NOT_FOUND();
  await saleReply(order, viewer); // access check
  if (!order.invoiceRequired) throw conflict('NO_INVOICE', 'This sale was recorded without an invoice.');
  try {
    if (order.invoice) {
      if (isCancelled(order) && !isStamped(order.invoice)) await stampCancelled(id);
    } else {
      if (isCancelled(order)) throw conflict('ALREADY_CANCELLED', 'This sale was cancelled, so it gets no invoice.');
      const inv = await ensureInvoice(id, viewer.id);
      await audit('invoice_generated', { accountId: viewer.id, ctx, metadata: { orderId: id, orderNumber: order.orderNumber, invoiceNumber: inv.invoiceNumber, actorId: viewer.id, summary: `Invoice ${inv.invoiceNumber} made again for order ${order.orderNumber}` } });
    }
  } catch (e) {
    if (e.status) throw e;
    console.error(`[sale] invoice for ${order.orderNumber} failed again: ${e.message}`);
    throw unavailable('INVOICE_FAILED', 'The invoice couldn\'t be made just now. The sale is saved. Try again in a minute.');
  }
  return saleReply(await S.findSale(id), viewer);
}

/* ---------- an invoice made later (Module 6, decision 6.5) ---------- */

// A customer comes back for an invoice for a sale recorded without one. Same month
// as the sale, so a month that may be filed for GST never changes. The invoice takes
// the next number and today's date; the sale's date is printed on it too.
export async function makeInvoiceLater({ viewer, id, ctx }) {
  const order = await S.findSale(id);
  if (!order) throw NOT_FOUND();
  await saleReply(order, viewer); // access check: owners any sale, Staff their own
  if (isCancelled(order)) throw conflict('ALREADY_CANCELLED', 'This sale was cancelled, so it gets no invoice.');
  if (order.invoice) return saleReply(order, viewer); // already made (a repeat): the same invoice
  if (!order.invoiceRequired && !istSameMonth(order.placedAt)) throw conflict('NOT_THIS_MONTH', `An invoice can be made only in the month of the sale. This sale was on ${istDate(order.placedAt)}.`);
  // A second tap that arrives while the first is making it finds the sale already
  // switched to "invoice": it waits for the same invoice (the lock in ensureInvoice).
  const claim = order.invoiceRequired ? { count: 0 } : await prisma.order.updateMany({ where: { id, invoiceRequired: false }, data: { invoiceRequired: true } });
  let inv;
  try {
    inv = await ensureInvoice(id, viewer.id);
  } catch (e) {
    if (claim.count) await prisma.order.updateMany({ where: { id, invoice: null }, data: { invoiceRequired: false } });
    console.error(`[sale] invoice later for ${order.orderNumber} failed: ${e.message}`);
    throw unavailable('INVOICE_FAILED', 'The invoice couldn\'t be made just now. Nothing was changed. Try again in a minute.');
  }
  // Two taps at once make one invoice (the lock in ensureInvoice); only the one that
  // switched the sale to "invoice" records it.
  if (claim.count) await audit('invoice_made_later', {
    accountId: viewer.id, ctx, metadata: { orderId: id, orderNumber: order.orderNumber, invoiceNumber: inv.invoiceNumber, saleDate: iso(order.placedAt), actorId: viewer.id, summary: `Invoice ${inv.invoiceNumber} made later for sale ${order.orderNumber} (${istDate(order.placedAt)})` },
  });
  return saleReply(await S.findSale(id), viewer);
}

/* ---------- cancel (6.2) ---------- */

export async function cancelSale({ viewer, id, reason, ctx }) {
  const order = await S.findSale(id);
  if (!order) throw NOT_FOUND();
  const blocked = cancelBlock(order, viewer);
  if (blocked === 'ALREADY_CANCELLED') throw conflict('ALREADY_CANCELLED', 'This sale was already cancelled.');
  if (blocked === 'OWNERS_ONLY') throw forbidden('FORBIDDEN', 'Only owners can cancel a sale.');
  if (blocked === 'NOT_TODAY') throw conflict('NOT_TODAY', `Only today's sales can be cancelled. This one was on ${istDate(order.placedAt)}.`);
  if (blocked === 'SHIPPED') throw conflict('SHIPPED', 'This WhatsApp order has been shipped, so it can\'t be cancelled here.');

  const now = new Date();
  const restocked = [];
  await prisma.$transaction(async (tx) => {
    const claim = await tx.order.updateMany({ where: { id, status: { not: 'cancelled' }, cancelledAt: null }, data: { status: 'cancelled', cancelledAt: now, cancelledById: viewer.id, cancelReason: reason } });
    if (claim.count !== 1) throw conflict('ALREADY_CANCELLED', 'This sale was already cancelled.');
    const channel = order.channel === 'whatsapp' ? 'whatsapp' : 'store';
    for (const it of order.items) {
      if (it.pieceId) {
        const back = await tx.piece.updateMany({ where: { id: it.pieceId, status: 'sold_offline' }, data: { status: 'in_stock', soldAt: null } });
        if (back.count !== 1) continue;
        restocked.push(it.piece.barcode);
      } else {
        // An old-app line counted by quantity, without a tag.
        await tx.product.update({ where: { id: it.productId }, data: { stock: { increment: it.quantity } } });
      }
      await tx.stockLedger.create({ data: { productId: it.productId, pieceId: it.pieceId, delta: it.quantity, reason: 'sale_cancelled', channel, actorId: viewer.id, ref: order.orderNumber } });
    }
    if (order.invoice) await tx.invoice.update({ where: { id: order.invoice.id }, data: { cancelledAt: now } });
  });
  await audit('sale_cancelled', {
    accountId: viewer.id,
    ctx,
    metadata: { orderId: id, orderNumber: order.orderNumber, invoiceNumber: order.invoice?.invoiceNumber ?? null, total: num(order.total), reason, backInStock: restocked, actorId: viewer.id, summary: `Sale ${order.orderNumber} cancelled (${reason}). ${restocked.length} back in stock.` },
  });
  if (order.invoice) {
    try {
      await stampCancelled(id);
    } catch (e) {
      console.error(`[sale] ${order.orderNumber} cancelled; its invoice PDF could not be stamped yet: ${e.message}`);
    }
  }
  return { ...(await saleReply(await S.findSale(id), viewer)), backInStock: restocked };
}
