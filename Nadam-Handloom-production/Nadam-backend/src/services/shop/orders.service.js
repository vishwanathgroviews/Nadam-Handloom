// Website W7: My orders (docs/modules/web-05-my-orders.md). The signed-in customer's own website
// orders only: the list, the invoice download and Buy again. One order's page is
// checkout.service's getOrder (W6), with the tracking, invoice and Buy again added (W7).
//
// - The list (rule 2): paid (being packed, shipped, delivered, cancelled by the shop after
//   paying), refunded, being confirmed, and a checkout whose sarees are still held. Never a
//   checkout that ended without a payment. Newest first, 20 at a time.
// - The invoice (7.6 A, rule 5): read from storage by our server after checking the order is
//   theirs and paid; its stored address is never given out.
// - Buy again (7.7 A, rule 6): the order's sarees back in the bag by the bag's rules (W5).
import * as C from '../../models/checkout.model.js';
import { presentOrder, customerStatus, BUY_AGAIN } from './checkout.service.js';
import { addOrderLines } from './bag.service.js';
import { invoicePdfAgain, isStamped } from '../invoice.service.js';
import { storage } from '../storage/index.js';
import { shopAudit } from '../audit.service.js';
import { conflict, notFound } from '../../utils/errors.js';

export const PAGE = 20;
const PHOTOS = 4;
const orderNotFound = () => notFound('ORDER_NOT_FOUND', 'We couldn\'t find this order.');
const SHOWN = new Set(['paid', 'shipped', 'delivered', 'cancelled_paid', 'refunded', 'confirming', 'awaiting_payment']);

// One row of the list: enough for its card (photos, what's next), not the whole order.
function presentRow(o) {
  return {
    number: o.number,
    status: o.status,
    placedAt: o.placedAt,
    total: o.total,
    pieces: o.pieces,
    sarees: o.lines.length,
    title: o.lines[0]?.name ?? null,
    photos: o.lines.slice(0, PHOTOS).map((l) => l.photo).filter(Boolean),
    more: Math.max(0, o.lines.length - PHOTOS),
    holdUntil: o.holdUntil,
    paidAt: o.payment?.paidAt ?? null,
    methodText: o.payment?.methodText ?? null,
    refund: o.refund,
    cancelled: o.cancelled,
    shipping: o.shipping,
    invoice: o.invoice,
    canBuyAgain: o.canBuyAgain,
    oldWebsite: o.oldWebsite,
  };
}

export async function listOrders({ accountId, offset = 0, now = new Date() }) {
  const rows = await C.listOwn(accountId, { now, skip: offset, take: PAGE + 1 });
  const more = rows.length > PAGE;
  const page = rows.slice(0, PAGE);
  const refunds = await C.handRefunds(page.filter((o) => customerStatus(o, now) === 'cancelled_paid').map((o) => o.payment?.razorpayPaymentId));
  const orders = page
    .map((o) => presentOrder(o, now, { handRefundAt: refunds.get(o.payment?.razorpayPaymentId) ?? null }))
    .filter((o) => SHOWN.has(o.status))
    .map(presentRow);
  return { orders, nextOffset: more ? offset + PAGE : null };
}

// The invoice PDF, for the customer whose order it is. { filename, pdf }.
export async function invoiceFile({ accountId, number, ctx }) {
  const order = await C.findOwn(number, accountId);
  if (!order) throw orderNotFound();
  if (order.payment?.status !== 'paid') throw notFound('NO_INVOICE', 'This order has no invoice: it wasn\'t paid.');
  if (!order.invoice) throw conflict('INVOICE_NOT_READY', 'Your invoice is being made. Check back in a few minutes.');
  const status = customerStatus(order);
  // Cancelled after paying, with a PDF not stamped yet (the stamp failed): drawn again, stamped.
  const needsStamp = status === 'cancelled_paid' && !isStamped(order.invoice);
  let pdf = needsStamp ? null : await storage().read(order.invoice.storageKey).catch((err) => {
    console.error(`[orders] invoice ${order.invoice.invoiceNumber} couldn't be read: ${err.message}`);
    return null;
  });
  if (!pdf) pdf = await invoicePdfAgain(order.id);
  if (!pdf) throw conflict('INVOICE_NOT_READY', 'Your invoice is being made. Check back in a few minutes.');
  await shopAudit('shop_invoice_downloaded', { accountId, ctx, metadata: { orderNumber: order.orderNumber, invoiceNumber: order.invoice.invoiceNumber } });
  return { filename: `${order.invoice.invoiceNumber}.pdf`, pdf };
}

export async function buyAgain({ accountId, number, ctx }) {
  const order = await C.findOwn(number, accountId);
  if (!order) throw orderNotFound();
  const o = presentOrder(order);
  if (!BUY_AGAIN.has(o.status)) throw conflict('CANT_BUY_AGAIN', o.status === 'awaiting_payment' ? 'This order is waiting for payment: pay for it, or change your bag.' : 'This order\'s sarees can\'t be added again.');
  const bag = await addOrderLines({ accountId, items: o.lines.map((l) => ({ slug: l.slug, name: l.name, quantity: l.quantity })) });
  await shopAudit('shop_buy_again', { accountId, ctx, metadata: { orderNumber: number, added: bag.buyAgain.added.length, raised: bag.buyAgain.raised.length, skipped: bag.buyAgain.skipped.length } });
  return bag;
}
