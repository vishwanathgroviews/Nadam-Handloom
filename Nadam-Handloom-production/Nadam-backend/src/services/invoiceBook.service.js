// Module 6: the invoices list, one invoice, correcting the customer, and sales made
// without an invoice. Rules: docs/modules/module-06-invoices.md, sections 5, 6 and 8.
//
// - Owners and Staff find, open, share and print any invoice (sell.use); only Owners
//   see money totals (sales.view) (6.1).
// - Dates are the invoice date in India time (6.7); a search looks at every date.
// - A cancelled invoice is listed and marked, never counted (6.4).
// - Correcting the customer: owners, the invoice's own month, same number and amounts (6.11).
import { prisma } from '../config/database.js';
import { can, PERMISSION } from '../config/permissions.js';
import * as I from '../models/invoice.model.js';
import * as S from '../models/sale.model.js';
import { appRoleOf, displayNameOf } from '../models/authAccount.model.js';
import { audit } from './audit.service.js';
import { remakePdf, isStamped, PAID_BY_TEXT } from './invoice.service.js';
import { bargainsFor, invoiceShare } from './sale.service.js';
import { tagNumber } from '../utils/tags.js';
import { sumMoney } from '../utils/gst.js';
import { istRange, istDate, istTime, istSameMonth, istYmd } from '../utils/day.js';
import { badRequest, conflict, forbidden, notFound, unavailable } from '../utils/errors.js';
import { pageOf, PAGE_SIZE } from '../utils/page.js';

export const PAGE = PAGE_SIZE;
const num = (d) => (d == null ? null : Number(d));
const iso = (d) => (d ? d.toISOString() : null);
const isOwner = (viewer) => can(appRoleOf(viewer), PERMISSION.SALES_VIEW);
const NOT_FOUND = () => notFound('NOT_FOUND', 'This invoice isn\'t in the shop\'s records.');
const CHANNEL_TEXT = { store: 'Counter', whatsapp: 'WhatsApp', online: 'Online' };

// "Walk-in customer" when none was given; old WhatsApp invoices have only a mobile.
export function customerLabel(inv) {
  if (inv.customerName) return inv.customerName;
  return { whatsapp: 'WhatsApp customer', online: 'Online customer' }[inv.channel] || 'Walk-in customer';
}

// The period the app asked for: { from: 'YYYY-MM-DD', to: 'YYYY-MM-DD' } (India), checked.
export function rangeOf({ from, to }, { maxDays = null } = {}) {
  if (!from || !to) return null;
  if (to < from) throw badRequest('BAD_RANGE', 'The last day is before the first day.');
  if (from > istYmd()) throw badRequest('BAD_RANGE', 'The first day is in the future.');
  const r = istRange(from, to);
  if (maxDays && (r.to - r.from) / 86400000 > maxDays + 0.5) throw badRequest('RANGE_TOO_LONG', `Choose up to ${maxDays === 366 ? 'one year' : `${maxDays} days`} at a time.`);
  return r;
}

function presentRow(inv) {
  return {
    id: inv.id,
    number: inv.invoiceNumber,
    generatedAt: iso(inv.generatedAt),
    date: istDate(inv.generatedAt),
    day: istYmd(inv.generatedAt),
    time: istTime(inv.generatedAt),
    channel: inv.channel,
    customer: customerLabel(inv),
    mobile: inv.customerMobile ?? null,
    total: num(inv.totalAmount),
    cancelled: I.isCancelledInvoice(inv),
    paymentMethod: inv.order?.paymentMethod ?? null,
    orderNumber: inv.order?.orderNumber ?? null,
  };
}

export async function listInvoices({ viewer, q = '', from, to, channel = 'all', cancelled = false, offset = 0, limit = PAGE }) {
  const range = q.trim() ? null : rangeOf({ from, to });
  const where = I.listWhere({ q, range, channel, cancelled });
  let rows = await I.listPage(where, { skip: offset, take: limit + 1 });
  let nextOffset = null;
  if (rows.length > limit) { rows = rows.slice(0, limit); nextOffset = offset + limit; }
  const owner = isOwner(viewer);
  return {
    invoices: rows.map(presentRow),
    nextOffset,
    scope: owner ? 'owner' : 'staff',
    totals: owner ? await I.totals(where) : null,
  };
}

async function nameOf(id) {
  if (!id) return null;
  const a = await prisma.authAccount.findUnique({ where: { id }, include: { adminProfile: true, userProfile: true } });
  return a ? displayNameOf(a) : 'Former team member';
}

function correctBlock(inv, viewer) {
  if (!isOwner(viewer)) return 'OWNERS_ONLY';
  if (I.isCancelledInvoice(inv)) return 'CANCELLED';
  if (inv.channel === 'online') return 'ONLINE';
  if (!istSameMonth(inv.generatedAt)) return 'NOT_THIS_MONTH';
  return null;
}

