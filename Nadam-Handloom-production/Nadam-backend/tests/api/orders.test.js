// Module 7 (Orders and shipping): the rules in plan sections 5, 6, 8 and 13.
// Test orders are dated 2024 so they sort before the copied shop data and other tests'.
import crypto from 'node:crypto';
import { describe, it, expect, beforeAll } from 'vitest';
import { api, prisma, signedIn, authed, makeAccount, allPages } from '../support/helpers.js';

const C = '/api/v2/catalog';
const SA = '/api/v2/sales';
const OR = '/api/v2/orders';
const uid = () => crypto.randomUUID().slice(0, 8);
let seq = Math.floor(Math.random() * 300000) + 9000000;
const newTag = () => `NH${seq++}`;
const newAwb = () => `T${String(Date.now()).slice(-8)}${String(seq++).slice(-4)}`;
let owner;
let staff;
let sub;
beforeAll(async () => {
  owner = await signedIn({ role: 'ADMIN', name: 'Ship' });
  staff = await signedIn({ role: 'STAFF', name: 'Ravi' });
  const c = await authed('post', `${C}/categories`, owner.session, owner.device).send({ name: `Cat ${uid()}`, description: 'Test category' });
  const s = await authed('post', `${C}/categories/${c.body.category.id}/subcategories`, owner.session, owner.device).send({ name: `Sub ${uid()}`, description: 'Test', storePrice: 3600, websitePrice: 2800, mrp: 16999 });
  sub = { ...s.body.subcategory, category: c.body.category };
});
const as = (who) => (method, url) => authed(method, url, who.session, who.device);
const O = (m, u) => as(owner)(m, u);
const S = (m, u) => as(staff)(m, u);

async function saree(status = 'in_stock') {
  const id = uid() + uid();
  const p = await prisma.product.create({ data: { slug: `test-${id}`, sku: `T-${id}`, name: sub.name, categoryId: sub.category.id, subcategoryId: sub.id, channelVisibility: 'both', trackingMode: 'serialized', isActive: true } });
  const pc = await prisma.piece.create({ data: { productId: p.id, barcode: newTag(), status } });
  return { productId: p.id, pieceId: pc.id, tag: pc.barcode };
}
// A WhatsApp order made through Module 5, then dated.
async function whatsappOrder({ at, name = 'Padma', mobile = '9123456780', address = 'Flat 3B, Sai Residency\nLakshmipuram\nGuntur 522007', invoice = true } = {}) {
  const x = await saree();
  const r = await O('post', SA).send({ clientRef: `bill-${uid()}${uid()}`, lines: [{ pieceId: x.pieceId, price: 3000, storePrice: 3600 }], channel: 'whatsapp', paymentMethod: 'upi', invoice, customer: { name, mobile, address } });
  expect(r.status, JSON.stringify(r.body)).toBe(201);
  if (at) await prisma.order.update({ where: { id: r.body.sale.id }, data: { placedAt: at } });
  return { id: r.body.sale.id, orderNumber: r.body.sale.orderNumber, tag: x.tag, pieceId: x.pieceId };
}
// A paid website order, as the old backend makes them.
async function onlineOrder({ at = new Date('2024-03-01T05:00:00Z'), paid = true, status = 'processing', withInvoice = false } = {}) {
  const customer = await makeAccount({ role: 'CUSTOMER', name: 'Kavya' });
  const x = await saree(paid ? 'sold_online' : 'reserved');
  const order = await prisma.order.create({
    data: {
      orderNumber: `NH${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}`, authAccountId: customer.id, channel: 'online', status, subtotal: 2800, total: 2800, placedAt: at,
      shippingAddress: { fullName: 'Kavya Sri', phone: '9989012345', line1: 'D.No 12-4, Brodipet', line2: '4th Lane', city: 'Guntur', state: 'Andhra Pradesh', pincode: '522002', country: 'India' },
      items: { create: [{ productId: x.productId, pieceId: x.pieceId, nameSnapshot: sub.name, priceSnapshot: 2800, quantity: 1 }] },
      payment: { create: { razorpayOrderId: `order_${uid()}${uid()}`, status: paid ? 'paid' : 'created', amount: 2800 } },
      ...(status === 'pending_payment' ? {} : { shipment: { create: {} } }),
    },
  });
  if (withInvoice) await prisma.invoice.create({ data: { invoiceNumber: `TEST-${uid()}`, orderId: order.id, channel: 'online', customerName: 'Kavya Sri', gstRatePercent: 5, taxableValue: 2666.67, cgstAmount: 66.67, sgstAmount: 66.66, totalAmount: 2800, storageKey: 'x', url: 'http://test.local/x.pdf', generatedBy: 'system' } });
  return { id: order.id, orderNumber: order.orderNumber, pieceId: x.pieceId, customerId: customer.id };
}
const ship = (who, id, awb, carrier) => as(who)('post', `${OR}/${id}/ship`).send({ awb, ...(carrier ? { carrier } : {}) });

