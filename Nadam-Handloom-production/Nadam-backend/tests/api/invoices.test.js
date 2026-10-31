// Module 6 (Invoices and the sales summary): the rules in plan sections 5, 6, 8 and 13.
// Test invoices are moved to dates in 2025, where the copied shop data has none.
import crypto from 'node:crypto';
import { describe, it, expect, beforeAll } from 'vitest';
import { api, prisma, signedIn, authed } from '../support/helpers.js';

const C = '/api/v2/catalog';
const SA = '/api/v2/sales';
const IN = '/api/v2/invoices';
const uid = () => crypto.randomUUID().slice(0, 8);
let seq = Math.floor(Math.random() * 300000) + 9300000;
const newTag = () => `NH${seq++}`;
let owner;
let staff;
let staff2;
let sub;
beforeAll(async () => {
  owner = await signedIn({ role: 'ADMIN', name: 'Book' });
  staff = await signedIn({ role: 'STAFF', name: 'Lakshmi' });
  staff2 = await signedIn({ role: 'STAFF', name: 'Ravi' });
  const c = await authed('post', `${C}/categories`, owner.session, owner.device).send({ name: `Cat ${uid()}`, description: 'Test category' });
  const s = await authed('post', `${C}/categories/${c.body.category.id}/subcategories`, owner.session, owner.device).send({ name: `Sub ${uid()}`, description: 'Test', storePrice: 3600, websitePrice: 2800, mrp: 16999 });
  sub = { ...s.body.subcategory, category: c.body.category };
});
const as = (who) => (method, url) => authed(method, url, who.session, who.device);
const O = (m, u) => as(owner)(m, u);
const S = (m, u) => as(staff)(m, u);

async function saree() {
  const id = uid() + uid();
  const p = await prisma.product.create({ data: { slug: `test-${id}`, sku: `T-${id}`, name: sub.name, categoryId: sub.category.id, subcategoryId: sub.id, channelVisibility: 'both', trackingMode: 'serialized', isActive: true } });
  const pc = await prisma.piece.create({ data: { productId: p.id, barcode: newTag(), status: 'in_stock' } });
  return { productId: p.id, pieceId: pc.id, tag: pc.barcode };
}
// A real sale through Module 5, then (optionally) moved to another moment.
async function sale(who, { n = 1, prices = [], invoice = true, channel = 'store', paymentMethod = 'cash', customer = {}, at } = {}) {
  const xs = [];
  for (let i = 0; i < n; i++) xs.push(await saree());
  const body = { clientRef: `bill-${uid()}${uid()}`, lines: xs.map((x, i) => ({ pieceId: x.pieceId, price: prices[i] ?? 3600, storePrice: 3600 })), channel, paymentMethod, invoice, customer };
  if (channel === 'whatsapp') body.customer = { name: 'Anitha', mobile: '9848022338', address: '12-4 Main Road, Guntur 522001', ...customer };
  const r = await as(who)('post', SA).send(body);
  expect(r.status, JSON.stringify(r.body)).toBe(201);
  if (at) {
    await prisma.order.update({ where: { id: r.body.sale.id }, data: { placedAt: at } });
    await prisma.invoice.updateMany({ where: { orderId: r.body.sale.id }, data: { generatedAt: at } });
  }
  const inv = await prisma.invoice.findUnique({ where: { orderId: r.body.sale.id } });
  return { sale: r.body.sale, invoice: inv, tags: xs.map((x) => x.tag) };
}
const day = (d) => `from=${d}&to=${d}`;

