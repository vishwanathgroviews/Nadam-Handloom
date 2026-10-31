// Module 9 (Analytics): the rules in plan sections 5, 6, 8 and 13.
// The figures are checked in February–March 2022, which only these tests use.
import crypto from 'node:crypto';
import { describe, it, expect, beforeAll } from 'vitest';
import { api, prisma, signedIn, authed } from '../support/helpers.js';
import { summary, personFigures, stock } from '../../src/services/analytics.service.js';

const C = '/api/v2/catalog';
const AN = '/api/v2/analytics';
const uid = () => crypto.randomUUID().slice(0, 8);
let seq = Math.floor(Math.random() * 200000) + 9100000;
const DAY = 86400000;
const ist = (s) => new Date(`${s}+05:30`);
const NOW = ist('2022-03-15T19:00:00');
let owner;
let staff;
let A;
let B;
const O = (m, u) => authed(m, u, owner.session, owner.device);
const S = (m, u) => authed(m, u, staff.session, staff.device);

async function newSub({ storePrice = 4000, websitePrice = 2800, mrp = 16999 } = {}) {
  const c = await O('post', `${C}/categories`).send({ name: `Cat ${uid()}`, description: 'Test category' });
  const s = await O('post', `${C}/categories/${c.body.category.id}/subcategories`).send({ name: `Sub ${uid()}`, description: 'Test', storePrice, websitePrice, mrp });
  expect(s.status, JSON.stringify(s.body)).toBe(201);
  return { ...s.body.subcategory, category: c.body.category };
}
async function product(sub) {
  const id = uid() + uid();
  return prisma.product.create({ data: { slug: `test-${id}`, sku: `T-${id}`, name: sub.name, categoryId: sub.category.id, subcategoryId: sub.id, channelVisibility: 'both', trackingMode: 'serialized', isActive: true } });
}
async function piece(sub, { status = 'in_stock', createdAt = new Date(), soldAt = null } = {}) {
  const p = await product(sub);
  return prisma.piece.create({ data: { productId: p.id, barcode: `NH${seq++}`, status, createdAt, soldAt } });
}
// A sale straight into the database: lines [{ sub, sold, store? }] (store = a recorded bargain).
async function sale({ at, channel = 'store', pay = channel === 'online' ? null : 'cash', seller = null, lines, cancelled = false }) {
  const prods = await Promise.all(lines.map((l) => product(l.sub)));
  const total = lines.reduce((t, l) => t + l.sold, 0);
  const o = await prisma.order.create({
    data: {
      orderNumber: `NH${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}`, channel, status: cancelled ? 'cancelled' : 'delivered', subtotal: total, total, placedAt: at, paymentMethod: pay, shippingAddress: {}, cancelledAt: cancelled ? at : null,
      items: { create: lines.map((l, i) => ({ productId: prods[i].id, nameSnapshot: l.sub.name, priceSnapshot: l.sold, quantity: 1, lineNo: i + 1 })) },
      ...(channel === 'online' ? { payment: { create: { razorpayOrderId: `order_${uid()}${uid()}`, status: 'paid', amount: total } } } : {}),
    },
  });
  if (seller) await prisma.stockLedger.create({ data: { productId: prods[0].id, delta: -1, reason: 'offline_sale', channel: 'store', actorId: seller, ref: o.orderNumber } });
  for (const [i, l] of lines.entries()) {
    if (l.store) await prisma.authEvent.create({ data: { eventType: 'offline_sale_price_override', metadata: { orderId: o.id, productId: prods[i].id, categoryStorePrice: l.store, salePrice: l.sold } } });
  }
  return o;
}

let o1;
beforeAll(async () => {
  owner = await signedIn({ role: 'ADMIN', name: 'Stats' });
  staff = await signedIn({ role: 'STAFF', name: 'Ravi' });
  A = await newSub({ storePrice: 4000 });
  B = await newSub({ storePrice: 3000 });
  o1 = await sale({ at: ist('2022-03-02T11:00:00'), pay: 'cash', seller: staff.account.id, lines: [{ sub: A, sold: 2000, store: 4000 }, { sub: B, sold: 3000 }] });
  await sale({ at: ist('2022-03-10T19:30:00'), channel: 'whatsapp', pay: 'upi', seller: owner.account.id, lines: [{ sub: A, sold: 3000, store: 4000 }] });
  await sale({ at: ist('2022-03-15T18:10:00'), channel: 'online', lines: [{ sub: B, sold: 2800 }] });
  await sale({ at: ist('2022-03-05T13:00:00'), cancelled: true, lines: [{ sub: A, sold: 9999 }] });
  await sale({ at: ist('2022-03-12T12:00:00'), pay: null, lines: [{ sub: A, sold: 4000 }] });
  await sale({ at: ist('2022-02-10T12:00:00'), lines: [{ sub: B, sold: 6000 }] });
  await sale({ at: ist('2022-03-16T00:01:00'), lines: [{ sub: B, sold: 7777 }] });
  await sale({ at: ist('2022-02-28T23:59:00'), lines: [{ sub: B, sold: 500 }] });
});

