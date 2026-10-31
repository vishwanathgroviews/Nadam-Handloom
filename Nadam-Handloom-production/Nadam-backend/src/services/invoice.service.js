// Invoices for counter and WhatsApp sales (Module 5). Same numbers, GST sums and
// fields as the old backend's generateInvoiceForOrder, so old and new invoices sit
// in one list.
//
// - Making an invoice is safe to repeat: an order has at most one (Invoice.orderId is
//   unique), and a repeat returns it.
// - The number is taken in the same step that saves the invoice, so a failed PDF
//   never uses up a number and two phones never share one.
// - A cancelled sale's invoice is kept, with its PDF stamped CANCELLED.
import { prisma } from '../config/database.js';
import { env } from '../config/env.js';
import * as S from '../models/sale.model.js';
import { isUniqueClash } from '../models/product.model.js';
import { renderInvoicePdf } from './invoicePdf.service.js';
import { shopDetailsAt } from './settings.service.js';
import { storage } from './storage/index.js';
import { billGst, sumMoney } from '../utils/gst.js';
import { istDate, istSameDay } from '../utils/day.js';

export const PAID_BY_TEXT = { cash: 'Cash', upi: 'UPI', card: 'Card' };
// Website W6: how an online order was paid (Razorpay's method names).
export const ONLINE_METHOD_TEXT = { upi: 'UPI', card: 'Card', netbanking: 'Net banking', wallet: 'Wallet', emi: 'EMI', paylater: 'Pay later' };
const paidByOf = (order) => (order.channel === 'online'
  ? `Paid online${ONLINE_METHOD_TEXT[order.paymentMethod] ? ` (${ONLINE_METHOD_TEXT[order.paymentMethod]})` : ''}`
  : PAID_BY_TEXT[order.paymentMethod] ?? null);

// Website W6 (decision 6.12): an online order's place of supply is its delivery state; it gets
// IGST when that is not the shop's state and the shop has turned IGST on (after the accountant).
export function taxPlace(order) {
  const delivered = order.channel === 'online' && order.shippingAddress?.state ? String(order.shippingAddress.state).trim() : '';
  const placeOfSupply = delivered || env.company.state;
  const igst = env.company.igstOtherStates && !!delivered && delivered.toLowerCase() !== env.company.state.trim().toLowerCase();
  return { placeOfSupply, igst };
}
const STAMPED_FOLDER = 'invoices/cancelled';

// An online order paid with Razorpay's TEST keys on the live server (payments being tried): its
// invoice gets a TEST- number and says "Test invoice, not a tax invoice" (the real series stays).
export const testPaymentInvoice = (order) => order.channel === 'online' && env.isProduction && env.payments.mode === 'test';
export const isTestInvoiceNumber = (number) => String(number || '').startsWith('TEST-');

// The customer on the order, as the old backend reads it.
export function customerOf(order) {
  const a = order.shippingAddress && typeof order.shippingAddress === 'object' ? order.shippingAddress : {};
  return { name: a.fullName || null, mobile: a.phone || null, address: a.line1 || null };
}

// A cancelled invoice whose PDF already carries the stamp.
export const isStamped = (invoice) => !!invoice?.storageKey?.startsWith(`${STAMPED_FOLDER}/`);

// invoiceDate: when the invoice was made (now for a new one). A later invoice also
// prints the sale's own date. ratePercent: the GST rate of the invoice (a PDF made again
// for an existing invoice uses the rate stored with it, not today's).
async function pdfFor(order, number, cancelled, invoiceDate = new Date(), ratePercent = env.company.gstRatePercent, igst = null) {
  const place = taxPlace(order);
  const useIgst = igst ?? place.igst;
  const lines = order.items.map((it) => ({ name: it.nameSnapshot, tag: it.piece?.barcode ?? null, price: Number(it.priceSnapshot), quantity: it.quantity }));
  const amounts = order.items.map((it) => Number(it.priceSnapshot) * it.quantity);
  const customer = customerOf(order);
  const company = await shopDetailsAt(invoiceDate); // Module 11: the shop details of the invoice's day
  const pdf = await renderInvoicePdf({
    company,
    number,
    orderNumber: order.orderNumber,
    date: istDate(invoiceDate),
    saleDate: istSameDay(order.placedAt, invoiceDate) ? null : istDate(order.placedAt),
    paidBy: paidByOf(order),
    customerName: customer.name,
    customerMobile: customer.mobile,
    lines,
    rate: ratePercent,
    gst: billGst(amounts, ratePercent),
    igst: useIgst,
    placeOfSupply: order.channel === 'online' ? place.placeOfSupply : null,
    total: sumMoney(amounts),
    cancelled,
    test: isTestInvoiceNumber(number),
  });
  return { pdf, amounts, customer };
}

