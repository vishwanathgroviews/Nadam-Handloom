// How the checkout and the order page write times, addresses and the GST note.
import { rs } from '../../utils/money.js';

const timeFmt = new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' });
// "4:35 pm" (India time)
export const clock = (iso) => timeFmt.format(new Date(iso)).replace(/\s?([AP]M)$/i, (_, x) => ` ${x.toLowerCase()}`);

export const addressText = (a) => [a.line1, a.line2, a.landmark ? `Near ${a.landmark.replace(/^near\s+/i, '')}` : '', `${a.city}, ${a.state} ${a.pincode}`].filter(Boolean).join(', ');

// Prices include GST. Delivered outside the shop's state: IGST, once the accountant has
// confirmed it (the server's switch, 6.12); otherwise CGST + SGST.
export function gstText(total, state, gst = {}) {
  const rate = Number(gst?.ratePercent) || 5;
  const amount = total - total / (1 + rate / 100);
  const igst = !!gst?.igstOtherStates && !!state && state !== (gst?.shopState || 'Andhra Pradesh');
  const half = (rate / 2).toFixed(1).replace(/\.0$/, '');
  return igst
    ? `Includes IGST ${rate}% (${rs(amount)}): delivered to ${state}`
    : `Includes GST ${rate}% (${rs(amount)}): CGST ${half}% + SGST ${half}%`;
}
