// Module 5 (Scan to sell): the rules in plan sections 5, 6, 8 and 13.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { api, prisma, signedIn, authed, allPages } from '../support/helpers.js';
import { storage, useStorage } from '../../src/services/storage/index.js';
import { splitGst } from '../../src/utils/gst.js';

const C = '/api/v2/catalog';
const SA = '/api/v2/sales';
const uid = () => crypto.randomUUID().slice(0, 8);
// Tag numbers far above the shop's real ones (they stop near 12,000).
let seq = Math.floor(Math.random() * 400000) + 9600000;
const newTag = () => `NH${seq++}`;
let owner;
let owner2;
let staff;
let staff2;
let sub;
beforeAll(async () => {
  owner = await signedIn({ role: 'ADMIN', name: 'Sell' });
  owner2 = await signedIn({ role: 'ADMIN', name: 'Second' });
  staff = await signedIn({ role: 'STAFF', name: 'Lakshmi' });
  staff2 = await signedIn({ role: 'STAFF', name: 'Ravi' });
  sub = await newSub();
});
const real = storage();
afterEach(() => useStorage(real));
const as = (who) => (method, url) => authed(method, url, who.session, who.device);
const O = (m, u) => as(owner)(m, u);
const S = (m, u) => as(staff)(m, u);

async function newSub({ storePrice = 3600 } = {}) {
  const c = await O('post', `${C}/categories`).send({ name: `Cat ${uid()}`, description: 'Test category' });
  expect(c.status, JSON.stringify(c.body)).toBe(201);
  const s = await O('post', `${C}/categories/${c.body.category.id}/subcategories`).send({ name: `Sub ${uid()}`, description: 'Test', storePrice, websitePrice: 2800, mrp: 16999 });
  expect(s.status, JSON.stringify(s.body)).toBe(201);
  return { ...s.body.subcategory, category: c.body.category };
}
// A saree with one tag, straight into the database (Module 4 tests the adding).
async function saree({ s = sub, tag = newTag(), status = 'in_stock', channel = 'both', isActive = true, deleted = false } = {}) {
  const id = uid() + uid();
  const p = await prisma.product.create({
    data: { slug: `test-${id}`, sku: `T-${id}`, name: s.name, categoryId: s.category.id, subcategoryId: s.id, channelVisibility: channel, trackingMode: 'serialized', isActive, deletedAt: deleted ? new Date() : null },
  });
  await prisma.productImage.create({ data: { productId: p.id, url: `http://test.local/${id}.jpg`, sortOrder: 0 } });
  const pc = await prisma.piece.create({ data: { productId: p.id, barcode: tag, status, soldAt: status.startsWith('sold') ? new Date() : null } });
  return { productId: p.id, pieceId: pc.id, tag, storePrice: Number(s.storePrice) };
}
// An online checkout holding these sarees (15 minutes from now, or already over).
async function checkout(sarees, { minutes = 15 } = {}) {
  const order = await prisma.order.create({ data: { orderNumber: `T${uid()}`, subtotal: 2800, total: 2800, shippingAddress: {}, status: 'pending_payment' } });
  for (const x of sarees) {
    await prisma.reservation.create({ data: { productId: x.productId, pieceId: x.pieceId, orderId: order.id, expiresAt: new Date(Date.now() + minutes * 60000), status: 'active' } });
    await prisma.piece.update({ where: { id: x.pieceId }, data: { status: 'reserved' } });
  }
  return order;
}
const line = (x, price = x.storePrice) => ({ pieceId: x.pieceId, price, storePrice: x.storePrice });
const bill = (sarees, extra = {}) => ({ clientRef: `bill-${uid()}${uid()}`, lines: sarees.map((x) => line(x)), channel: 'store', paymentMethod: 'cash', invoice: true, ...extra });
const sell = (who, body) => as(who)('post', SA).send(body);
const pieceStatus = async (x) => (await prisma.piece.findUnique({ where: { id: x.pieceId } })).status;
const localFile = (url) => path.join(real.root, url.split('/uploads/')[1]);