describe('who can do what (6.1)', () => {
  it('Owners and Staff list and ship; cancel and unpaid checkouts are owners only', async () => {
    const o = await whatsappOrder({ at: new Date('2024-01-05T05:00:00Z') });
    expect((await S('get', OR)).status).toBe(200);
    expect((await S('get', `${OR}/${o.id}`)).body.actions).toMatchObject({ ship: true, cancel: false, cancelBlocked: 'OWNERS_ONLY' });
    expect((await S('post', `${OR}/${o.id}/cancel`).send({ reason: 'Wrong saree' })).status).toBe(403);
    expect((await S('get', `${OR}/unpaid`)).status).toBe(403);
    expect((await api().get(OR)).status).toBe(401);
    expect((await ship(staff, o.id, newAwb())).status).toBe(200);
  });
});

describe('the lists (5.1, 6.2)', () => {
  it('To ship oldest first with waiting days; Shipped newest shipped first; counts', async () => {
    const a = await whatsappOrder({ at: new Date('2024-02-01T05:00:00Z') });
    const b = await onlineOrder({ at: new Date('2024-02-02T05:00:00Z') });
    const c = await whatsappOrder({ at: new Date('2024-02-03T05:00:00Z'), name: 'Anitha', address: '12-4 Main Road\nTenali 522201' });
    const { items: toShip, first } = await allPages(O, `${OR}?tab=to_ship`, 'orders');
    const mine = toShip.filter((x) => [a.id, b.id, c.id].includes(x.id));
    expect(mine.map((x) => x.id)).toEqual([a.id, b.id, c.id]);
    expect(mine[0]).toMatchObject({ channel: 'whatsapp', customer: 'Padma', town: 'Guntur', sarees: 1, total: 3000 });
    expect(mine[0].waitingDays).toBeGreaterThan(100);
    expect(mine[1]).toMatchObject({ channel: 'online', customer: 'Kavya Sri', town: 'Guntur' });
    expect(mine[2].town).toBe('Tenali');
    expect(first.counts.to_ship).toBeGreaterThanOrEqual(3);
    expect(toShip).toHaveLength(first.counts.to_ship);
    expect((await O('get', `${OR}/counts`)).body.toShip).toBe(first.counts.to_ship);
    await ship(owner, a.id, newAwb());
    await ship(owner, c.id, newAwb());
    const { items: shipped } = await allPages(O, `${OR}?tab=shipped`, 'orders');
    const order = shipped.filter((x) => [a.id, c.id].includes(x.id)).map((x) => x.id);
    expect(order).toEqual([c.id, a.id]);
    // A store (counter) sale has no shipping page.
    const x = await saree();
    const store = await O('post', SA).send({ clientRef: `bill-${uid()}${uid()}`, lines: [{ pieceId: x.pieceId, price: 3600, storePrice: 3600 }], channel: 'store', paymentMethod: 'cash', invoice: false });
    expect((await O('get', `${OR}/${store.body.sale.id}`)).status).toBe(404);
  });

  it('search: order number, name, mobile, tracking number, tag (every list)', async () => {
    const o = await whatsappOrder({ name: 'Sravani Kolli', mobile: '9876512345', at: new Date('2024-04-01T05:00:00Z') });
    const awb = newAwb();
    await ship(owner, o.id, awb);
    const find = async (q) => (await O('get', `${OR}?q=${encodeURIComponent(q)}`)).body.orders.map((x) => x.id);
    expect(await find(o.orderNumber)).toContain(o.id);
    expect(await find('sravani kol')).toContain(o.id);
    expect(await find('98765 12345')).toContain(o.id);
    expect(await find(awb.toLowerCase())).toEqual([o.id]);
    expect(await find(o.tag)).toEqual([o.id]);
    expect(await find('zzqqxx')).toEqual([]);
  });
});