describe('who sees what (6.1)', () => {
  it('Staff open and list invoices without totals; summary, corrections and the no-invoice list are owners only', async () => {
    const a = await sale(staff, { at: new Date('2025-02-03T06:00:00Z') });
    const sl = await S('get', `${IN}?${day('2025-02-03')}`);
    expect(sl.status).toBe(200);
    expect(sl.body.scope).toBe('staff');
    expect(sl.body.totals).toBeNull();
    expect(sl.body.invoices.map((x) => x.id)).toContain(a.invoice.id);
    expect((await S('get', `${IN}/${a.invoice.id}`)).status).toBe(200);
    expect((await S('post', `${IN}/summary`).send({ from: '2025-02-03', to: '2025-02-03', channels: ['store'] })).status).toBe(403);
    expect((await S('get', `${IN}/summary/pdf?from=2025-02-03&to=2025-02-03&channels=store`)).status).toBe(403);
    expect((await S('get', `${IN}/without?${day('2025-02-03')}`)).status).toBe(403);
    expect((await S('patch', `${IN}/${a.invoice.id}/customer`).send({ name: 'X' })).status).toBe(403);
    expect((await api().get(`${IN}?${day('2025-02-03')}`)).status).toBe(401);
    const ol = await O('get', `${IN}?${day('2025-02-03')}`);
    expect(ol.body.scope).toBe('owner');
    expect(ol.body.totals.count).toBeGreaterThanOrEqual(1);
  });
});

describe('the list: invoice date in India time (6.7, 6.8)', () => {
  it('a day runs from midnight to 23:59:59 India time; cancelled listed, not counted', async () => {
    const late = await sale(owner, { at: new Date('2025-03-31T18:29:59Z') }); // 31 Mar, 23:59:59 India
    const early = await sale(owner, { at: new Date('2025-03-31T18:30:00Z') }); // 1 Apr, 00:00 India
    const gone = await sale(owner, { at: new Date('2025-03-31T20:00:00Z') });
    await prisma.order.update({ where: { id: gone.sale.id }, data: { status: 'cancelled', cancelledAt: new Date() } });
    await prisma.invoice.update({ where: { id: gone.invoice.id }, data: { cancelledAt: new Date() } });
    const apr1 = await O('get', `${IN}?${day('2025-04-01')}`);
    const ids = apr1.body.invoices.map((x) => x.id);
    expect(ids).toEqual(expect.arrayContaining([early.invoice.id, gone.invoice.id]));
    expect(ids).not.toContain(late.invoice.id);
    expect(apr1.body.totals).toEqual({ count: 1, amount: 3600, cancelled: 1 });
    expect(apr1.body.invoices.find((x) => x.id === gone.invoice.id).cancelled).toBe(true);
    const mar31 = await O('get', `${IN}?${day('2025-03-31')}`);
    expect(mar31.body.invoices.map((x) => x.id)).toEqual([late.invoice.id]);
    expect(mar31.body.invoices[0]).toMatchObject({ day: '2025-03-31', time: '11:59 pm', customer: 'Walk-in customer', channel: 'store', paymentMethod: 'cash' });
    const onlyCancelled = await O('get', `${IN}?${day('2025-04-01')}&cancelled=true`);
    expect(onlyCancelled.body.invoices.map((x) => x.id)).toEqual([gone.invoice.id]);
  });

  it('newest first, 30 at a time with "Show more", and the channel filter', async () => {
    const at = (h) => new Date(Date.UTC(2025, 4, 6, h));
    const a = await sale(owner, { at: at(4) });
    const b = await sale(owner, { at: at(5), channel: 'whatsapp' });
    const c = await sale(owner, { at: at(6) });
    const p1 = await O('get', `${IN}?${day('2025-05-06')}&limit=2`);
    expect(p1.body.invoices.map((x) => x.id)).toEqual([c.invoice.id, b.invoice.id]);
    expect(p1.body.nextOffset).toBe(2);
    const p2 = await O('get', `${IN}?${day('2025-05-06')}&limit=2&offset=2`);
    expect(p2.body.invoices.map((x) => x.id)).toEqual([a.invoice.id]);
    expect(p2.body.nextOffset).toBeNull();
    const wa = await O('get', `${IN}?${day('2025-05-06')}&channel=whatsapp`);
    expect(wa.body.invoices.map((x) => x.id)).toEqual([b.invoice.id]);
    expect(wa.body.invoices[0].customer).toBe('Anitha');
    expect((await O('get', IN)).status).toBe(400); // no days and no search
    expect((await O('get', `${IN}?from=2025-05-07&to=2025-05-06`)).body.error.code).toBe('BAD_RANGE');
  });
});