describe('who can sell (Module 2)', () => {
  it('Owners and Staff sell; signed-out people can\'t; only Owners cancel or sell anyway', async () => {
    const a = await saree();
    expect((await S('post', `${SA}/lookup`).send({ code: a.tag })).status).toBe(200);
    expect((await api().post(`${SA}/lookup`).send({ code: a.tag })).status).toBe(401);
    expect((await api().post(SA).send(bill([a]))).status).toBe(401);
    const r = await sell(staff, bill([a]));
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    const cancel = await S('post', `${SA}/${r.body.sale.id}/cancel`).send({ reason: 'Wrong saree' });
    expect(cancel.status).toBe(403);
    expect(r.body.actions.cancel).toBe(false);
    expect(r.body.actions.cancelBlocked).toBe('OWNERS_ONLY');
    const b = await saree();
    const held = bill([b]);
    held.lines[0].sellHeld = true;
    expect((await sell(staff, held)).status).toBe(403);
  });
});

describe('scan: can it be sold? (5.1)', () => {
  it('in stock: its store price, by the whole tag or the number on it', async () => {
    const a = await saree();
    const r = await S('post', `${SA}/lookup`).send({ code: a.tag.toLowerCase() });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ sellable: true, problem: null, saree: { pieceId: a.pieceId, code: a.tag, storePrice: 3600, websitePrice: 2800, name: sub.name } });
    const byNumber = await S('post', `${SA}/lookup`).send({ code: a.tag.slice(2) });
    expect(byNumber.body.saree.pieceId).toBe(a.pieceId);
  });

  it('says exactly why not: sold, damaged, online only, switched off, retired, deleted, unknown', async () => {
    const cases = [
      [{ status: 'sold_offline' }, 'ALREADY_SOLD', /already sold \(at the counter/],
      [{ status: 'sold_online' }, 'ALREADY_SOLD', /already sold \(online/],
      [{ status: 'damaged' }, 'DAMAGED', /damaged/],
      [{ channel: 'online_only' }, 'ONLINE_ONLY', /Online only/],
      [{ isActive: false }, 'SWITCHED_OFF', /switched off/],
      [{ status: 'retired' }, 'TAG_RETIRED', /replaced/],
      [{ deleted: true }, 'DELETED', /deleted/],
    ];
    for (const [opts, code, text] of cases) {
      const x = await saree(opts);
      const r = await S('post', `${SA}/lookup`).send({ code: x.tag });
      expect(r.status, code).toBe(200);
      expect(r.body.sellable, code).toBe(false);
      expect(r.body.problem.code).toBe(code);
      expect(r.body.problem.message).toMatch(text);
    }
    const unknown = await S('post', `${SA}/lookup`).send({ code: 'NH99999999' });
    expect(unknown.status).toBe(404);
    expect(unknown.body.error.code).toBe('TAG_UNKNOWN');
    const bad = await S('post', `${SA}/lookup`).send({ code: 'N~' });
    expect(bad.body.error.code).toBe('TAG_INVALID');
  });

  it('held by an online checkout: owners may sell anyway, staff are told to ask an owner', async () => {
    const a = await saree();
    await checkout([a]);
    const st = await S('post', `${SA}/lookup`).send({ code: a.tag });
    expect(st.body.problem).toMatchObject({ code: 'HELD_ONLINE', canSellAnyway: false });
    expect(st.body.problem.message).toMatch(/Ask an owner, or wait until/);
    const ow = await O('post', `${SA}/lookup`).send({ code: a.tag });
    expect(ow.body.problem).toMatchObject({ code: 'HELD_ONLINE', canSellAnyway: true });
    expect(ow.body.problem.heldUntil).toBeTruthy();
  });
});