describe('one order (5.2)', () => {
  it('the sarees, a clean ship-to, payment, invoice, timeline', async () => {
    const o = await whatsappOrder({ at: new Date('2024-05-01T05:00:00Z') });
    const r = await S('get', `${OR}/${o.id}`);
    expect(r.status).toBe(200);
    expect(r.body.order).toMatchObject({ orderNumber: o.orderNumber, status: 'processing', payment: { text: 'UPI', paid: true }, customer: { name: 'Padma', mobile: '9123456780', lines: ['Flat 3B, Sai Residency', 'Lakshmipuram', 'Guntur 522007'] } });
    expect(r.body.order.lines[0]).toMatchObject({ code: o.tag, price: 3000 });
    expect(r.body.order.invoice.number).toMatch(/^INV-/);
    expect(r.body.order.events[0].text).toBe('WhatsApp order made by Ship Person');
    expect(r.body.order.message).toBeNull();
    const online = await onlineOrder({ withInvoice: true });
    const on = await O('get', `${OR}/${online.id}`);
    expect(on.body.order.customer).toMatchObject({ name: 'Kavya Sri', lines: ['D.No 12-4, Brodipet', '4th Lane', 'Guntur, Andhra Pradesh 522002'] });
    expect(on.body.order.payment).toEqual({ text: 'Paid online (Razorpay)', paid: true });
    expect(on.body.order.events.map((e) => e.text)).toEqual(['Ordered on the website', 'Paid online (Razorpay)']);
  });
});

describe('shipping (5.3, 6.4, 6.5)', () => {
  it('a tidy tracking number; shipped with who and when; the WhatsApp message', async () => {
    const o = await whatsappOrder({ at: new Date('2024-06-01T05:00:00Z') });
    expect((await ship(owner, o.id, 'AB12')).body.error.code).toBe('AWB_INVALID');
    const raw = `h1${String(seq++).padStart(9, '0')}`;
    const tidy = raw.toUpperCase();
    const r = await ship(staff, o.id, `${raw.slice(0, 4)} ${raw.slice(4, 7)}-${raw.slice(7)}`);
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body.order).toMatchObject({ status: 'shipped', carrier: 'DTDC', awb: tidy });
    expect(r.body.actions).toMatchObject({ ship: false, changeTracking: true, markDelivered: true, sendTracking: true, cancel: false });
    const m = r.body.order.message;
    expect(m).toContain(`Hi Padma, your Nandam Handlooms order ${o.orderNumber} has shipped via DTDC.`);
    expect(m).toContain(`Tracking ID (AWB): ${tidy}`);
    expect(m).toContain('Track it here: https://www.dtdc.com/track-your-shipment/');
    expect(m).toContain(sub.name);
    const sh = await prisma.shipment.findUnique({ where: { orderId: o.id } });
    expect(sh).toMatchObject({ status: 'shipped', awbNumber: tidy, shippedById: staff.account.id });
    expect(sh.shippedAt).toBeTruthy();
    expect((await prisma.order.findUnique({ where: { id: o.id } })).status).toBe('shipped');
    expect(r.body.order.events.at(-1).text).toBe('Shipped by Ravi Person');
    expect(await prisma.authEvent.count({ where: { eventType: 'order_marked_shipped', metadata: { path: ['orderId'], equals: o.id } } })).toBe(1);
    expect((await ship(owner, o.id, newAwb())).body.error.code).toBe('ALREADY_SHIPPED');
  });

  it('one tracking number, one order: refused saying which order has it, also when two phones race', async () => {
    const a = await whatsappOrder({ at: new Date('2024-06-02T05:00:00Z') });
    const b = await whatsappOrder({ at: new Date('2024-06-03T05:00:00Z'), name: 'Anitha' });
    const awb = newAwb();
    await ship(owner, a.id, awb);
    const dup = await ship(owner, b.id, awb);
    expect(dup.status).toBe(409);
    expect(dup.body.error).toMatchObject({ code: 'AWB_TAKEN', details: { orderNumber: a.orderNumber } });
    expect(dup.body.error.message).toBe(`${awb} is already on order ${a.orderNumber} (Padma). Check the label.`);
    expect((await prisma.order.findUnique({ where: { id: b.id } })).status).toBe('processing');
    const c = await whatsappOrder({ at: new Date('2024-06-04T05:00:00Z') });
    const d = await whatsappOrder({ at: new Date('2024-06-05T05:00:00Z') });
    const same = newAwb();
    const [x, y] = await Promise.all([ship(owner, c.id, same), ship(staff, d.id, same)]);
    expect([x.status, y.status].sort()).toEqual([200, 409]);
  });

  it('orders shipped from the old app can share a number; the new app still never reuses one', async () => {
    // Seen in the live data on 2026-10-13: 13 orders shipped from the old app with one number.
    const shared = newAwb();
    const [a, b, c] = [await whatsappOrder({ at: new Date('2024-06-07T05:00:00Z') }), await whatsappOrder({ at: new Date('2024-06-07T06:00:00Z'), name: 'Anitha' }), await whatsappOrder({ at: new Date('2024-06-07T07:00:00Z') })];
    for (const [i, o] of [a, b].entries()) {
      await prisma.order.update({ where: { id: o.id }, data: { status: 'shipped' } });
      const old = { carrier: 'DTDC', awbNumber: shared, status: 'shipped', shippedAt: new Date(), createdAt: new Date(Date.UTC(2024, 5, 7, 8, i)) };
      await prisma.shipment.upsert({ where: { orderId: o.id }, create: { orderId: o.id, ...old }, update: old });
    }
    const opened = await O('get', `${OR}/${b.id}`);
    expect(opened.status, JSON.stringify(opened.body)).toBe(200);
    expect(opened.body.order.awb).toBe(shared);
    const dup = await ship(owner, c.id, shared);
    expect(dup.status).toBe(409);
    expect(dup.body.error).toMatchObject({ code: 'AWB_TAKEN', details: { orderNumber: a.orderNumber } });
    expect((await ship(owner, c.id, newAwb())).status).toBe(200);
    // Correcting one of the old orders to a number of its own works; to the shared one it is refused.
    const fixed = await O('patch', `${OR}/${b.id}/tracking`).send({ awb: newAwb() });
    expect(fixed.status, JSON.stringify(fixed.body)).toBe(200);
    const back = await O('patch', `${OR}/${b.id}/tracking`).send({ awb: shared });
    expect(back.body.error).toMatchObject({ code: 'AWB_TAKEN', details: { orderNumber: a.orderNumber } });
  });

  it('another courier: no DTDC link; an online order must be paid', async () => {
    const o = await whatsappOrder({ at: new Date('2024-06-06T05:00:00Z') });
    const r = await ship(owner, o.id, 'EM123456789IN', 'India Post');
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body.order.carrier).toBe('India Post');
    expect(r.body.order.message).toContain('shipped via India Post');
    expect(r.body.order.message).toContain('Tracking number: EM123456789IN');
    expect(r.body.order.message).not.toContain('dtdc');
    expect(r.body.order.trackingUrl).toBeNull();
    const unpaid = await onlineOrder({ paid: false });
    expect((await ship(owner, unpaid.id, newAwb())).body.error.code).toBe('NOT_PAID');
  });
});