describe('search (6.9): every date', () => {
  it('by invoice number, order number, mobile, name and tag', async () => {
    const x = await sale(owner, { n: 2, customer: { name: 'Sravani Kolli', mobile: '9876512345' }, at: new Date('2025-01-15T06:00:00Z') });
    const find = async (q) => (await O('get', `${IN}?q=${encodeURIComponent(q)}`)).body.invoices.map((i) => i.id);
    const n = x.invoice.invoiceNumber;
    expect(await find(String(Number(n.slice(4))))).toEqual([x.invoice.id]);
    expect(await find(n.toLowerCase())).toEqual([x.invoice.id]);
    expect(await find(x.sale.orderNumber)).toEqual([x.invoice.id]);
    expect(await find('98765 12345')).toContain(x.invoice.id);
    expect(await find('sravani kol')).toContain(x.invoice.id);
    expect(await find(x.tags[1].toLowerCase())).toEqual([x.invoice.id]);
    expect(await find('zzqq')).toEqual([]);
    // Staff search too, without totals.
    const st = await S('get', `${IN}?q=${n}`);
    expect(st.body.invoices.map((i) => i.id)).toEqual([x.invoice.id]);
    expect(st.body.totals).toBeNull();
  });
});

describe('one invoice (5.2)', () => {
  it('every saree with its store and agreed price, GST, customer, who sold it; Staff open their own sale only', async () => {
    const x = await sale(staff, { n: 2, prices: [3000], customer: { name: 'Padma', mobile: '9123456780' } });
    const r = await S('get', `${IN}/${x.invoice.id}`);
    expect(r.status).toBe(200);
    const inv = r.body.invoice;
    expect(inv).toMatchObject({ number: x.invoice.invoiceNumber, customer: 'Padma', mobile: '9123456780', total: 6600, savings: 600, paidBy: 'Cash', cancelled: false, soldBy: { id: staff.account.id }, saleDate: null });
    expect(inv.lines).toHaveLength(2);
    expect(inv.lines[0]).toMatchObject({ code: x.tags[0], price: 3000, storePrice: 3600 });
    expect(Math.round((inv.gst.taxableValue + inv.gst.cgst + inv.gst.sgst) * 100)).toBe(660000);
    expect(inv.fileName).toBe(`Nandam-Invoice-${inv.number}.pdf`);
    expect(r.body.actions).toEqual({ correct: false, correctBlocked: 'OWNERS_ONLY', openSale: true });
    const other = await as(staff2)('get', `${IN}/${x.invoice.id}`);
    expect(other.status).toBe(200); // any invoice can be opened and shared
    expect(other.body.actions.openSale).toBe(false); // but not someone else's sale page
    const ow = await O('get', `${IN}/${x.invoice.id}`);
    expect(ow.body.actions).toEqual({ correct: true, correctBlocked: null, openSale: true });
    expect((await O('get', `${IN}/${crypto.randomUUID()}`)).status).toBe(404);
  });
});

