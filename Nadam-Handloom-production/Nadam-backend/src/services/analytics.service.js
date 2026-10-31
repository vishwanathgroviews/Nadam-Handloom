// Analytics (Module 9, owners): for a period and channel, the headline against the
// period before, a chart, the designs sold, bargains, people, payment, busy hours and
// days; one person's figures; stock. Docs Module 9, sections 5, 6 and 8.
import * as A from '../models/analytics.model.js';
import * as S from '../models/sale.model.js';
import * as P from '../models/product.model.js';
import { appRoleOf, displayNameOf } from '../models/authAccount.model.js';
import { istRange, istYmd, istDate, istDay, istTime } from '../utils/day.js';
import { resolvePeriod, chartUnit, addDays, daysIn, dowOf, dayMonth } from '../utils/period.js';
import { badRequest, notFound } from '../utils/errors.js';

const IST_MS = (5 * 60 + 30) * 60 * 1000;
const DAY = 24 * 60 * 60 * 1000;
export const SLOW_DAYS = 60;
export const WEEKDAYS_AFTER = 28; // days of recorded sales before days of the week show (6.9)
// A store price that looks wrong: above the MRP, or more than 3 times the website price.
export const priceLooksWrong = ({ storePrice, onlinePrice, mrp }) => (mrp > 0 && storePrice > mrp) || (onlinePrice > 0 && storePrice > 3 * onlinePrice);

const num = (d) => Number(d ?? 0);
const money = (v) => Math.round(v * 100) / 100;
const pct = (a, b) => (b > 0 ? Math.round((100 * a) / b) : null);
const istHour = (d) => new Date(d.getTime() + IST_MS).getUTCHours();
const hourLabel = (h) => `${h % 12 || 12} ${h < 12 ? 'am' : 'pm'}`;
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function periodOf(q, now) {
  try {
    return resolvePeriod(q, now);
  } catch (e) {
    throw badRequest('BAD_RANGE', e.message);
  }
}
const asDates = (r) => istRange(r.from, r.to);

// One line of a sale, with its design and the store price it was sold against.
function linesOf(order, prices) {
  return order.items.map((it) => {
    const sub = it.product?.subcategory ?? null;
    const sold = num(it.priceSnapshot);
    // The line's own store price (Module 10, 6.3), else the bargain record in the log.
    const recorded = it.storePrice != null ? num(it.storePrice) : prices.get(`${order.id}:${it.pieceId ?? it.productId}`) ?? prices.get(`${order.id}:${it.productId}`);
    return {
      key: sub ? sub.id : `name:${it.nameSnapshot}`,
      designId: sub?.id ?? null,
      name: sub?.name ?? it.nameSnapshot,
      category: sub?.category?.name ?? null,
      imageUrl: sub?.imageUrl ?? it.imageSnapshot ?? null,
      quantity: it.quantity,
      sold: sold * it.quantity,
      // No bargain recorded: it was sold at the store price.
      store: (recorded ?? sold) * it.quantity,
      bargained: recorded != null && sold < recorded,
    };
  });
}

async function load(range, channel) {
  const orders = await A.ordersIn(asDates(range), channel);
  const [prices, sellerOf] = await Promise.all([
    A.bargainPrices(orders.filter((o) => o.channel !== 'online').map((o) => o.id)),
    S.sellers(orders.filter((o) => o.channel !== 'online').map((o) => o.orderNumber)),
  ]);
  return orders.map((o) => ({
    id: o.id, orderNumber: o.orderNumber, channel: o.channel, total: num(o.total), placedAt: o.placedAt,
    day: istYmd(o.placedAt), hour: istHour(o.placedAt),
    payment: o.channel === 'online' ? 'online' : o.paymentMethod ?? 'none',
    sellerId: o.channel === 'online' ? null : sellerOf.get(o.orderNumber) ?? null,
    lines: linesOf(o, prices),
  }));
}

