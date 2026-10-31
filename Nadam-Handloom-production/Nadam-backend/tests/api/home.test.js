// Module 8 (Home): the rules in plan sections 5, 6, 8 and 13.
// The day figures are checked on a June 2023 day that only these tests use.
import crypto from 'node:crypto';
import { describe, it, expect, beforeAll } from 'vitest';
import { api, prisma, signedIn, authed } from '../support/helpers.js';
import { home, runningLow } from '../../src/services/home.service.js';
import { today } from '../../src/services/sale.service.js';
import { sumRange } from '../../src/models/stats.model.js';
import { findById } from '../../src/models/authAccount.model.js';

const C = '/api/v2/catalog';
const SA = '/api/v2/sales';
const H = '/api/v2/home';
const uid = () => crypto.randomUUID().slice(0, 8);
let seq = Math.floor(Math.random() * 300000) + 9300000;
const newTag = () => `NH${seq++}`;
const HOUR = 3600000;
const DAY = 24 * HOUR;
let owner;
let staff;
let staff2;
beforeAll(async () => {
  owner = await signedIn({ role: 'ADMIN', name: 'Home' });
  staff = await signedIn({ role: 'STAFF', name: 'Ravi' });
  staff2 = await signedIn({ role: 'STAFF', name: 'Anil' });
});
const as = (who) => (method, url) => authed(method, url, who.session, who.device);
const O = (m, u) => as(owner)(m, u);
const S = (m, u) => as(staff)(m, u);
const viewer = (who) => findById(who.account.id);

async function newSub({ storePrice = 3600 } = {}) {
  const c = await O('post', `${C}/categories`).send({ name: `Cat ${uid()}`, description: 'Test category' });
  const s = await O('post', `${C}/categories/${c.body.category.id}/subcategories`).send({ name: `Sub ${uid()}`, description: 'Test', storePrice, websitePrice: 2800, mrp: 16999 });
  expect(s.status, JSON.stringify(s.body)).toBe(201);
  return { ...s.body.subcategory, category: c.body.category };
}
async function saree(sub, { status = 'in_stock', soldAt = null, photo = true } = {}) {
  const id = uid() + uid();
  const p = await prisma.product.create({ data: { slug: `test-${id}`, sku: `T-${id}`, name: sub.name, categoryId: sub.category.id, subcategoryId: sub.id, channelVisibility: 'both', trackingMode: 'serialized', isActive: true } });
  if (photo) await prisma.productImage.create({ data: { productId: p.id, url: `http://test.local/${id}.jpg`, sortOrder: 0 } });
  const pc = await prisma.piece.create({ data: { productId: p.id, barcode: newTag(), status, soldAt: soldAt ?? (status.startsWith('sold') ? new Date() : null) } });
  return { productId: p.id, pieceId: pc.id, storePrice: Number(sub.storePrice) };
}
// An order straight into the database (the day figures don't care who made it).
let product;
async function order({ at, total, channel = 'store', status = channel === 'store' ? 'delivered' : 'delivered', quantity = 1, cancelled = false, extra = {} }) {
  return prisma.order.create({
    data: {
      orderNumber: `NH${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}`, channel, status, subtotal: total, total, placedAt: at, shippingAddress: channel === 'online' ? { fullName: 'Kavya Sri', phone: '9989012345' } : {},
      paymentMethod: channel === 'online' ? null : 'cash', invoiceRequired: false, cancelledAt: cancelled ? at : null,
      items: { create: [{ productId: product.productId, nameSnapshot: 'Test saree', priceSnapshot: total, quantity }] },
      ...extra,
    },
  });
}
const sell = async (who, x, { invoice = true } = {}) => {
  const r = await as(who)('post', SA).send({ clientRef: `bill-${uid()}${uid()}`, lines: [{ pieceId: x.pieceId, price: x.storePrice, storePrice: x.storePrice }], channel: 'store', paymentMethod: 'cash', invoice });
  expect(r.status, JSON.stringify(r.body)).toBe(201);
  return r.body.sale;
};