describe('correct the customer (6.11)', () => {
  it('owners, this month: same number, date and amounts; a new PDF; logged', async () => {
    const x = await sale(owner, { customer: { name: 'Sita Devi' } });
    const bad = await O('patch', `${IN}/${x.invoice.id}/customer`).send({ name: 'Sita', mobile: '12345' });
    expect(bad.status).toBe(400);
    const r = await O('patch', `${IN}/${x.invoice.id}/customer`).send({ name: '  Seetha   Devi ', mobile: '+91 98480 22338' });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body.invoice).toMatchObject({ number: x.invoice.invoiceNumber, customer: 'Seetha Devi', mobile: '9848022338', total: 3600 });
    const after = await prisma.invoice.findUnique({ where: { id: x.invoice.id } });
    expect(after.invoiceNumber).toBe(x.invoice.invoiceNumber);
    expect(after.generatedAt.getTime()).toBe(x.invoice.generatedAt.getTime());
    expect(Number(after.totalAmount)).toBe(Number(x.invoice.totalAmount));
    expect(after.url).not.toBe(x.invoice.url);
    expect(after).toMatchObject({ customerName: 'Seetha Devi', customerMobile: '9848022338' });
    const order = await prisma.order.findUnique({ where: { id: x.sale.id } });
    expect(order.shippingAddress).toMatchObject({ fullName: 'Seetha Devi', phone: '9848022338' });
    expect(await prisma.authEvent.count({ where: { eventType: 'invoice_customer_corrected', metadata: { path: ['invoiceId'], equals: x.invoice.id } } })).toBe(1);
    // Clearing the mobile is allowed.
    const cleared = await O('patch', `${IN}/${x.invoice.id}/customer`).send({ name: 'Seetha Devi' });
    expect(cleared.body.invoice.mobile).toBeNull();
  });

  it('refused for a cancelled invoice, another month, and online orders', async () => {
    const old = await sale(owner, { at: new Date(Date.now() - 40 * 86400000) });
    const r1 = await O('patch', `${IN}/${old.invoice.id}/customer`).send({ name: 'X' });
    expect(r1.body.error.code).toBe('NOT_THIS_MONTH');
    const c = await sale(owner);
    await O('post', `${SA}/${c.sale.id}/cancel`).send({ reason: 'Wrong saree' });
    expect((await O('patch', `${IN}/${c.invoice.id}/customer`).send({ name: 'X' })).body.error.code).toBe('ALREADY_CANCELLED');
    const o = await prisma.order.create({ data: { orderNumber: `T${uid()}`, channel: 'online', status: 'processing', subtotal: 2800, total: 2800, shippingAddress: { fullName: 'Web Buyer', phone: '9000011122' } } });
    const inv = await prisma.invoice.create({ data: { invoiceNumber: `TEST-${uid()}`, orderId: o.id, channel: 'online', customerName: 'Web Buyer', gstRatePercent: 5, taxableValue: 2666.67, cgstAmount: 66.67, sgstAmount: 66.66, totalAmount: 2800, storageKey: 'x', url: 'http://x/y.pdf', generatedBy: 'system' } });
    expect((await O('patch', `${IN}/${inv.id}/customer`).send({ name: 'X' })).body.error.code).toBe('ONLINE_ORDER');
    const got = await O('get', `${IN}/${inv.id}`);
    expect(got.body.actions).toMatchObject({ correct: false, correctBlocked: 'ONLINE', openSale: false });
  });
});