const totalsOf = (sales) => {
  const amount = money(sales.reduce((t, s) => t + s.total, 0));
  const sarees = sales.reduce((t, s) => t + s.lines.reduce((n, l) => n + l.quantity, 0), 0);
  return { amount, bills: sales.length, sarees, avg: sales.length ? Math.round(amount / sales.length) : 0 };
};

function chartOf(range, sales) {
  const unit = chartUnit(range);
  if (unit === 'hour') {
    const hours = sales.map((s) => s.hour);
    const lo = Math.min(10, ...hours);
    const hi = Math.max(22, ...hours);
    const bars = [];
    for (let h = lo; h <= hi; h += 1) {
      const these = sales.filter((s) => s.hour === h);
      bars.push({ key: String(h), label: `${h % 12 || 12}${h < 12 ? 'a' : 'p'}`, title: hourLabel(h), amount: money(these.reduce((t, s) => t + s.total, 0)), bills: these.length });
    }
    return { unit, bars };
  }
  const byDay = new Map();
  for (const s of sales) {
    const d = byDay.get(s.day) || { amount: 0, bills: 0 };
    d.amount += s.total; d.bills += 1;
    byDay.set(s.day, d);
  }
  const bars = [];
  const step = unit === 'week' ? 7 : 1;
  for (let d = range.from; d <= range.to; d = addDays(d, step)) {
    let amount = 0;
    let bills = 0;
    const end = unit === 'week' ? (addDays(d, 6) > range.to ? range.to : addDays(d, 6)) : d;
    for (let x = d; x <= end; x = addDays(x, 1)) { const v = byDay.get(x); if (v) { amount += v.amount; bills += v.bills; } }
    bars.push({ key: d, label: unit === 'week' ? dayMonth(d) : String(Number(d.slice(8))), title: unit === 'week' ? `Week of ${dayMonth(d)}` : `${DOW[dowOf(d)]} ${dayMonth(d)}`, amount: money(amount), bills });
  }
  return { unit, bars };
}

function designsOf(sales) {
  const map = new Map();
  for (const s of sales) {
    for (const l of s.lines) {
      const d = map.get(l.key) || { id: l.designId, name: l.name, category: l.category, imageUrl: l.imageUrl, sarees: 0, amount: 0, store: 0, sold: 0, bargainSarees: 0 };
      d.sarees += l.quantity;
      d.amount += l.sold;
      if (!d.imageUrl && l.imageUrl) d.imageUrl = l.imageUrl;
      if (s.channel !== 'online') { d.store += l.store; d.sold += l.sold; d.bargainSarees += l.quantity; }
      map.set(l.key, d);
    }
  }
  return [...map.values()].map((d) => ({ ...d, amount: money(d.amount), paidPct: pct(d.sold, d.store) }))
    .sort((a, b) => b.sarees - a.sarees || b.amount - a.amount || a.name.localeCompare(b.name));
}

function bargainsOf(sales, designs) {
  const lines = sales.filter((s) => s.channel !== 'online').flatMap((s) => s.lines);
  if (!lines.length) return null;
  const store = lines.reduce((t, l) => t + l.store, 0);
  const sold = lines.reduce((t, l) => t + l.sold, 0);
  return {
    sarees: lines.reduce((n, l) => n + l.quantity, 0),
    bargained: lines.filter((l) => l.bargained).reduce((n, l) => n + l.quantity, 0),
    store: money(store),
    sold: money(sold),
    below: money(Math.max(0, store - sold)),
    paidPct: pct(sold, store),
    most: designs.filter((d) => d.bargainSarees >= 2 && d.paidPct != null && d.paidPct < 100).sort((a, b) => a.paidPct - b.paidPct).slice(0, 3)
      .map((d) => ({ id: d.id, name: d.name, imageUrl: d.imageUrl, sarees: d.bargainSarees, paidPct: d.paidPct })),
  };
}