describe('who sees what (6.3)', () => {
  it('Owners get the money figures; Staff never get them from the server', async () => {
    expect((await api().get(H)).status).toBe(401);
    const ow = await O('get', H);
    expect(ow.status).toBe(200);
    expect(ow.body.scope).toBe('everyone');
    expect(ow.body.sales).toHaveProperty('today.amount');
    expect(ow.body.sales).toHaveProperty('yesterday.amount');
    expect(ow.body.sales.month.name).toMatch(/^[A-Z][a-z]+$/);
    expect(ow.body.stock).toMatchObject({ limit: 5000 });
    const st = await S('get', H);
    expect(st.status).toBe(200);
    expect(st.body.scope).toBe('mine');
    expect(Object.keys(st.body.sales)).toEqual(['mine']);
    expect(st.body.stock).toBeNull();
    expect(st.body.attention).toMatchObject({ unpaid: null, stock: null, monthSummary: null });
    expect(JSON.stringify(st.body)).not.toMatch(/"amount"/);
    expect((await S('get', `${H}/stock`)).status).toBe(403);
    expect((await O('get', `${H}/stock`)).status).toBe(200);
  });
});

describe('which sales count, by the India day (6.1, section 8)', () => {
  it('Today, yesterday and the month: counter, WhatsApp and paid online; not cancelled, not unpaid', async () => {
    const sub = await newSub();
    product = await saree(sub);
    const ist = (s) => new Date(`${s}+05:30`);
    const now = ist('2023-06-15T19:30:00');
    await order({ at: ist('2023-06-15T00:01:00'), total: 1000, quantity: 2 });
    await order({ at: ist('2023-06-15T10:00:00'), total: 3000, channel: 'whatsapp' });
    const online = await order({ at: ist('2023-06-15T12:00:00'), total: 4000, channel: 'online' });
    await order({ at: ist('2023-06-15T23:59:00'), total: 2000 });
    await order({ at: ist('2023-06-15T11:00:00'), total: 5000, status: 'cancelled', cancelled: true });
    await order({ at: ist('2023-06-15T13:00:00'), total: 6000, channel: 'online', status: 'pending_payment' });
    await order({ at: ist('2023-06-15T14:00:00'), total: 7000, channel: 'online', status: 'cancelled', cancelled: true, extra: { payment: { create: { razorpayOrderId: `order_${uid()}${uid()}`, status: 'paid', amount: 7000 } } } });
    // A checkout cancelled before it was paid (an owner's "Sell anyway"): not a sale at all.
    const neverPaid = await order({ at: ist('2023-06-15T15:00:00'), total: 8000, channel: 'online', status: 'cancelled', cancelled: true });
    await order({ at: ist('2023-06-14T23:59:00'), total: 800 });
    await order({ at: ist('2023-06-02T12:00:00'), total: 500 });
    await order({ at: ist('2023-06-01T00:01:00'), total: 100 });
    await order({ at: ist('2023-05-31T23:59:00'), total: 900 });
    await order({ at: ist('2023-06-16T00:01:00'), total: 9999 });

    const h = await home({ viewer: await viewer(owner), now });
    expect(h.day).toBe('Thu 15 Jun');
    expect(h.sales.today).toMatchObject({ amount: 10000, bills: 4, sarees: 5, cancelled: 2 });
    expect(h.sales.today.byChannel).toEqual({ store: { amount: 3000, bills: 2 }, whatsapp: { amount: 3000, bills: 1 }, online: { amount: 4000, bills: 1 } });
    expect(h.sales.yesterday).toEqual({ amount: 800, bills: 1 });
    expect(h.sales.month).toEqual({ name: 'June', amount: 11400, bills: 7 });
    expect(h.recent.map((s) => s.total)).toEqual([2000, 4000, 3000]);
    expect(h.recent[1]).toMatchObject({ id: online.id, channel: 'online', paymentMethod: 'online', customer: 'Kavya Sri', soldBy: null });
    // One rule: the day's list and the database sum agree.
    const from = new Date(Date.parse('2023-06-14T18:30:00Z'));
    expect((await sumRange(from, new Date(from.getTime() + DAY))).amount).toBe(h.sales.today.amount);
    const t = await today({ viewer: await viewer(owner), now });
    expect(t.totals).toMatchObject({ amount: 10000, count: 4 });
    expect(t.totals.byPayment.online).toBe(4000);
    expect(t.sales.find((s) => s.id === online.id)).toMatchObject({ customer: 'Kavya Sri', invoiceRequired: true });
    expect(t.sales.map((s) => s.id)).not.toContain(neverPaid.id);
    expect(t.sales.filter((s) => s.cancelled)).toHaveLength(2);
    // Staff: their own sales only, so none of these (no seller recorded).
    const st = await home({ viewer: await viewer(staff), now });
    expect(st.sales.mine).toEqual({ bills: 0, sarees: 0 });
    expect(st.recent).toEqual([]);
    expect((await today({ viewer: await viewer(staff), now })).sales).toEqual([]);
  });

  it('A sale made now moves Home at once; Staff see their own sarees and bills', async () => {
    const sub = await newSub({ storePrice: 4200 });
    const before = (await O('get', H)).body;
    const beforeStaff = (await S('get', H)).body;
    const sale = await sell(staff, await saree(sub));
    const after = (await O('get', H)).body;
    expect(Math.round((after.sales.today.amount - before.sales.today.amount) * 100)).toBe(420000);
    expect(after.sales.today.bills - before.sales.today.bills).toBe(1);
    expect(after.sales.today.byChannel.store.bills - before.sales.today.byChannel.store.bills).toBe(1);
    expect(Math.round((after.sales.month.amount - before.sales.month.amount) * 100)).toBe(420000);
    expect(after.recent[0]).toMatchObject({ id: sale.id, total: 4200, soldBy: { id: staff.account.id } });
    const st = (await S('get', H)).body;
    expect(st.sales.mine.bills - beforeStaff.sales.mine.bills).toBe(1);
    expect(st.sales.mine.sarees - beforeStaff.sales.mine.sarees).toBe(1);
    expect(st.recent[0].id).toBe(sale.id);
    const own = new Set((await S('get', `${SA}/today`)).body.sales.map((s) => s.id));
    expect(st.recent.every((s) => own.has(s.id))).toBe(true);
    // Another staff member doesn't see it.
    expect((await as(staff2)('get', H)).body.recent.map((s) => s.id)).not.toContain(sale.id);
    // Owners' Today's sales total matches Home.
    const t = (await O('get', `${SA}/today`)).body;
    expect(t.totals.amount).toBe(after.sales.today.amount);
  });
});