describe('completing a sale (5.3, 8)', () => {
  it('one bill = one order: sarees sold, stock entries, invoice with the GST split to the paisa', async () => {
    const xs = [await saree(), await saree(), await saree()];
    const body = bill(xs, { paymentMethod: 'upi', customer: { name: 'Sita Devi', mobile: '+91 98480 22338' } });
    body.lines[1].price = 1999.99; // a bargain
    const r = await sell(staff, body);
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    const { sale } = r.body;
    expect(sale).toMatchObject({ channel: 'store', paymentMethod: 'upi', total: 3600 + 1999.99 + 3600, status: 'done', soldBy: { id: staff.account.id, name: 'Lakshmi Person' } });
    expect(sale.orderNumber).toMatch(/^NH\d{8}$/);
    expect(sale.lines.map((l) => l.code)).toEqual(xs.map((x) => x.tag));
    expect(sale.lines[1]).toMatchObject({ price: 1999.99, storePrice: 3600 });
    expect(sale.savings).toBe(1600.01);
    expect(sale.customer).toMatchObject({ name: 'Sita Devi', mobile: '9848022338' });
    for (const x of xs) expect(await pieceStatus(x)).toBe('sold_offline');

    const order = await prisma.order.findUnique({ where: { id: sale.id }, include: { items: true, invoice: true } });
    expect(order).toMatchObject({ status: 'delivered', channel: 'store', invoiceRequired: true, clientRef: body.clientRef, paymentMethod: 'upi' });
    expect(order.items).toHaveLength(3);
    expect(order.items.every((i) => i.pieceId && i.quantity === 1 && i.nameSnapshot === sub.name)).toBe(true);
    const ledger = await prisma.stockLedger.findMany({ where: { ref: sale.orderNumber, reason: 'offline_sale' } });
    expect(ledger).toHaveLength(3);
    expect(ledger.every((l) => l.actorId === staff.account.id && l.delta === -1 && l.channel === 'store')).toBe(true);

    // GST: per line, then added up; taxable + CGST + SGST = the total paid.
    const inv = order.invoice;
    expect(inv.invoiceNumber).toMatch(/^INV-\d{6}$/);
    const expected = [3600, 1999.99, 3600].map((a) => splitGst(a, 5));
    expect(Number(inv.taxableValue)).toBeCloseTo(expected.reduce((t, s) => t + s.taxableValue, 0), 2);
    expect(Math.round((Number(inv.taxableValue) + Number(inv.cgstAmount) + Number(inv.sgstAmount)) * 100)).toBe(Math.round(Number(inv.totalAmount) * 100));
    expect(Number(inv.totalAmount)).toBe(9199.99);
    expect(inv).toMatchObject({ channel: 'store', customerName: 'Sita Devi', customerMobile: '9848022338', generatedBy: staff.account.id, cancelledAt: null });
    expect(sale.invoice).toMatchObject({ required: true, ready: true, number: inv.invoiceNumber, fileName: `Nandam-Invoice-${inv.invoiceNumber}.pdf` });
    expect(fs.readFileSync(localFile(inv.url)).subarray(0, 4).toString()).toBe('%PDF');

    // The bargain is in the activity log, under the old app's event name.
    const ev = await prisma.authEvent.findFirst({ where: { eventType: 'offline_sale_price_override', metadata: { path: ['orderId'], equals: sale.id } } });
    expect(ev.metadata).toMatchObject({ categoryStorePrice: 3600, salePrice: 1999.99, pieceId: xs[1].pieceId });
  });

  it('invoice numbers follow on; "no invoice" records the sale without one', async () => {
    const a = await sell(owner, bill([await saree()]));
    const b = await sell(owner, bill([await saree()]));
    const n = (r) => Number(r.body.sale.invoice.number.slice(4));
    expect(n(b)).toBe(n(a) + 1);
    const none = await sell(owner, bill([await saree()], { invoice: false, paymentMethod: 'card' }));
    expect(none.status).toBe(201);
    expect(none.body.sale.invoice).toEqual({ required: false });
    expect(await prisma.invoice.findUnique({ where: { orderId: none.body.sale.id } })).toBeNull();
    const again = await O('post', `${SA}/${none.body.sale.id}/invoice`);
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe('NO_INVOICE');
    const c = await sell(owner, bill([await saree()]));
    expect(n(c)).toBe(n(b) + 1); // a sale without an invoice uses no number
  });

  it('a counter customer is optional (6.5): nothing is saved when none is given', async () => {
    const r = await sell(staff, bill([await saree()]));
    expect(r.body.sale.customer).toBeNull();
    const order = await prisma.order.findUnique({ where: { id: r.body.sale.id }, include: { invoice: true } });
    expect(order.shippingAddress).toEqual({});
    expect(order.invoice.customerName).toBeNull();
  });

  it('a WhatsApp order needs name, mobile and address (6.6), goes to To ship and names the customer', async () => {
    const a = await saree();
    const missing = await sell(staff, bill([a], { channel: 'whatsapp', customer: { mobile: '9848022338' } }));
    expect(missing.status).toBe(400);
    expect(missing.body.error.details.issues.map((i) => i.field)).toEqual(expect.arrayContaining(['customer.name', 'customer.address']));
    const badMobile = await sell(staff, bill([a], { customer: { mobile: '12345' } }));
    expect(badMobile.body.error.details.issues[0].field).toBe('customer.mobile');
    const r = await sell(staff, bill([a], { channel: 'whatsapp', customer: { name: 'Anitha', mobile: '9848022338', address: '12-4 Main Road, Guntur 522001' } }));
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    const order = await prisma.order.findUnique({ where: { id: r.body.sale.id }, include: { shipment: true, invoice: true } });
    expect(order).toMatchObject({ channel: 'whatsapp', status: 'processing' });
    expect(order.shipment.status).toBe('not_shipped');
    expect(order.shippingAddress).toMatchObject({ fullName: 'Anitha', phone: '9848022338', line1: '12-4 Main Road, Guntur 522001' });
    expect(order.invoice).toMatchObject({ channel: 'whatsapp', customerName: 'Anitha' });
    expect(r.body.sale.shipping).toEqual({ status: 'not_shipped', awbNumber: null });
    const ledger = await prisma.stockLedger.findFirst({ where: { ref: order.orderNumber, reason: 'offline_sale' } });
    expect(ledger.channel).toBe('whatsapp');
  });

  it('checks every bill on the server: payment, invoice choice, prices, duplicates, 100 sarees', async () => {
    const a = await saree();
    const fields = async (body) => (await sell(staff, body)).body.error?.details?.issues?.map((i) => i.field);
    const noPay = bill([a]);
    delete noPay.paymentMethod;
    expect(await fields(noPay)).toContain('paymentMethod');
    const noInvoice = bill([a]);
    delete noInvoice.invoice;
    expect(await fields(noInvoice)).toContain('invoice');
    expect(await fields(bill([a], { lines: [line(a, 0)] }))).toContain('lines.0.price');
    expect(await fields(bill([a], { lines: [line(a, 10.005)] }))).toContain('lines.0.price');
    expect(await fields(bill([a], { lines: [line(a, 1000001)] }))).toContain('lines.0.price');
    expect(await fields(bill([a], { lines: [line(a), line(a)] }))).toContain('lines');
    expect(await fields(bill([a], { lines: [] }))).toContain('lines');
    const many = Array.from({ length: 101 }, () => ({ pieceId: crypto.randomUUID(), price: 100, storePrice: 100 }));
    const tooMany = await sell(staff, bill([a], { lines: many }));
    expect(tooMany.body.error.message).toMatch(/up to 100 sarees/);
    expect(await pieceStatus(a)).toBe('in_stock');
  });
});