async function peopleOf(sales) {
  const own = sales.filter((s) => s.channel !== 'online');
  const map = new Map();
  let notRecorded = null;
  for (const s of own) {
    const sarees = s.lines.reduce((n, l) => n + l.quantity, 0);
    const store = s.lines.reduce((t, l) => t + l.store, 0);
    if (!s.sellerId) {
      notRecorded = notRecorded || { bills: 0, sarees: 0, amount: 0 };
      notRecorded.bills += 1; notRecorded.sarees += sarees; notRecorded.amount += s.total;
      continue;
    }
    const p = map.get(s.sellerId) || { id: s.sellerId, bills: 0, sarees: 0, amount: 0, store: 0, sold: 0 };
    p.bills += 1; p.sarees += sarees; p.amount += s.total; p.store += store; p.sold += s.lines.reduce((t, l) => t + l.sold, 0);
    map.set(s.sellerId, p);
  }
  const accounts = new Map((await A.people([...map.keys()])).map((a) => [a.id, a]));
  const list = [...map.values()].map((p) => {
    const a = accounts.get(p.id);
    return { id: p.id, name: a ? displayNameOf(a) : 'Former team member', role: a ? (appRoleOf(a) === 'ADMIN' ? 'owner' : appRoleOf(a) === 'STAFF' ? 'staff' : 'former') : 'former', bills: p.bills, sarees: p.sarees, amount: money(p.amount), paidPct: pct(p.sold, p.store) };
  }).sort((a, b) => b.amount - a.amount);
  return { list, notRecorded: notRecorded ? { ...notRecorded, amount: money(notRecorded.amount) } : null };
}

function paymentsOf(sales) {
  const order = ['cash', 'upi', 'card', 'online', 'none'];
  const map = new Map();
  for (const s of sales) {
    const p = map.get(s.payment) || { method: s.payment, bills: 0, amount: 0 };
    p.bills += 1; p.amount += s.total;
    map.set(s.payment, p);
  }
  return [...map.values()].map((p) => ({ ...p, amount: money(p.amount) })).sort((a, b) => order.indexOf(a.method) - order.indexOf(b.method));
}

function hoursOf(sales) {
  const hours = sales.map((s) => s.hour);
  const lo = Math.min(10, ...hours);
  const hi = Math.max(22, ...hours);
  const out = [];
  for (let h = lo; h <= hi; h += 1) {
    const these = sales.filter((s) => s.hour === h);
    out.push({ hour: h, label: hourLabel(h), amount: money(these.reduce((t, s) => t + s.total, 0)), bills: these.length });
  }
  const top = out.reduce((b, x) => (x.amount > (b?.amount ?? 0) ? x : b), null);
  return { list: out, busiest: top && top.amount > 0 ? top.label : null };
}

function weekdaysOf(range, sales, first) {
  const start = first && first > range.from ? first : range.from;
  if (!first || start > range.to || daysIn(start, range.to) < WEEKDAYS_AFTER) return null;
  return [1, 2, 3, 4, 5, 6, 0].map((d) => {
    const these = sales.filter((s) => dowOf(s.day) === d);
    return { dow: d, label: DOW[d], amount: money(these.reduce((t, s) => t + s.total, 0)), bills: these.length };
  });
}

export async function summary({ period, from, to, channel = 'all', now = new Date() }) {
  const p = periodOf({ period, from, to }, now);
  const [sales, prev, cancelled, first] = await Promise.all([
    load(p.range, channel),
    A.totalsIn(asDates(p.previous), channel),
    A.cancelledIn(asDates(p.range), channel),
    A.firstSale(),
  ]);
  const firstDay = first ? istYmd(first.placedAt) : null;
  const designs = designsOf(sales);
  const totals = totalsOf(sales);
  return {
    period: p.period,
    channel,
    range: p.range,
    previous: { ...p.previous, ...prev, avg: prev.bills ? Math.round(prev.amount / prev.bills) : 0, beforeHistory: !firstDay || p.previous.to < firstDay },
    history: { firstDay, firstDate: firstDay ? istDate(first.placedAt) : null, partial: !firstDay || firstDay > p.range.from },
    totals,
    cancelled,
    chart: chartOf(p.range, sales),
    designs,
    bargains: channel === 'online' ? null : bargainsOf(sales, designs),
    people: channel === 'online' ? null : await peopleOf(sales),
    payments: paymentsOf(sales),
    hours: hoursOf(sales),
    weekdays: weekdaysOf(p.range, sales, firstDay),
  };
}

