// Home (Module 8): the greeting, hidden amounts, the "Updated" time and the Needs
// attention list (plan sections 5 and 8). Kept here so they can be tested.
import { rupees } from './catalog';
import { plural } from './sales';

export const greeting = (hour) => (hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening');

// Decision 6.2: the eye button hides every ₹ on Home.
export const HIDDEN = '₹ ••••';
export const money = (v, hide) => (hide ? HIDDEN : rupees(v));

// "7:52 pm" on the phone's clock.
export function clockTime(at) {
  const d = new Date(at);
  const h = d.getHours();
  return `${h % 12 || 12}:${String(d.getMinutes()).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;
}
// "just now" for the first minute, then the time of the last update.
export const updatedText = (at, now = Date.now()) => (now - new Date(at).getTime() < 60000 ? 'just now' : clockTime(at));

// The Counter / WhatsApp / Online split, in the bar's order; empty channels left out of the bar.
export const CHANNELS = [['store', 'Counter'], ['whatsapp', 'WhatsApp'], ['online', 'Online']];

// The Needs attention lines, most urgent first; each only when there is something (6.4).
// data: the server's Home reply. The phone's own work: the bill, the photo draft, uploads.
// "back=home": Back on that screen returns to Home (hooks/useBack).
export function attentionList({ data, bill, batch, uploads, online = true, summarySeen = null }) {
  const a = data?.attention || {};
  const out = [];
  // Module 11: the staff app is paused (owners), so it is never left on by mistake.
  if (a.maintenance) out.push({ key: 'maintenance', icon: 'clock', tone: 'danger', title: 'Staff app paused', subtitle: `${a.maintenance.since ? `Since ${a.maintenance.sinceDate}, ${a.maintenance.since}` : 'Staff can\'t sell or ship'}${a.maintenance.by ? ` · by ${a.maintenance.by}` : ''} · tap to resume`, href: '/more/settings?back=home' });
  // Module 10 (6.8): a locked PIN or a blocked stolen sign-in in the last 24 hours (owners).
  if (a.security?.count) out.push({ key: 'security', icon: 'shield', tone: 'danger', title: `${a.security.count} security alert${a.security.count === 1 ? '' : 's'}`, subtitle: `${a.security.text} · ${a.security.time}`, href: '/more/activity?kind=signin&period=today&back=home' });
  if (bill?.pending) out.push({ key: 'bill', icon: 'receipt', tone: 'danger', title: 'A sale is waiting for an answer', subtitle: 'On this phone · open the bill to send it again', href: '/scan/bill?back=home' });
  else if (bill?.lines?.length) out.push({ key: 'bill', icon: 'receipt', tone: 'accent', title: `Your bill has ${plural(bill.lines.length, 'saree')}, not finished`, subtitle: 'On this phone · tap to finish it', href: '/scan/bill?back=home' });
  if (batch?.items?.length) {
    const tagged = batch.items.filter((i) => i.tag).length;
    out.push({ key: 'batch', icon: 'camera', tone: 'accent', title: `Sarees not saved yet: ${tagged} of ${plural(batch.items.length, 'photo')} tagged`, subtitle: `${batch.sub?.name || 'Add sarees'} · on this phone · continue`, href: '/products/add/scan' });
  }
  if (a.toShip?.count) {
    const d = a.toShip.oldestDays;
    out.push({ key: 'toShip', icon: 'orders', tone: d >= 1 ? 'warning' : 'primary', title: `${plural(a.toShip.count, 'order')} to ship`, subtitle: d >= 1 ? `Oldest waiting ${plural(d, 'day')}` : 'All from today', warn: d >= 1, href: '/orders?tab=to_ship' });
  }
  for (const inv of (a.invoiceMissing || []).slice(0, 3)) {
    out.push({ key: `invoice-${inv.id}`, icon: 'receipt', tone: 'danger', title: 'Invoice not made', subtitle: `${inv.today ? 'Today' : inv.date}, ${inv.time} · bill ${inv.orderNumber} · tap to make it`, href: `/scan/sale/${inv.id}?back=home` });
  }
  if (a.unpaid?.tries) out.push({ key: 'unpaid', icon: 'clock', tone: 'info', title: `${plural(a.unpaid.customers, 'customer')} didn't finish paying`, subtitle: `On the website this week · ${plural(a.unpaid.tries, 'try', 'tries')} · call them back`, href: '/orders/unpaid?back=home' });
  if (a.toCheck?.count) out.push({ key: 'toCheck', icon: 'box', tone: 'primary', title: `${plural(a.toCheck.count, 'parcel')} to check`, subtitle: `Shipped over 10 days ago (oldest ${a.toCheck.oldestShipped}), not marked delivered`, href: a.toCheck.count === 1 && a.toCheck.oldestId ? `/orders/order/${a.toCheck.oldestId}?back=home` : '/orders?tab=shipped' });
  if (uploads?.failed) out.push({ key: 'uploads', icon: 'alertc', tone: 'danger', title: `${plural(uploads.failed, 'saree needs', 'sarees need')} a different tag`, subtitle: 'On this phone · not uploaded', href: '/products/add/saving?back=home' });
  else if (uploads?.waiting) out.push({ key: 'uploads', icon: 'upload', tone: 'primary', title: online ? `Uploading ${plural(uploads.waiting, 'saree')}…` : `${plural(uploads.waiting, 'saree')} not uploaded yet`, subtitle: online ? 'On this phone · keep the app open' : 'On this phone · they upload when the internet is back', href: '/products/add/saving?back=home' });
  if (a.monthSummary && summarySeen !== a.monthSummary.key) out.push({ key: 'month', icon: 'calendar', tone: 'accent', title: `Send ${a.monthSummary.month}'s sales summary`, subtitle: 'For your accountant (GST) · PDF or Excel', href: '/more/invoices/summary?period=last&back=home', seen: a.monthSummary.key });
  if (a.stock) {
    const parts = [a.stock.soldOut ? `${plural(a.stock.soldOut, 'design')} sold out` : null, a.stock.low ? `${a.stock.low} running low` : null].filter(Boolean);
    out.push({ key: 'stock', icon: 'layers', tone: 'warning', title: parts.join(', '), subtitle: 'What to order from the weavers', href: '/home/low' });
  }
  if (a.noPhoto) out.push({ key: 'noPhoto', icon: 'image', tone: 'primary', title: `${plural(a.noPhoto, 'saree')} without a photo`, subtitle: 'The website shows a blank for them', href: '/products?filter=nophoto' });
  return out;
}
