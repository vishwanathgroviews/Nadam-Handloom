// Orders and shipping (Module 7): tracking numbers, waiting text, links. The server
// checks everything again.
export const tidyAwb = (v) => String(v ?? '').toUpperCase().replace(/[\s-]/g, '');
export const isAwb = (v) => /^[A-Z0-9]{8,20}$/.test(v);
export const AWB_HINT = 'Scan the label, or type its number: 8 to 20 letters and digits.';

// "waiting 2 days" (amber from a day on, decision 6.2).
export function waitingText(days) {
  if (days == null) return '';
  if (days <= 0) return 'today';
  return `waiting ${days === 1 ? '1 day' : `${days} days`}`;
}

// The line under an order in the list.
export function rowStatus(o) {
  if (o.status === 'processing') return { text: waitingText(o.waitingDays), warn: o.waitingDays >= 1 };
  if (o.status === 'shipped') return o.checkDelivery ? { text: `Check delivery · shipped ${o.shippedDate}`, warn: true } : { text: `Shipped ${o.shippedDate} · ${o.carrier} ${o.awb}`, warn: false };
  if (o.status === 'delivered') return { text: `Delivered ${o.deliveredDate}`, warn: false };
  if (o.status === 'cancelled') return { text: 'Cancelled', warn: false };
  return { text: o.status, warn: false };
}

// Links for Call and WhatsApp (Indian mobiles, 10 digits).
export const telLink = (mobile) => `tel:+91${mobile}`;
export const waLink = (mobile, text) => `https://wa.me/91${mobile}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
// The ship-to card as one block, for "Copy address" (through the share menu).
export const addressText = (customer) => [customer.name, ...customer.lines, customer.mobile ? `Mobile: +91 ${customer.mobile}` : null].filter(Boolean).join('\n');

export const TAB_TEXT = { to_ship: 'To ship', shipped: 'Shipped', delivered: 'Delivered' };
export const CANCEL_REASONS = ['Customer changed their mind', 'Saree damaged while packing', 'Couldn\'t deliver to this address', 'Ordered twice by mistake'];