describe('who can open Analytics (6.1)', () => {
  it('Owners only; the server refuses staff', async () => {
    expect((await api().get(AN)).status).toBe(401);
    for (const path of [AN, `${AN}/stock`, `${AN}/people/${staff.account.id}`]) expect((await S('get', path)).status).toBe(403);
    const r = await O('get', `${AN}?period=7d`);
    expect(r.status).toBe(200);
    expect(r.body).toHaveProperty('totals.amount');
    expect(r.body.range.label).toMatch(/\d/);
    expect((await O('get', `${AN}?period=custom`)).status).toBe(400);
    expect((await O('get', `${AN}?period=custom&from=2026-01-10&to=2026-01-01`)).body.error.code).toBe('BAD_RANGE');
    expect((await O('get', `${AN}?period=custom&from=2020-01-01&to=2023-01-01`)).body.error.message).toMatch(/two years/);
    expect((await O('get', `${AN}?period=week`)).status).toBe(400);
  });
});

describe('the figures for a period (6.2–6.4, section 8)', () => {
  it('This month against the same days of last month; cancelled, unpaid and out-of-range sales left out', async () => {
    const s = await summary({ period: 'month', now: NOW });
    expect(s.range).toEqual({ from: '2022-03-01', to: '2022-03-15', label: '1–15 Mar 2022' });
    expect(s.previous).toMatchObject({ from: '2022-02-01', to: '2022-02-15', label: '1–15 Feb 2022', amount: 6000, bills: 1, beforeHistory: false });
    expect(s.totals).toEqual({ amount: 14800, bills: 4, sarees: 5, avg: 3700 });
    expect(s.cancelled).toEqual({ bills: 1, amount: 9999 });
    expect(s.chart.unit).toBe('day');
    expect(s.chart.bars).toHaveLength(15);
    expect(s.chart.bars[1]).toMatchObject({ key: '2022-03-02', label: '2', title: 'Wed 2 Mar', amount: 5000, bills: 1 });
    expect(s.chart.bars.reduce((t, b) => t + b.amount, 0)).toBe(14800);
    expect(s.history).toMatchObject({ firstDay: '2022-02-10', partial: false });
    expect(s.weekdays).toBeNull();
  });

  it('Today by hour, 7 days, last month, a long period by week, and days of the week after 4 weeks', async () => {
    const today = await summary({ period: 'today', now: NOW });
    expect(today.previous.label).toBe('yesterday');
    expect(today.chart.unit).toBe('hour');
    expect(today.chart.bars.find((b) => b.key === '18')).toMatchObject({ amount: 2800, bills: 1, title: '6 pm' });
    expect(today.totals.amount).toBe(2800);
    const week = await summary({ period: '7d', now: NOW });
    expect(week.range).toMatchObject({ from: '2022-03-09', to: '2022-03-15' });
    expect(week.previous).toMatchObject({ from: '2022-03-02', to: '2022-03-08', label: 'the 7 days before', amount: 5000 });
    expect(week.totals.amount).toBe(9800);
    const last = await summary({ period: 'last', now: NOW });
    expect(last.range).toMatchObject({ from: '2022-02-01', to: '2022-02-28', label: '1–28 Feb 2022' });
    expect(last.previous.label).toBe('January');
    expect(last.totals).toMatchObject({ amount: 6500, bills: 2 });
    const long = await summary({ period: 'custom', from: '2021-11-01', to: '2022-03-15', now: NOW });
    expect(long.chart.unit).toBe('week');
    expect(long.chart.bars.reduce((t, b) => t + b.amount, 0)).toBe(long.totals.amount);
    expect(long.history.partial).toBe(true);
    expect(long.previous.beforeHistory).toBe(true);
    const six = await summary({ period: 'custom', from: '2022-02-01', to: '2022-03-15', now: NOW });
    expect(six.weekdays).toHaveLength(7);
    expect(six.weekdays.reduce((t, d) => t + d.amount, 0)).toBe(six.totals.amount);
    await expect(summary({ period: 'custom', from: '2022-03-01', to: '2022-03-20', now: NOW })).rejects.toThrow(/up to today/);
  });

  it('A channel shows only its sales; online has no bargains or people', async () => {
    const store = await summary({ period: 'month', channel: 'store', now: NOW });
    expect(store.totals).toMatchObject({ amount: 9000, bills: 2 });
    const online = await summary({ period: 'month', channel: 'online', now: NOW });
    expect(online.totals).toMatchObject({ amount: 2800, bills: 1 });
    expect(online.bargains).toBeNull();
    expect(online.people).toBeNull();
  });
});

