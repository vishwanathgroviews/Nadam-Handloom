// Invoices and the sales summary (Module 6): periods in India time, labels, checks.
// The server checks everything again.
import { normalizeMobile } from './phone';

const IST_MS = (5 * 60 + 30) * 60 * 1000;
export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const CHANNEL_TEXT = { store: 'Counter', whatsapp: 'WhatsApp', online: 'Online' };
export const CHANNEL_ICON = { store: 'store', whatsapp: 'whatsapp', online: 'cloud' };
export const PAY_TEXT = { cash: 'Cash', upi: 'UPI', card: 'Card', online: 'Online payment', none: 'Not recorded' };

// Today in India, as "2026-10-11", whatever the phone's own time zone.
export const todayIst = (now = Date.now()) => new Date(now + IST_MS).toISOString().slice(0, 10);
const pad = (n) => String(n).padStart(2, '0');
export const lastDayOf = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate(); // m: 1-12
export function addMonths(ym, n) {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;
}

// The chips (6.8): Today · This month · Last month · Custom · All.
export function periodRange(key, custom, now = Date.now()) {
  const t = todayIst(now);
  if (key === 'today') return { from: t, to: t };
  if (key === 'month') return { from: `${t.slice(0, 7)}-01`, to: t };
  if (key === 'last') {
    const ym = addMonths(t.slice(0, 7), -1);
    const [y, m] = ym.split('-').map(Number);
    return { from: `${ym}-01`, to: `${ym}-${pad(lastDayOf(y, m))}` };
  }
  if (key === 'all') return { from: '2020-01-01', to: t };
  return custom ? { from: custom.from, to: custom.to } : { from: t, to: t };
}

export const dayLabel = (ymd) => { const [y, m, d] = ymd.split('-').map(Number); return `${d} ${MONTHS[m - 1]} ${y}`; };
export const monthLabel = (ym) => { const [y, m] = ym.split('-').map(Number); return `${MONTHS_LONG[m - 1]} ${y}`; };
export function rangeLabel({ from, to }, now = Date.now()) {
  if (from === to) return dayLabel(from);
  const [y, m] = from.split('-').map(Number);
  if (from.endsWith('-01') && from.slice(0, 7) === to.slice(0, 7)) {
    if (to === `${from.slice(0, 7)}-${pad(lastDayOf(y, m))}`) return monthLabel(from.slice(0, 7));
    if (to === todayIst(now)) return `${monthLabel(from.slice(0, 7))} (so far)`;
  }
  return `${dayLabel(from)} – ${dayLabel(to)}`;
}
export const PERIOD_TEXT = { today: 'Today', month: 'This month', last: 'Last month', custom: 'Custom', all: 'All' };

// A month's days for the calendar, weeks starting Monday; days after today can't be picked.
export function monthGrid(ym, now = Date.now()) {
  const [y, m] = ym.split('-').map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1)).getUTCDay(); // 0 = Sunday
  const t = todayIst(now);
  const cells = Array.from({ length: (first + 6) % 7 }, () => null);
  for (let d = 1; d <= lastDayOf(y, m); d += 1) {
    const ymd = `${ym}-${pad(d)}`;
    cells.push({ ymd, day: d, future: ymd > t, today: ymd === t });
  }
  while (cells.length % 7) cells.push(null);
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}
// Tapping days: the first tap starts a range, the second ends it (either order).
export function pickDay(range, ymd) {
  if (!range?.from || (range.from && range.to)) return { from: ymd, to: null };
  return ymd < range.from ? { from: ymd, to: range.from } : { from: range.from, to: ymd };
}

// Correct the customer (6.11): a name up to 60 characters, a 10-digit mobile or none.
export function correctErrors({ name, mobile }) {
  const e = {};
  if ((name || '').trim().length > 60) e.name = 'Keep the name under 60 characters.';
  if (mobile && !normalizeMobile(mobile)) e.mobile = 'Enter a 10-digit mobile number, or leave it empty.';
  return e;
}