describe('Needs attention (6.4, section 8)', () => {
  it('Orders to ship with the oldest wait; parcels shipped over 10 days ago', async () => {
    const sub = await newSub();
    product = await saree(sub);
    const before = (await O('get', H)).body.attention;
    await order({ at: new Date(Date.now() - 3 * DAY - HOUR), total: 3000, channel: 'whatsapp', status: 'processing', extra: { shipment: { create: {} } } });
    const old = await order({ at: new Date(Date.now() - 13 * DAY), total: 3000, channel: 'whatsapp', status: 'shipped', extra: { shipment: { create: { status: 'shipped', carrier: 'DTDC', awbNumber: `T${uid()}${uid()}`, shippedAt: new Date(Date.now() - 12 * DAY) } } } });
    await order({ at: new Date(Date.now() - 4 * DAY), total: 3000, channel: 'whatsapp', status: 'shipped', extra: { shipment: { create: { status: 'shipped', carrier: 'DTDC', awbNumber: `T${uid()}${uid()}`, shippedAt: new Date(Date.now() - 3 * DAY) } } } });
    const a = (await O('get', H)).body.attention;
    expect(a.toShip.count - (before.toShip?.count ?? 0)).toBe(1);
    expect(a.toShip.oldestDays).toBeGreaterThanOrEqual(3);
    expect(a.toCheck.count - (before.toCheck?.count ?? 0)).toBe(1);
    if (!before.toCheck) expect(a.toCheck.oldestId).toBe(old.id);
    expect(a.toCheck.oldestShipped).toMatch(/^\d{1,2} [A-Z][a-z]{2,3}$/);
    expect((await S('get', H)).body.attention.toShip.count).toBe(a.toShip.count);
  });

  it('Unpaid checkouts from the last 7 days, by customer, owners only', async () => {
    const sub = await newSub();
    product = await saree(sub);
    const before = (await O('get', H)).body.attention.unpaid ?? { customers: 0, tries: 0 };
    const customer = await prisma.authAccount.create({ data: { phone: `92${String(Date.now()).slice(-8)}` } });
    for (const ago of [HOUR, 2 * HOUR]) await order({ at: new Date(Date.now() - ago), total: 2800, channel: 'online', status: 'pending_payment', extra: { authAccountId: customer.id } });
    await order({ at: new Date(Date.now() - 5 * 60000), total: 2800, channel: 'online', status: 'pending_payment' });
    await order({ at: new Date(Date.now() - 8 * DAY), total: 2800, channel: 'online', status: 'pending_payment' });
    const a = (await O('get', H)).body.attention.unpaid;
    expect(a.customers - before.customers).toBe(1);
    expect(a.tries - before.tries).toBe(2);
  });

  it('An invoice not made: owners see every one, staff only their own', async () => {
    const sub = await newSub();
    const sale = await sell(staff, await saree(sub));
    await prisma.invoice.delete({ where: { orderId: sale.id } });
    const noInvoiceWanted = await sell(staff, await saree(sub), { invoice: false });
    const ids = (body) => body.attention.invoiceMissing.map((x) => x.id);
    const ow = (await O('get', H)).body;
    expect(ids(ow)).toContain(sale.id);
    expect(ids(ow)).not.toContain(noInvoiceWanted.id);
    expect(ow.attention.invoiceMissing.find((x) => x.id === sale.id)).toMatchObject({ orderNumber: sale.orderNumber, today: true });
    const st = (await S('get', H)).body;
    expect(ids(st)).toEqual([sale.id]);
    expect(st.attention.invoiceMissingCount).toBe(1);
    expect(ids((await as(staff2)('get', H)).body)).toEqual([]);
    // Made later: gone.
    expect((await S('post', `${SA}/${sale.id}/invoice`)).status).toBe(200);
    expect(ids((await S('get', H)).body)).toEqual([]);
  });

  it('Sarees without a photo match the Products "No photo" filter', async () => {
    const sub = await newSub();
    const before = (await O('get', H)).body.attention.noPhoto;
    await saree(sub, { photo: false });
    const after = (await O('get', H)).body.attention.noPhoto;
    expect(after - before).toBe(1);
    const filter = await O('get', '/api/v2/products?filter=nophoto');
    expect(filter.body.counts.nophoto).toBe(after);
  });
});