describe('an invoice made later (6.5)', () => {
  it('for a sale recorded without one, this month: the next number, never twice', async () => {
    const x = await sale(staff, { invoice: false });
    const before = await S('get', `${SA}/${x.sale.id}`);
    expect(before.body.actions).toMatchObject({ makeInvoiceLater: true });
    const [a, b] = await Promise.all([S('post', `${SA}/${x.sale.id}/make-invoice`), S('post', `${SA}/${x.sale.id}/make-invoice`)]);
    expect(a.status, JSON.stringify(a.body)).toBe(200);
    expect(b.status).toBe(200);
    expect(a.body.sale.invoice).toMatchObject({ required: true, ready: true });
    expect(a.body.sale.invoice.number).toBe(b.body.sale.invoice.number);
    expect(await prisma.invoice.count({ where: { orderId: x.sale.id } })).toBe(1);
    expect(a.body.actions.makeInvoiceLater).toBe(false);
    expect(await prisma.authEvent.count({ where: { eventType: 'invoice_made_later', metadata: { path: ['orderId'], equals: x.sale.id } } })).toBe(1);
    // Someone else's sale: Staff can't; owners can.
    const y = await sale(staff2, { invoice: false });
    expect((await S('post', `${SA}/${y.sale.id}/make-invoice`)).status).toBe(403);
    expect((await O('post', `${SA}/${y.sale.id}/make-invoice`)).status).toBe(200);
  });

  it('refused for another month and for a cancelled sale', async () => {
    const old = await sale(owner, { invoice: false, at: new Date(Date.now() - 40 * 86400000) });
    const r = await O('post', `${SA}/${old.sale.id}/make-invoice`);
    expect(r.body.error.code).toBe('NOT_THIS_MONTH');
    expect((await O('get', `${SA}/${old.sale.id}`)).body.actions).toMatchObject({ makeInvoiceLater: false, makeInvoiceLaterBlocked: 'NOT_THIS_MONTH' });
    const c = await sale(owner, { invoice: false });
    await O('post', `${SA}/${c.sale.id}/cancel`).send({ reason: 'Wrong saree' });
    expect((await O('post', `${SA}/${c.sale.id}/make-invoice`)).body.error.code).toBe('ALREADY_CANCELLED');
  });

  it('owners see the period\'s sales without an invoice, each ready for "Make an invoice"', async () => {
    const at = new Date('2025-06-10T08:00:00Z');
    const s1 = await sale(owner, { invoice: false, at, n: 2 });
    const s2 = await sale(owner, { invoice: false, at, channel: 'whatsapp' });
    await sale(owner, { at }); // invoiced: not listed
    const r = await O('get', `${IN}/without?${day('2025-06-10')}`);
    expect(r.status).toBe(200);
    expect(r.body.sales.map((s) => s.id).sort()).toEqual([s1.sale.id, s2.sale.id].sort());
    expect(r.body.totals).toEqual({ count: 2, amount: 10800 });
    expect(r.body.sales.find((s) => s.id === s1.sale.id)).toMatchObject({ sarees: 2, total: 7200, canMakeInvoice: false, channel: 'store' });
    const wa = await O('get', `${IN}/without?${day('2025-06-10')}&channel=whatsapp`);
    expect(wa.body.sales.map((s) => s.id)).toEqual([s2.sale.id]);
  });
});