describe('never sold twice (5.3, 14)', () => {
  it('all or nothing: one saree gone and the whole bill waits, naming that saree', async () => {
    const xs = [await saree(), await saree(), await saree()];
    await prisma.piece.update({ where: { id: xs[2].pieceId }, data: { status: 'sold_offline', soldAt: new Date() } });
    const r = await sell(staff, bill(xs));
    expect(r.status).toBe(409);
    expect(r.body.error).toMatchObject({ code: 'LINE_CHANGED', details: { line: 2, pieceId: xs[2].pieceId, code: xs[2].tag, reason: 'ALREADY_SOLD' } });
    expect(r.body.error.message).toBe(`${xs[2].tag} was just sold on another phone. Remove it to continue.`);
    expect(await pieceStatus(xs[0])).toBe('in_stock');
    expect(await pieceStatus(xs[1])).toBe('in_stock');
    expect(await prisma.stockLedger.count({ where: { pieceId: xs[0].pieceId, reason: 'offline_sale' } })).toBe(0);
  });

  it('damaged, online only and changed prices are caught at the moment of sale too', async () => {
    const d = await saree();
    await prisma.piece.update({ where: { id: d.pieceId }, data: { status: 'damaged' } });
    expect((await sell(staff, bill([d]))).body.error.details.reason).toBe('DAMAGED');
    const o = await saree();
    await prisma.product.update({ where: { id: o.productId }, data: { channelVisibility: 'online_only' } });
    expect((await sell(staff, bill([o]))).body.error.details.reason).toBe('ONLINE_ONLY');
    const s2 = await newSub({ storePrice: 5000 });
    const p = await saree({ s: s2 });
    await prisma.subcategory.update({ where: { id: s2.id }, data: { storePrice: 5400 } });
    const changed = await sell(staff, bill([p]));
    expect(changed.body.error.details).toMatchObject({ reason: 'PRICE_CHANGED', storePrice: 5400 });
    expect(changed.body.error.message).toMatch(/changed to ₹5,400/);
    const gone = await sell(staff, bill([{ pieceId: crypto.randomUUID(), storePrice: 100 }]));
    expect(gone.body.error.details.reason).toBe('GONE');
  });

  it('the same bill sent twice, even at the same moment, makes one sale', async () => {
    const xs = [await saree(), await saree()];
    const body = bill(xs);
    const [a, b] = await Promise.all([sell(staff, body), sell(staff, body)]);
    expect([a.status, b.status].sort()).toEqual([200, 201]);
    expect(a.body.sale.id).toBe(b.body.sale.id);
    const c = await sell(staff, body);
    expect(c.status).toBe(200);
    expect(c.body.repeated).toBe(true);
    expect(await prisma.order.count({ where: { clientRef: body.clientRef } })).toBe(1);
    expect(await prisma.invoice.count({ where: { orderId: a.body.sale.id } })).toBe(1);
  });

  it('two phones selling the same saree at once: one wins, the other is told', async () => {
    const x = await saree();
    const [a, b] = await Promise.all([sell(staff, bill([x])), sell(staff2, bill([x]))]);
    expect([a.status, b.status].sort()).toEqual([201, 409]);
    const lost = a.status === 409 ? a : b;
    expect(lost.body.error.code).toBe('LINE_CHANGED');
    expect(await prisma.orderItem.count({ where: { pieceId: x.pieceId } })).toBe(1);
  });
});