describe('after shipping (6.6, 6.8)', () => {
  it('change the tracking number: the old one kept in the history; same or taken refused', async () => {
    const a = await whatsappOrder({ at: new Date('2024-07-01T05:00:00Z') });
    const b = await whatsappOrder({ at: new Date('2024-07-02T05:00:00Z') });
    const one = newAwb();
    const two = newAwb();
    await ship(owner, a.id, one);
    await ship(owner, b.id, two);
    expect((await S('patch', `${OR}/${a.id}/tracking`).send({ awb: one })).body.error.code).toBe('SAME_AWB');
    expect((await S('patch', `${OR}/${a.id}/tracking`).send({ awb: two })).body.error.code).toBe('AWB_TAKEN');
    const three = newAwb();
    const r = await S('patch', `${OR}/${a.id}/tracking`).send({ awb: three });
    expect(r.status).toBe(200);
    expect(r.body.order.awb).toBe(three);
    expect(r.body.order.events.map((e) => e.text)).toContain(`Tracking number changed by Ravi Person: ${one} → ${three}`);
    // The old number is free again.
    const c = await whatsappOrder({ at: new Date('2024-07-03T05:00:00Z') });
    expect((await ship(owner, c.id, one)).status).toBe(200);
  });

  it('mark delivered: only after shipping, once; then the number can\'t change', async () => {
    const o = await whatsappOrder({ at: new Date('2024-07-10T05:00:00Z') });
    expect((await S('post', `${OR}/${o.id}/delivered`)).body.error.code).toBe('NOT_SHIPPED');
    await ship(owner, o.id, newAwb());
    const r = await S('post', `${OR}/${o.id}/delivered`);
    expect(r.status).toBe(200);
    expect(r.body.order).toMatchObject({ status: 'delivered' });
    expect(r.body.order.deliveredDate).toBeTruthy();
    expect(r.body.order.events.at(-1).text).toBe('Marked delivered by Ravi Person');
    const sh = await prisma.shipment.findUnique({ where: { orderId: o.id } });
    expect(sh).toMatchObject({ status: 'delivered', deliveredById: staff.account.id });
    expect((await S('post', `${OR}/${o.id}/delivered`)).status).toBe(200);
    expect((await S('patch', `${OR}/${o.id}/tracking`).send({ awb: newAwb() })).body.error.code).toBe('NOT_SHIPPED');
    const { items: delivered } = await allPages(O, `${OR}?tab=delivered`, 'orders');
    expect(delivered.map((x) => x.id)).toContain(o.id);
  });

  it('"Check delivery" after 10 days on the way', async () => {
    const o = await whatsappOrder({ at: new Date('2024-07-20T05:00:00Z') });
    await ship(owner, o.id, newAwb());
    await prisma.shipment.update({ where: { orderId: o.id }, data: { shippedAt: new Date(Date.now() - 12 * 86400000) } });
    const r = await O('get', `${OR}/${o.id}`);
    expect(r.body.order.checkDelivery).toBe(true);
  });
});