async function invoiceReply(inv, viewer) {
  const order = inv.order;
  const sellerId = (await S.sellers([order.orderNumber])).get(order.orderNumber) ?? null;
  const bargains = await bargainsFor(order.id);
  const lines = order.items.map((it) => {
    const price = num(it.priceSnapshot);
    const storePrice = bargains.get(it.pieceId) ?? bargains.get(it.productId) ?? price;
    return { id: it.id, code: it.piece?.barcode ?? null, number: it.piece ? tagNumber(it.piece.barcode) : null, name: it.nameSnapshot, imageUrl: it.imageSnapshot, quantity: it.quantity, price, storePrice };
  });
  const cancelled = I.isCancelledInvoice(inv);
  const blocked = correctBlock(inv, viewer);
  const address = order.shippingAddress && typeof order.shippingAddress === 'object' ? order.shippingAddress : {};
  const owner = isOwner(viewer);
  return {
    invoice: {
      ...presentRow(inv),
      customerName: inv.customerName ?? null,
      address: inv.channel === 'whatsapp' || inv.channel === 'online' ? address.line1 || null : null,
      lines,
      savings: sumMoney(lines.map((l) => Math.max(0, l.storePrice - l.price) * l.quantity)),
      gst: { ratePercent: num(inv.gstRatePercent), taxableValue: num(inv.taxableValue), cgst: num(inv.cgstAmount), sgst: num(inv.sgstAmount) },
      paidBy: PAID_BY_TEXT[order.paymentMethod] ?? null,
      orderId: order.id,
      soldBy: sellerId ? { id: sellerId, name: await nameOf(sellerId) } : null,
      saleDate: istYmd(order.placedAt) !== istYmd(inv.generatedAt) ? istDate(order.placedAt) : null,
      cancelledReason: cancelled ? order.cancelReason ?? null : null,
      url: inv.url,
      stamped: isStamped(inv),
      ...invoiceShare(inv.invoiceNumber, num(inv.totalAmount)),
    },
    actions: {
      correct: !blocked,
      correctBlocked: blocked,
      // The sale's page (Module 5): owners any, Staff their own; online orders are Module 7.
      openSale: inv.channel !== 'online' && (owner || sellerId === viewer.id),
    },
  };
}

export async function getInvoice({ viewer, id }) {
  const inv = await I.findOne(id);
  if (!inv) throw NOT_FOUND();
  return invoiceReply(inv, viewer);
}

// 6.11: a typo in the name, or the name added when the customer asks. Amounts never change.
export async function correctCustomer({ viewer, id, name, mobile, ctx }) {
  const inv = await I.findOne(id);
  if (!inv) throw NOT_FOUND();
  const blocked = correctBlock(inv, viewer);
  if (blocked === 'OWNERS_ONLY') throw forbidden('FORBIDDEN', 'Only owners can correct an invoice.');
  if (blocked === 'CANCELLED') throw conflict('ALREADY_CANCELLED', 'This invoice was cancelled with its sale. It can\'t be changed.');
  if (blocked === 'ONLINE') throw conflict('ONLINE_ORDER', 'An online order\'s customer comes from the website account. It can\'t be changed here.');
  if (blocked === 'NOT_THIS_MONTH') throw conflict('NOT_THIS_MONTH', `Only this month's invoices can be corrected. ${inv.invoiceNumber} is from ${istDate(inv.generatedAt)}.`);
  const before = { name: inv.customerName ?? null, mobile: inv.customerMobile ?? null };
  if (before.name === name && before.mobile === mobile) return invoiceReply(inv, viewer);
  const address = inv.order.shippingAddress && typeof inv.order.shippingAddress === 'object' ? { ...inv.order.shippingAddress } : {};
  if (name) address.fullName = name; else if (inv.channel === 'whatsapp') address.fullName = ''; else delete address.fullName;
  if (mobile) address.phone = mobile; else delete address.phone;
  await prisma.order.update({ where: { id: inv.orderId }, data: { shippingAddress: address } });
  try {
    await remakePdf(inv.orderId);
  } catch (e) {
    // Put the order back so the PDF and the record never disagree.
    await prisma.order.update({ where: { id: inv.orderId }, data: { shippingAddress: inv.order.shippingAddress } });
    console.error(`[invoice] ${inv.invoiceNumber}: PDF could not be re-made: ${e.message}`);
    throw unavailable('INVOICE_FAILED', 'The invoice couldn\'t be made again just now. Nothing was changed. Try again in a minute.');
  }
  await audit('invoice_customer_corrected', {
    accountId: viewer.id,
    ctx,
    metadata: { invoiceId: id, invoiceNumber: inv.invoiceNumber, orderId: inv.orderId, from: before, to: { name, mobile }, actorId: viewer.id, summary: `${inv.invoiceNumber}: customer corrected (${before.name || 'no name'} → ${name || 'no name'})` },
  });
  return invoiceReply(await I.findOne(id), viewer);
}

// Owners: this period's counter and WhatsApp sales recorded without an invoice (6.3),
// each one a tap from "Make an invoice" (6.5).
export async function salesWithoutInvoice({ from, to, channel = 'all', offset = 0, limit = PAGE_SIZE }) {
  const range = rangeOf({ from, to });
  const channels = channel === 'all' ? ['store', 'whatsapp'] : [channel];
  const orders = await I.salesWithout({ range, channels });
  const sellerOf = await S.sellers(orders.map((o) => o.orderNumber));
  const ids = [...new Set([...sellerOf.values()])];
  const people = ids.length ? await prisma.authAccount.findMany({ where: { id: { in: ids } }, include: { adminProfile: true, userProfile: true } }) : [];
  const names = new Map(people.map((p) => [p.id, displayNameOf(p)]));
  const sales = orders.map((o) => ({
    id: o.id,
    orderNumber: o.orderNumber,
    date: istDate(o.placedAt),
    time: istTime(o.placedAt),
    channel: o.channel,
    total: num(o.total),
    sarees: o.items.reduce((t, it) => t + it.quantity, 0),
    imageUrl: o.items.find((it) => it.imageSnapshot)?.imageSnapshot ?? null,
    paymentMethod: o.paymentMethod,
    soldBy: sellerOf.get(o.orderNumber) ? names.get(sellerOf.get(o.orderNumber)) ?? 'Former team member' : null,
    canMakeInvoice: istSameMonth(o.placedAt),
  }));
  const page = pageOf(sales, { offset, limit });
  return { sales: page.items, nextOffset: page.nextOffset, total: page.total, totals: { count: sales.length, amount: sumMoney(sales.map((s) => s.total)) } };
}

export { CHANNEL_TEXT };