describe('a saree held by an online checkout (5.7, 6.8)', () => {
  it('Staff are refused; an owner must choose Sell anyway', async () => {
    const x = await saree();
    await checkout([x]);
    const st = await sell(staff, bill([x]));
    expect(st.status).toBe(409);
    expect(st.body.error).toMatchObject({ code: 'HELD_ONLINE', details: { line: 0, canSellAnyway: false } });
    const ow = await sell(owner, bill([x]));
    expect(ow.body.error).toMatchObject({ code: 'HELD_ONLINE', details: { canSellAnyway: true } });
    expect(await pieceStatus(x)).toBe('reserved');
  });

  it('Sell anyway: sold, and that online checkout is cancelled with all its sarees back in stock', async () => {
    const x = await saree();
    const other = await saree();
    const co = await checkout([x, other]);
    const body = bill([x]);
    body.lines[0].sellHeld = true;
    const r = await sell(owner, body);
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    expect(await pieceStatus(x)).toBe('sold_offline');
    expect(await pieceStatus(other)).toBe('in_stock');
    const online = await prisma.order.findUnique({ where: { id: co.id }, include: { reservations: true } });
    expect(online.status).toBe('cancelled');
    expect(online.cancelReason).toBe(`Sold at the counter (order ${r.body.sale.orderNumber})`);
    expect(online.cancelledById).toBe(owner.account.id);
    expect(online.reservations.every((v) => v.status === 'released')).toBe(true);
    const ev = await prisma.authEvent.findFirst({ where: { eventType: 'offline_sale_held_override', metadata: { path: ['orderId'], equals: r.body.sale.id } } });
    expect(ev.metadata.cancelledCheckouts[0].orderNumber).toBe(co.orderNumber);
  });

  it('Sell anyway covers only the saree the owner chose, never another held one on the bill', async () => {
    const a = await saree();
    const b = await saree();
    await checkout([a]);
    await checkout([b]);
    const body = bill([a, b]);
    body.lines[0].sellHeld = true;
    const r = await sell(owner, body);
    expect(r.status).toBe(409);
    expect(r.body.error).toMatchObject({ code: 'HELD_ONLINE', details: { line: 1, pieceId: b.pieceId } });
    expect(await pieceStatus(a)).toBe('reserved'); // nothing changed: all or nothing
  });

  it('a hold whose 15 minutes are over doesn\'t block the sale', async () => {
    const x = await saree();
    const co = await checkout([x], { minutes: -1 });
    const look = await S('post', `${SA}/lookup`).send({ code: x.tag });
    expect(look.body.sellable).toBe(true);
    const r = await sell(staff, bill([x]));
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    expect((await prisma.reservation.findFirst({ where: { orderId: co.id } })).status).toBe('expired');
  });
});