describe('the sales summary (5.3, 6.2–6.7)', () => {
  it('totals equal the invoices list for the same period; cancelled not counted; sales without an invoice separate', async () => {
    const at = (h) => new Date(Date.UTC(2025, 6, 14, h)); // 14 Jul 2025
    const a = await sale(owner, { n: 2, prices: [3000, 1999.99], paymentMethod: 'upi', customer: { name: 'Sita, "Devi"' }, at: at(5) });
    const b = await sale(owner, { channel: 'whatsapp', paymentMethod: 'card', at: at(6) });
    const c = await sale(owner, { at: at(7) });
    await prisma.order.update({ where: { id: c.sale.id }, data: { status: 'cancelled', cancelledAt: new Date() } });
    await prisma.invoice.update({ where: { id: c.invoice.id }, data: { cancelledAt: new Date() } });
    await sale(owner, { invoice: false, at: at(8) });
    const q = { from: '2025-07-14', to: '2025-07-14' };
    const r = await O('post', `${IN}/summary`).send({ ...q, channels: ['store', 'whatsapp', 'online'] });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    const s = r.body.summary;
    const list = await O('get', `${IN}?from=${q.from}&to=${q.to}`);
    expect(s.totals.total).toBe(list.body.totals.amount);
    expect(s.totals).toMatchObject({ invoices: 2, sarees: 3, total: 8599.99, cancelled: 1, gstRatePercent: 5 });
    const inv = await prisma.invoice.findMany({ where: { id: { in: [a.invoice.id, b.invoice.id] } } });
    const sum = (k) => Math.round(inv.reduce((t, i) => t + Number(i[k]) * 100, 0)) / 100;
    expect(s.totals.taxableValue).toBe(sum('taxableValue'));
    expect(s.totals.cgst).toBe(sum('cgstAmount'));
    expect(s.totals.sgst).toBe(sum('sgstAmount'));
    expect(Math.round((s.totals.taxableValue + s.totals.cgst + s.totals.sgst) * 100)).toBe(Math.round(s.totals.total * 100));
    expect(s.byChannel).toEqual({ store: 4999.99, whatsapp: 3600 });
    expect(s.byPayment).toEqual({ upi: 4999.99, card: 3600 });
    expect(s.withoutInvoice).toEqual({ sales: 1, amount: 3600 });
    expect(s).toMatchObject({ label: '14 Jul 2025', empty: false, pdfName: 'Nandam-Sales-summary-2025-07-14.pdf', csvName: 'Nandam-Invoices-2025-07-14.csv' });
    // Channels filter
    const wa = await O('post', `${IN}/summary`).send({ ...q, channels: ['whatsapp'] });
    expect(wa.body.summary.totals).toMatchObject({ invoices: 1, total: 3600, cancelled: 0 });
    expect(wa.body.summary.withoutInvoice.sales).toBe(0);
    // The PDF
    const pdf = await O('get', `${IN}/summary/pdf?from=${q.from}&to=${q.to}&channels=store,whatsapp,online`).buffer(true).parse((res, cb) => { const d = []; res.on('data', (x) => d.push(x)); res.on('end', () => cb(null, Buffer.concat(d))); });
    expect(pdf.status).toBe(200);
    expect(pdf.headers['content-type']).toBe('application/pdf');
    expect(pdf.headers['content-disposition']).toContain('Nandam-Sales-summary-2025-07-14.pdf');
    expect(pdf.body.subarray(0, 4).toString()).toBe('%PDF');
    // The CSV: one row per invoice, cancelled marked, Excel-friendly
    const csv = await O('get', `${IN}/summary/csv?from=${q.from}&to=${q.to}&channels=store,whatsapp,online`);
    expect(csv.status).toBe(200);
    expect(csv.headers['content-type']).toContain('text/csv');
    const text = csv.text;
    expect(text.charCodeAt(0)).toBe(0xfeff);
    const rows = text.slice(1).trim().split('\r\n');
    expect(rows[0]).toBe('Invoice number,Date,Customer,Mobile,Channel,Paid by,Order number,Taxable value,CGST,SGST,Total,Status');
    expect(rows).toHaveLength(4);
    expect(rows.find((l) => l.startsWith(a.invoice.invoiceNumber))).toContain('"Sita, ""Devi"""');
    expect(rows.find((l) => l.startsWith(a.invoice.invoiceNumber))).toContain(',2025-07-14,');
    expect(rows.find((l) => l.startsWith(c.invoice.invoiceNumber))).toMatch(/,Cancelled$/);
  });

  it('labels whole months, refuses bad ranges, and says when there is nothing', async () => {
    const m = await O('post', `${IN}/summary`).send({ from: '2025-08-01', to: '2025-08-31', channels: ['store'] });
    expect(m.body.summary).toMatchObject({ label: 'August 2025', empty: true });
    expect(m.body.summary.totals.invoices).toBe(0);
    const pdf = await O('get', `${IN}/summary/pdf?from=2025-08-01&to=2025-08-31&channels=store`);
    expect(pdf.status).toBe(200);
    const long = await O('post', `${IN}/summary`).send({ from: '2024-01-01', to: '2025-06-30', channels: ['store'] });
    expect(long.body.error.code).toBe('RANGE_TOO_LONG');
    expect((await O('post', `${IN}/summary`).send({ from: '2025-08-02', to: '2025-08-01', channels: ['store'] })).body.error.code).toBe('BAD_RANGE');
    expect((await O('post', `${IN}/summary`).send({ from: '2099-01-01', to: '2099-01-02', channels: ['store'] })).body.error.code).toBe('BAD_RANGE');
    expect((await O('post', `${IN}/summary`).send({ from: '2025-08-01', to: '2025-08-02', channels: [] })).status).toBe(400);
  });
});
