// The WhatsApp messages the bag opens (rule 15). Made here, in the customer's browser, and sent
// only when they press send in WhatsApp.
import { rs, pieces } from '../utils/money.js';

// "Send bag on WhatsApp": every saree that can be bought now, with its code, pieces, price and
// link. WhatsApp shows the first link's saree photo above the message (the server gives each
// saree page its own preview); the shop taps the others.
export function bagMessage(lines, origin = window.location.origin) {
  const buy = lines.filter((l) => l.buyable);
  const rows = buy.map((l, i) => `${i + 1}. ${l.name}\n   Code ${l.sku || l.slug} · ${l.quantity > 1 ? `${l.quantity} pieces × ${rs(l.price)} = ${rs(l.lineTotal)}` : `1 piece · ${rs(l.price)}`}\n   ${origin}/product/${l.slug}`);
  const total = buy.reduce((n, l) => n + l.lineTotal, 0);
  const count = buy.reduce((n, l) => n + l.quantity, 0);
  return `Hello Nandam Handlooms, I'd like to order these sarees from my bag:\n\n${rows.join('\n')}\n\nTotal: ${rs(total)} (${pieces(count)}, free delivery)`;
}

// A saree in the bag that sold or left the website: ask for one like it (its link shows the
// shop its photo while the page is still up).
export const similarMessage = (line, origin = window.location.origin) => `Hello Nandam Handlooms, this saree from my bag is no longer available. Do you have a similar one?\n${line.name}${line.sku ? `\nCode: ${line.sku}` : ''}\n${origin}/product/${line.slug}`;

export const whatsAppLink = (number, text) => `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