describe('cancel an order not yet shipped (6.3)', () => {
  it('owners, this month: sarees back in stock, invoice CANCELLED, refund note for online', async () => {
    const online = await onlineOrder({ at: new Date(), withInvoice: true });
    const r = await O('post', `${OR}/${online.id}/cancel`).send({ reason: 'Customer changed their mind' });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body).toMatchObject({ refundDue: 2800, order: { status: 'cancelled', cancelled: { reason: 'Customer changed their mind', by: 'Ship Person' } } });
    expect((await prisma.piece.findUnique({ where: { id: online.pieceId } })).status).toBe('in_stock');
    const stamped = await prisma.invoice.findUnique({ where: { orderId: online.id } });
    expect(stamped.cancelledAt).toBeTruthy();
    expect(stamped.storageKey.startsWith('invoices/cancelled/')).toBe(true); // the PDF carries the CANCELLED stamp
    expect(await prisma.stockLedger.count({ where: { pieceId: online.pieceId, reason: 'order_cancelled' } })).toBe(1);
    expect((await O('post', `${OR}/${online.id}/cancel`).send({ reason: 'Again' })).body.error.code).toBe('ALREADY_CANCELLED');
    const wa = await whatsappOrder({ at: new Date() });
    const w = await O('post', `${OR}/${wa.id}/cancel`).send({ reason: 'Saree damaged while packing' });
    expect(w.body.refundDue).toBeNull();
    expect((await prisma.piece.findUnique({ where: { id: wa.pieceId } })).status).toBe('in_stock');
  });

  it('refused once shipped, and for last month\'s orders', async () => {
    const o = await whatsappOrder({ at: new Date() });
    await ship(owner, o.id, newAwb());
    expect((await O('post', `${OR}/${o.id}/cancel`).send({ reason: 'Wrong saree' })).body.error.code).toBe('SHIPPED');
    const old = await whatsappOrder({ at: new Date(Date.now() - 40 * 86400000) });
    expect((await O('post', `${OR}/${old.id}/cancel`).send({ reason: 'Wrong saree' })).body.error.code).toBe('NOT_THIS_MONTH');
    expect((await O('get', `${OR}/${old.id}`)).body.actions).toMatchObject({ cancel: false, cancelBlocked: 'NOT_THIS_MONTH' });
  });
});

describe('unpaid checkouts (6.7)', () => {
  it('owners: one row per customer with their tries; 15 minutes to 30 days only', async () => {
    const a = await onlineOrder({ paid: false, status: 'pending_payment', at: new Date(Date.now() - 2 * 3600000) });
    for (const h of [3, 4]) {
      const x = await saree('in_stock');
      await prisma.order.create({ data: { orderNumber: `NH${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}`, authAccountId: a.customerId, channel: 'online', status: 'pending_payment', subtotal: 5600, total: 5600, placedAt: new Date(Date.now() - h * 3600000), shippingAddress: { fullName: 'Kavya Sri', phone: '9989012345' }, items: { create: [{ productId: x.productId, pieceId: x.pieceId, nameSnapshot: sub.name, priceSnapshot: 5600, quantity: 1 }] } } });
    }
    const recent = await onlineOrder({ paid: false, status: 'pending_payment', at: new Date(Date.now() - 5 * 60000) });
    const ancient = await onlineOrder({ paid: false, status: 'pending_payment', at: new Date(Date.now() - 40 * 86400000) });
    const r = await O('get', `${OR}/unpaid`);
    expect(r.status).toBe(200);
    const row = r.body.customers.find((c) => c.id === a.customerId);
    expect(row).toMatchObject({ name: 'Kavya Sri', mobile: '9989012345', tries: 3, amount: 2800, sarees: 1 });
    expect(r.body.customers.find((c) => c.id === recent.customerId)).toBeUndefined();
    expect(r.body.customers.find((c) => c.id === ancient.customerId)).toBeUndefined();
  });
});
