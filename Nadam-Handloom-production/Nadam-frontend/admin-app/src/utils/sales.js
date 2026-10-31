// Scan to sell (Module 5): the bill's sums and the checks before "Complete sale".
// The server checks everything again; these keep the screens quick and clear.
import { rupees } from './catalog';
import { normalizeMobile } from './phone';

export const MAX_LINES = 100; // decision 6.10
export const MAX_PRICE = 1000000; // ₹10,00,000
export const PAY = { cash: 'Cash', upi: 'UPI', card: 'Card' };
export const PAY_ICON = { cash: 'cash', upi: 'upi', card: 'card' };
export { rupees };

// What the customer pays for one line: the agreed price, or the store price.
export const linePrice = (l) => (l.agreed != null ? l.agreed : l.storePrice);
const paise = (v) => Math.round(Number(v) * 100);

export function billTotals(lines = []) {
  const total = lines.reduce((t, l) => t + paise(linePrice(l)), 0);
  const store = lines.reduce((t, l) => t + paise(l.storePrice), 0);
  return { count: lines.length, total: total / 100, off: Math.max(0, store - total) / 100 };
}

// The agreed-price box: '' = store price (null); otherwise a number, or an error.
export function parsePrice(text) {
  const t = String(text ?? '').replace(/[₹,\s]/g, '');
  if (t === '') return { value: null };
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return { error: 'Type the price in rupees, like 2500 or 2499.50.' };
  const v = Number(t);
  if (!(v > 0)) return { error: 'The price must be more than ₹0. Leave it empty for the store price.' };
  if (v > MAX_PRICE) return { error: 'The price can be at most ₹10,00,000.' };
  return { value: Math.round(v * 100) / 100 };
}
export const priceText = (v) => (v == null ? '' : String(v));

// Decision 6.3: a price under half the store price asks "Is this right?".
export const isLowPrice = (agreed, storePrice) => agreed != null && storePrice > 0 && agreed < storePrice / 2;
// The first line with a very low price nobody has confirmed yet.
export const unconfirmedLow = (lines) => lines.find((l) => isLowPrice(l.agreed, l.storePrice) && l.lowOk !== l.agreed) ?? null;

// Complete sale (5.3): where, paid by and invoice are always required; a WhatsApp
// order also needs name, mobile and address (6.6); a counter customer is optional (6.5).
export function completeErrors(form, lines = []) {
  const e = {};
  if (!lines.length) e.lines = 'Scan at least one saree.';
  if (lines.length > MAX_LINES) e.lines = `A bill can have up to ${MAX_LINES} sarees. Remove some and sell them on a second bill.`;
  if (!form.where) e.where = 'Choose where the sale happened.';
  if (!form.pay) e.pay = 'Choose how it was paid.';
  if (form.invoice !== true && form.invoice !== false) e.invoice = 'Choose whether the customer needs an invoice.';
  const name = (form.name || '').trim();
  const address = (form.address || '').trim();
  if (form.where === 'whatsapp') {
    if (name.length < 2) e.name = 'Enter the customer\'s name.';
    if (!normalizeMobile(form.mobile)) e.mobile = 'Enter the customer\'s 10-digit mobile number.';
    if (address.length < 10) e.address = 'Enter the full delivery address.';
  } else if (form.mobile && !normalizeMobile(form.mobile)) e.mobile = 'Enter a 10-digit mobile number, or leave it empty.';
  if (name.length > 60) e.name = 'Keep the name under 60 characters.';
  return e;
}

// The request the server expects.
export function saleRequest(bill) {
  const f = bill.form;
  const wa = f.where === 'whatsapp';
  return {
    clientRef: bill.id,
    lines: bill.lines.map((l) => ({ pieceId: l.pieceId, price: linePrice(l), storePrice: l.storePrice, sellHeld: !!l.held })),
    channel: wa ? 'whatsapp' : 'store',
    paymentMethod: f.pay,
    invoice: f.invoice,
    customer: {
      ...(f.name?.trim() ? { name: f.name.trim() } : {}),
      ...(f.mobile ? { mobile: f.mobile } : {}),
      ...(wa && f.address?.trim() ? { address: f.address.trim() } : {}),
    },
  };
}

// The "can't be sold" card: a title and the way out, per reason from the server.
export const PROBLEM_TITLE = {
  ALREADY_SOLD: (code) => `${code} is already sold`,
  DAMAGED: () => 'Saree damaged: not for sale',
  ONLINE_ONLY: () => 'Set to Online only',
  SWITCHED_OFF: () => 'Switched off: not for sale',
  HELD_ONLINE: () => 'A customer is paying for it online',
  TAG_RETIRED: (code) => `${code} was replaced`,
  DELETED: () => 'This saree was deleted',
  NOT_FOR_SALE: () => 'Not in stock',
};
export const PROBLEM_ICON = { ALREADY_SOLD: 'alert', DAMAGED: 'broken', ONLINE_ONLY: 'eye', SWITCHED_OFF: 'eye', HELD_ONLINE: 'clock', TAG_RETIRED: 'barcode', DELETED: 'trash', NOT_FOR_SALE: 'alert' };

// Price check's badge for a looked-up saree.
export function stockBadgeFor(r) {
  if (r.sellable) return ['In stock · can be sold', 'success'];
  return ({
    ALREADY_SOLD: ['Already sold', 'neutral'], DAMAGED: ['Damaged', 'danger'], HELD_ONLINE: ['Held online', 'warning'], ONLINE_ONLY: ['Online only', 'neutral'],
    SWITCHED_OFF: ['Switched off', 'neutral'], TAG_RETIRED: ['Tag replaced', 'neutral'], DELETED: ['Deleted', 'neutral'],
  })[r.problem?.code] || ['Not for sale', 'neutral'];
}

export const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
export const CANCEL_REASONS = ['Customer changed their mind', 'Wrong saree', 'Wrong price', 'Billed twice by mistake'];