describe('the invoice (5.4)', () => {
  it('a failed PDF never loses the sale; "Make the invoice again" makes exactly one', async () => {
    useStorage({ ...real, upload: async () => { throw new Error('storage down'); } });
    const r = await sell(staff, bill([await saree()]));
    expect(r.status).toBe(201);
    expect(r.body.invoiceFailed).toBe(true);
    expect(r.body.sale.invoice).toEqual({ required: true, ready: false });
    expect(r.body.actions.makeInvoice).toBe(true);
    const fail = await S('post', `${SA}/${r.body.sale.id}/invoice`);
    expect(fail.status).toBe(503);
    expect(fail.body.error.code).toBe('INVOICE_FAILED');
    useStorage(real);
    const [a, b] = await Promise.all([S('post', `${SA}/${r.body.sale.id}/invoice`), S('post', `${SA}/${r.body.sale.id}/invoice`)]);
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    expect(a.body.sale.invoice.number).toBe(b.body.sale.invoice.number);
    expect(await prisma.invoice.count({ where: { orderId: r.body.sale.id } })).toBe(1);
    expect(a.body.actions.makeInvoice).toBe(false);
  });
});

describe('typing a short tag number (found in the Module 8 phone test)', () => {
  it('"10" finds the old tag NH10; one or two letters alone are still refused', async () => {
    // A one- or two-digit number that only one saree's tag carries (the copied shop data has NH1–NH99).
    const rows = await prisma.$queryRaw`SELECT substring(barcode from '[0-9]+$') AS n, count(*)::int AS c, min(barcode) AS code, min(status) AS status FROM "Piece" WHERE barcode ~ '^[A-Z]+[0-9]{1,2}$' GROUP BY 1`;
    let pick = rows.find((r) => r.c === 1 && r.status === 'in_stock');
    if (!pick) { const x = await saree({ tag: 'QQ7' }); pick = { n: '7', code: 'QQ7', id: x.pieceId }; }
    const r = await S('post', `${SA}/lookup`).send({ code: pick.n });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body.saree.code).toBe(pick.code);
    expect((await S('post', `${SA}/lookup`).send({ code: 'A' })).status).toBe(400);
  });
});

describe('today\'s sales (5.6, 6.13)', () => {
  it('Owners see everyone\'s with the day\'s totals; Staff only their own, no totals', async () => {
    const mine = await sell(staff, bill([await saree()], { paymentMethod: 'card' }));
    const theirs = await sell(staff2, bill([await saree()]));
    const own = await sell(owner2, bill([await saree()], { paymentMethod: 'upi' }));
    const ow = await O('get', `${SA}/today`);
    expect(ow.status).toBe(200);
    expect(ow.body.scope).toBe('everyone');
    const { items: allToday, pages } = await allPages(O, `${SA}/today`, 'sales');
    expect(pages.every((p) => p.sales.length <= 20)).toBe(true);
    const ids = allToday.map((s) => s.id);
    expect(ids).toEqual(expect.arrayContaining([mine.body.sale.id, theirs.body.sale.id, own.body.sale.id]));
    // The day's totals cover every page.
    expect(Math.round(ow.body.totals.amount * 100)).toBe(allToday.filter((s) => !s.cancelled).reduce((t, s) => t + Math.round(s.total * 100), 0));
    expect(ow.body.totals.byPayment.card).toBeGreaterThanOrEqual(3600);
    const row = allToday.find((s) => s.id === theirs.body.sale.id);
    expect(row).toMatchObject({ sarees: 1, total: 3600, paymentMethod: 'cash', soldBy: { name: 'Ravi Person' }, cancelled: false, invoiceRequired: true });
    const st = await S('get', `${SA}/today`);
    expect(st.body.scope).toBe('mine');
    expect(st.body.totals).toBeNull();
    expect(st.body.sales.every((s) => s.soldBy.id === staff.account.id)).toBe(true);
    expect(st.body.sales.map((s) => s.id)).toContain(mine.body.sale.id);
    // Staff open their own sales only.
    expect((await S('get', `${SA}/${mine.body.sale.id}`)).status).toBe(200);
    const other = await S('get', `${SA}/${theirs.body.sale.id}`);
    expect(other.status).toBe(403);
    expect(other.body.error.code).toBe('NOT_YOURS');
    expect((await O('get', `${SA}/${theirs.body.sale.id}`)).status).toBe(200);
    expect((await O('get', `${SA}/${crypto.randomUUID()}`)).status).toBe(404);
  });
});