// The order's invoice: made now if it has none yet. Throws when it can't be made.
export async function ensureInvoice(orderId, actorId) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await prisma.$transaction(async (tx) => {
        await S.lockInvoiceNumbering(tx);
        const order = await tx.order.findUnique({ where: { id: orderId }, include: S.SALE_INCLUDE });
        if (order.invoice) return order.invoice;
        const number = testPaymentInvoice(order) ? await S.nextTestInvoiceNumber(tx) : await S.nextInvoiceNumber(tx);
        const { pdf, amounts, customer } = await pdfFor(order, number, !!order.cancelledAt);
        const stored = await storage().upload({ buffer: pdf, contentType: 'application/pdf', folder: order.cancelledAt ? STAMPED_FOLDER : 'invoices', ext: 'pdf' });
        const gst = billGst(amounts, env.company.gstRatePercent);
        const place = taxPlace(order);
        try {
          return await tx.invoice.create({
            data: {
              invoiceNumber: number,
              orderId,
              channel: order.channel,
              customerName: customer.name,
              customerMobile: customer.mobile,
              gstRatePercent: env.company.gstRatePercent,
              taxableValue: gst.taxableValue,
              cgstAmount: place.igst ? 0 : gst.cgst,
              sgstAmount: place.igst ? 0 : gst.sgst,
              igstAmount: place.igst ? gst.gstAmount : 0,
              placeOfSupply: order.channel === 'online' ? place.placeOfSupply : null,
              totalAmount: sumMoney(amounts),
              storageKey: stored.key,
              url: stored.url,
              generatedBy: actorId,
              cancelledAt: order.cancelledAt,
            },
          });
        } catch (e) {
          storage().remove(stored.key).catch(() => {});
          throw e;
        }
      });
    } catch (e) {
      // The old app took the same number a moment ago: take the next one.
      if (isUniqueClash(e, 'invoiceNumber') && attempt < 4) continue;
      if (isUniqueClash(e, 'orderId')) return prisma.invoice.findUnique({ where: { orderId } });
      throw e;
    }
  }
}

// After the customer's name or mobile was corrected (Module 6, 6.11): the same number,
// date and amounts; a new PDF. The first PDF stays in storage, untouched.
export async function remakePdf(orderId) {
  const order = await S.findOrder(orderId);
  const inv = order.invoice;
  const cancelled = !!inv.cancelledAt || order.status === 'cancelled';
  const { pdf, customer } = await pdfFor(order, inv.invoiceNumber, cancelled, inv.generatedAt, Number(inv.gstRatePercent), Number(inv.igstAmount) > 0);
  const stored = await storage().upload({ buffer: pdf, contentType: 'application/pdf', folder: cancelled ? STAMPED_FOLDER : 'invoices', ext: 'pdf' });
  return prisma.invoice.update({ where: { id: inv.id }, data: { storageKey: stored.key, url: stored.url, customerName: customer.name, customerMobile: customer.mobile } });
}

// The PDF of an existing invoice, drawn again from the records and not stored (website W7:
// its stored file couldn't be read). The same number, date, rate, tax split and stamp.
export async function invoicePdfAgain(orderId) {
  const order = await S.findOrder(orderId);
  const inv = order?.invoice;
  if (!inv) return null;
  const cancelled = !!inv.cancelledAt || order.status === 'cancelled';
  const { pdf } = await pdfFor(order, inv.invoiceNumber, cancelled, inv.generatedAt, Number(inv.gstRatePercent), Number(inv.igstAmount) > 0);
  return pdf;
}

// After a cancel: the same invoice, its PDF re-made with the CANCELLED stamp. The
// first PDF stays in storage, untouched.
export async function stampCancelled(orderId) {
  const order = await S.findOrder(orderId);
  if (!order?.invoice || isStamped(order.invoice)) return order?.invoice ?? null;
  const { pdf } = await pdfFor(order, order.invoice.invoiceNumber, true, order.invoice.generatedAt, Number(order.invoice.gstRatePercent), Number(order.invoice.igstAmount) > 0);
  const stored = await storage().upload({ buffer: pdf, contentType: 'application/pdf', folder: STAMPED_FOLDER, ext: 'pdf' });
  return prisma.invoice.update({ where: { id: order.invoice.id }, data: { storageKey: stored.key, url: stored.url, cancelledAt: order.invoice.cancelledAt ?? order.cancelledAt ?? new Date() } });
}