describe('designs, bargains, people, payment, hours (6.5–6.9)', () => {
  it('Best sellers by sarees; bargains against the store price recorded at the sale', async () => {
    const s = await summary({ period: 'month', now: NOW });
    expect(s.designs.map((d) => [d.id, d.sarees, d.amount])).toEqual([[A.id, 3, 9000], [B.id, 2, 5800]]);
    expect(s.designs[0]).toMatchObject({ name: A.name, category: A.category.name });
    expect(s.bargains).toEqual({ sarees: 4, bargained: 2, store: 15000, sold: 12000, below: 3000, paidPct: 80, most: [{ id: A.id, name: A.name, imageUrl: null, sarees: 3, paidPct: 75 }] });
  });

  it('Each person, the sales without a person, payment and the busiest hour', async () => {
    const s = await summary({ period: 'month', now: NOW });
    expect(s.people.list.map((p) => [p.id, p.role, p.bills, p.sarees, p.amount, p.paidPct])).toEqual([
      [staff.account.id, 'staff', 1, 2, 5000, 71],
      [owner.account.id, 'owner', 1, 1, 3000, 75],
    ]);
    expect(s.people.list[0].name).toBe('Ravi Person');
    expect(s.people.notRecorded).toEqual({ bills: 1, sarees: 1, amount: 4000 });
    expect(s.payments).toEqual([
      { method: 'cash', bills: 1, amount: 5000 },
      { method: 'upi', bills: 1, amount: 3000 },
      { method: 'online', bills: 1, amount: 2800 },
      { method: 'none', bills: 1, amount: 4000 },
    ]);
    expect(s.hours.busiest).toBe('11 am');
    expect(s.hours.list.find((h) => h.hour === 19)).toMatchObject({ amount: 3000, bills: 1 });
  });

  it('One person\'s figures, designs and last bills', async () => {
    const p = await personFigures({ id: staff.account.id, period: 'month', now: NOW });
    expect(p.person).toMatchObject({ name: 'Ravi Person', role: 'staff' });
    expect(p.totals).toMatchObject({ amount: 5000, bills: 1, sarees: 2, paidPct: 71 });
    expect(p.designs.map((d) => d.id).sort()).toEqual([A.id, B.id].sort());
    expect(p.recent).toHaveLength(1);
    expect(p.recent[0]).toMatchObject({ id: o1.id, payment: 'cash', sarees: 2, total: 5000, paidPct: 71 });
    await expect(personFigures({ id: crypto.randomUUID(), period: 'month', now: NOW })).rejects.toThrow(/isn't in the team/);
    const r = await O('get', `${AN}/people/${staff.account.id}?period=7d`);
    expect(r.status).toBe(200);
    expect(r.body.person.name).toBe('Ravi Person');
  });
});

describe('stock (6.10)', () => {
  it('Sarees in stock and their value; slow designs; prices that look wrong', async () => {
    const before = await stock();
    const plenty = await newSub({ storePrice: 4000 });
    for (let i = 0; i < 3; i += 1) await piece(plenty);
    const slow = await newSub({ storePrice: 3000 });
    await piece(slow, { createdAt: new Date(Date.now() - 70 * DAY) });
    const moving = await newSub({ storePrice: 3000 });
    await piece(moving, { createdAt: new Date(Date.now() - 70 * DAY) });
    await piece(moving, { status: 'sold_offline', createdAt: new Date(Date.now() - 70 * DAY), soldAt: new Date(Date.now() - 10 * DAY) });
    const aboveMrp = await newSub({ storePrice: 9000, websitePrice: 9000, mrp: 16999 });
    // The API refuses a store price above the MRP now; old rows (and the old app) can still have one.
    await prisma.subcategory.update({ where: { id: aboveMrp.id }, data: { storePrice: 20000 } });
    await piece(aboveMrp);
    const placeholder = await newSub({ storePrice: 9000, websitePrice: 2000, mrp: 16999 });
    await piece(placeholder);
    const after = await stock();
    expect(after.inStock - before.inStock).toBe(3 + 1 + 1 + 1 + 1);
    expect(Math.round(after.value - before.value)).toBe(12000 + 3000 + 3000 + 20000 + 9000);
    expect(after.topValue[0].value).toBeGreaterThanOrEqual(after.topValue[after.topValue.length - 1].value);
    const slowIds = after.slow.map((d) => d.id);
    expect(slowIds).toContain(slow.id);
    expect(slowIds).not.toContain(moving.id);
    expect(slowIds).not.toContain(plenty.id);
    const checks = after.priceChecks.map((d) => d.id);
    expect(checks).toEqual(expect.arrayContaining([aboveMrp.id, placeholder.id]));
    expect(checks).not.toContain(plenty.id);
    expect((await O('get', `${AN}/stock`)).body.inStock).toBe(after.inStock);
  });
});