// One person's figures for the period (6.7).
export async function personFigures({ id, period, from, to, channel = 'all', now = new Date() }) {
  const account = await A.person(id);
  if (!account) throw notFound('NOT_FOUND', 'That person isn\'t in the team.');
  const p = periodOf({ period, from, to }, now);
  const sales = (await load(p.range, channel === 'online' ? 'all' : channel)).filter((s) => s.sellerId === id);
  const designs = designsOf(sales).slice(0, 5).map((d) => ({ id: d.id, name: d.name, imageUrl: d.imageUrl, sarees: d.sarees, amount: d.amount }));
  const store = sales.flatMap((s) => s.lines).reduce((t, l) => t + l.store, 0);
  const sold = sales.flatMap((s) => s.lines).reduce((t, l) => t + l.sold, 0);
  return {
    person: { id, name: displayNameOf(account), role: appRoleOf(account) === 'ADMIN' ? 'owner' : appRoleOf(account) === 'STAFF' ? 'staff' : 'former' },
    range: p.range,
    totals: { ...totalsOf(sales), paidPct: pct(sold, store) },
    designs,
    recent: sales.slice(-10).reverse().map((s) => {
      const st = s.lines.reduce((t, l) => t + l.store, 0);
      const sd = s.lines.reduce((t, l) => t + l.sold, 0);
      return { id: s.id, orderNumber: s.orderNumber, date: istDay(s.placedAt), time: istTime(s.placedAt), channel: s.channel, payment: s.payment, sarees: s.lines.reduce((n, l) => n + l.quantity, 0), total: s.total, paidPct: pct(sd, st) };
    }),
  };
}

// Stock (6.10): sarees in stock, value at store prices, the designs holding most of it,
// designs in stock that haven't sold for 60 days (in the shop at least that long), and
// designs whose store price looks wrong (they make the value and bargains wrong).
export async function stock({ now = new Date() } = {}) {
  const since = new Date(now.getTime() - SLOW_DAYS * DAY);
  const [rows, listings, first] = await Promise.all([A.stockByDesign(since), P.countInStock(), A.firstTagged()]);
  const designs = rows.map((r) => ({ id: r.id, name: r.name, category: r.category, imageUrl: r.imageUrl, storePrice: r.storePrice, onlinePrice: r.onlinePrice, mrp: r.mrp, inStock: r.inStock, value: money(r.inStock * r.storePrice), firstAdded: r.firstAdded, lastSold: r.lastSold ? istDay(r.lastSold) : null, soldRecent: r.soldRecent }));
  const slowFrom = first ? istYmd(new Date(first.createdAt.getTime() + SLOW_DAYS * DAY)) : null;
  const strip = ({ firstAdded, soldRecent, ...d }) => d;
  return {
    inStock: designs.reduce((n, d) => n + d.inStock, 0),
    listings,
    value: money(designs.reduce((t, d) => t + d.value, 0)),
    topValue: [...designs].sort((a, b) => b.value - a.value).slice(0, 5).map(strip),
    slow: designs.filter((d) => d.firstAdded <= since && d.soldRecent === 0).sort((a, b) => b.value - a.value).map(strip),
    priceChecks: designs.filter(priceLooksWrong).sort((a, b) => b.value - a.value).map(strip),
    slowDays: SLOW_DAYS,
    slowFrom: slowFrom && slowFrom > istYmd(now) ? slowFrom : null,
    slowFromText: slowFrom && slowFrom > istYmd(now) ? istDate(new Date(`${slowFrom}T12:00:00Z`)) : null,
  };
}