describe('cancel a sale (5.6, 6.2)', () => {
  it('Owners, same day: sarees back in stock, order cancelled, invoice kept and stamped CANCELLED', async () => {
    const xs = [await saree(), await saree()];
    const r = await sell(staff, bill(xs));
    const inv = await prisma.invoice.findUnique({ where: { orderId: r.body.sale.id } });
    const noReason = await O('post', `${SA}/${r.body.sale.id}/cancel`).send({ reason: '' });
    expect(noReason.status).toBe(400);
    const c = await O('post', `${SA}/${r.body.sale.id}/cancel`).send({ reason: 'Customer changed mind' });
    expect(c.status, JSON.stringify(c.body)).toBe(200);
    expect(c.body.sale).toMatchObject({ status: 'cancelled', cancelled: { by: { id: owner.account.id }, reason: 'Customer changed mind' } });
    expect(c.body.backInStock.sort()).toEqual(xs.map((x) => x.tag).sort());
    for (const x of xs) expect(await pieceStatus(x)).toBe('in_stock');
    const after = await prisma.invoice.findUnique({ where: { orderId: r.body.sale.id } });
    expect(after.invoiceNumber).toBe(inv.invoiceNumber);
    expect(after.cancelledAt).toBeTruthy();
    expect(after.storageKey.startsWith('invoices/cancelled/')).toBe(true);
    expect(fs.existsSync(localFile(inv.url))).toBe(true); // the first PDF is kept
    expect(c.body.sale.invoice).toMatchObject({ cancelled: true, stamped: true });
    const ledger = await prisma.stockLedger.findMany({ where: { ref: r.body.sale.orderNumber, reason: 'sale_cancelled' } });
    expect(ledger).toHaveLength(2);
    expect(await prisma.authEvent.count({ where: { eventType: 'sale_cancelled', metadata: { path: ['orderId'], equals: r.body.sale.id } } })).toBe(1);
    // Twice is refused; the sarees can be sold again.
    const twice = await O('post', `${SA}/${r.body.sale.id}/cancel`).send({ reason: 'Again' });
    expect(twice.body.error.code).toBe('ALREADY_CANCELLED');
    expect((await sell(staff, bill(xs))).status).toBe(201);
    // Cancelled sales drop out of the day's totals.
    const today = await O('get', `${SA}/today`);
    expect(today.body.sales.find((s) => s.id === r.body.sale.id).cancelled).toBe(true);
  });

  it('not on another day, and not a WhatsApp order already shipped', async () => {
    const old = await sell(owner, bill([await saree()]));
    await prisma.order.update({ where: { id: old.body.sale.id }, data: { placedAt: new Date(Date.now() - 26 * 3600000) } });
    const r = await O('post', `${SA}/${old.body.sale.id}/cancel`).send({ reason: 'Wrong saree' });
    expect(r.status).toBe(409);
    expect(r.body.error.code).toBe('NOT_TODAY');
    expect((await O('get', `${SA}/${old.body.sale.id}`)).body.actions).toMatchObject({ cancel: false, cancelBlocked: 'NOT_TODAY' });
    const wa = await sell(owner, bill([await saree()], { channel: 'whatsapp', customer: { name: 'Anitha', mobile: '9848022338', address: '12-4 Main Road, Guntur 522001' } }));
    await prisma.shipment.update({ where: { orderId: wa.body.sale.id }, data: { status: 'shipped', awbNumber: 'D123' } });
    const shipped = await O('post', `${SA}/${wa.body.sale.id}/cancel`).send({ reason: 'Wrong saree' });
    expect(shipped.body.error.code).toBe('SHIPPED');
  });

  it('a cancelled sale whose invoice had failed gets no invoice', async () => {
    useStorage({ ...real, upload: async () => { throw new Error('storage down'); } });
    const r = await sell(owner, bill([await saree()]));
    useStorage(real);
    await O('post', `${SA}/${r.body.sale.id}/cancel`).send({ reason: 'Customer changed mind' });
    const again = await O('post', `${SA}/${r.body.sale.id}/invoice`);
    expect(again.body.error.code).toBe('ALREADY_CANCELLED');
  });
});