describe('Running low (6.5)', () => {
  it('Sold out in the last 30 days and 1–3 left; never-stocked, plenty and old sell-outs left out', async () => {
    const low = await newSub();
    await saree(low); await saree(low);
    await saree(low, { status: 'sold_offline' });
    const out = await newSub();
    await saree(out, { status: 'sold_offline', soldAt: new Date(Date.now() - 2 * DAY) });
    const oldOut = await newSub();
    await saree(oldOut, { status: 'sold_offline', soldAt: new Date(Date.now() - 40 * DAY) });
    const plenty = await newSub();
    for (let i = 0; i < 4; i += 1) await saree(plenty);
    const empty = await newSub();
    const gone = await newSub();
    await saree(gone);
    await prisma.subcategory.update({ where: { id: gone.id }, data: { status: 'inactive' } });

    const r = await O('get', `${H}/stock`);
    expect(r.status).toBe(200);
    const lowRow = r.body.low.find((x) => x.id === low.id);
    expect(lowRow).toMatchObject({ name: low.name, category: low.category.name, left: 2, soldRecent: 1 });
    const outRow = r.body.soldOut.find((x) => x.id === out.id);
    expect(outRow).toMatchObject({ left: 0, soldRecent: 1 });
    expect(outRow.lastSold).toMatch(/^\d{1,2} [A-Z][a-z]{2,3}$/);
    const all = [...r.body.low, ...r.body.soldOut].map((x) => x.id);
    for (const s of [oldOut, plenty, empty, gone]) expect(all).not.toContain(s.id);
    const a = (await O('get', H)).body.attention.stock;
    expect(a).toEqual({ soldOut: r.body.soldOut.length, low: r.body.low.length });
    expect((await runningLow()).low.map((x) => x.id)).toContain(low.id);
  });
});
