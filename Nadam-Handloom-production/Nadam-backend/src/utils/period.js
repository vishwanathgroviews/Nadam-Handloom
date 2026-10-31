// Analytics periods (Module 9, decisions 6.2 and 6.3), as India days 'YYYY-MM-DD'.
// Each period comes with the one before it: the same number of days just before;
// This month: the same days of last month; Last month: the month before.
import { istYmd } from './day.js';

export const PERIODS = ['today', '7d', '30d', 'month', 'last', 'custom'];
export const MAX_DAYS = 731; // two years at a time

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const pad = (n) => String(n).padStart(2, '0');
export function addDays(ymd, n) {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
export const daysIn = (from, to) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000) + 1;
const lastDay = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const monthBefore = (y, m) => (m === 1 ? [y - 1, 12] : [y, m - 1]);
export const dowOf = (ymd) => new Date(`${ymd}T00:00:00Z`).getUTCDay();
export const dayMonth = (ymd) => `${Number(ymd.slice(8))} ${MONTHS[Number(ymd.slice(5, 7)) - 1]}`;

// "Mon 12 Oct 2026", "1–12 Oct 2026", "13 Sep – 12 Oct 2026"
export function rangeText({ from, to }) {
  if (from === to) return `${DOW[dowOf(from)]} ${dayMonth(from)} ${from.slice(0, 4)}`;
  if (from.slice(0, 7) === to.slice(0, 7)) return `${Number(from.slice(8))}–${dayMonth(to)} ${to.slice(0, 4)}`;
  if (from.slice(0, 4) === to.slice(0, 4)) return `${dayMonth(from)} – ${dayMonth(to)} ${to.slice(0, 4)}`;
  return `${dayMonth(from)} ${from.slice(0, 4)} – ${dayMonth(to)} ${to.slice(0, 4)}`;
}

// { range: { from, to, label }, previous: { from, to, label } }. Throws a message for a bad custom range.
export function resolvePeriod({ period = 'month', from, to } = {}, now = new Date()) {
  const t = istYmd(now);
  const [y, m] = [Number(t.slice(0, 4)), Number(t.slice(5, 7))];
  const before = (r, label) => {
    const n = daysIn(r.from, r.to);
    const end = addDays(r.from, -1);
    return { from: addDays(end, -(n - 1)), to: end, label: label ?? `the ${n} days before` };
  };
  let range;
  let previous;
  if (period === 'today') { range = { from: t, to: t }; previous = before(range, 'yesterday'); }
  else if (period === '7d') { range = { from: addDays(t, -6), to: t }; previous = before(range); }
  else if (period === '30d') { range = { from: addDays(t, -29), to: t }; previous = before(range); }
  else if (period === 'last') {
    const [ly, lm] = monthBefore(y, m);
    const [py, pm] = monthBefore(ly, lm);
    range = { from: `${ly}-${pad(lm)}-01`, to: `${ly}-${pad(lm)}-${pad(lastDay(ly, lm))}` };
    previous = { from: `${py}-${pad(pm)}-01`, to: `${py}-${pad(pm)}-${pad(lastDay(py, pm))}`, label: MONTHS_LONG[pm - 1] };
  } else if (period === 'custom') {
    if (!from || !to) throw new Error('Choose the first and last day.');
    if (to < from) throw new Error('The last day is before the first day.');
    if (to > t) throw new Error('Choose days up to today.');
    if (daysIn(from, to) > MAX_DAYS) throw new Error('Choose up to two years at a time.');
    range = { from, to };
    previous = before(range);
  } else {
    const [py, pm] = monthBefore(y, m);
    range = { from: `${t.slice(0, 7)}-01`, to: t };
    const end = `${py}-${pad(pm)}-${pad(Math.min(Number(t.slice(8)), lastDay(py, pm)))}`;
    previous = { from: `${py}-${pad(pm)}-01`, to: end };
    previous.label = rangeText(previous);
  }
  return { period, range: { ...range, label: rangeText(range) }, previous };
}

// How the chart groups the period (6.4): hours for one day, days up to 92, then weeks.
export const chartUnit = ({ from, to }) => (from === to ? 'hour' : daysIn(from, to) > 92 ? 'week' : 'day');
