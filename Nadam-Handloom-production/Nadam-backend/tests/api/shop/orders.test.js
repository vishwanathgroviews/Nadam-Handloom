// Website W7: My orders (docs/modules/web-05-my-orders.md): every rule in section 7 and every
// situation in section 8, with the stand-in for Razorpay (PAYMENT_PROVIDER=fake). The shop ships,
// delivers and cancels through the admin app's own endpoints (Module 7).
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { api, prisma, signUp, as } from '../../support/shop.js';
import { signedIn, authed } from '../../support/helpers.js';
import * as fake from '../../../src/services/payments/fake.provider.js';
import { hmac } from '../../../src/services/payments/signature.js';
import { storage } from '../../../src/services/storage/index.js';
import { outbox } from '../../../src/services/push/console.provider.js';
import { noticesSettled } from '../../../src/services/shop/orderNotices.service.js';
import { DTDC_TRACKING_URL } from '../../../src/services/order.service.js';
import { pdfText } from '../../support/pdf.js';

const T = String(crypto.randomInt(10_000_000, 99_999_999));
const OR = '/api/v2/orders';
let cat;
const col = {};
let owner;
let n = 0;

async function saree(collection = col.pure, pieces = 1) {
  n += 1;
  const key = `s${n}`;
  return prisma.product.create({
    data: {
      slug: `mo-${T}-${key}`, sku: `NH-M${T}-${key}`.toUpperCase(), name: collection.name, categoryId: cat.id, subcategoryId: collection.id,
      channelVisibility: 'both', trackingMode: 'serialized', createdAt: new Date(Date.now() - n * 1000),
      images: { create: [{ url: `https://example.test/${T}-${key}.jpg`, sortOrder: 0 }] },
      pieces: { create: Array.from({ length: pieces }, (_, i) => ({ barcode: `M${T}${key}${i}`.toUpperCase(), status: 'in_stock' })) },
    },
  });
}

const ADDRESS = { label: 'home', fullName: 'Priya Sharma', mobile: '9876543210', line1: 'Flat 302, Sri Sai Residency', line2: 'Road No. 12, Banjara Hills', landmark: 'Near the water tank', pincode: '500034', city: 'Hyderabad', state: 'Telangana' };
async function customer() {
  const who = await signUp();
  const call = as(who);
  const a = await call('post', '/me/addresses').send(ADDRESS);
  return { who, call, addressId: a.body.address.id };
}
const put = (c, product, quantity = 1) => c.call('put', `/me/bag/items/${product.slug}`).send({ quantity });
const expectOf = (bag) => ({ amount: bag.totals.amount, lines: bag.items.filter((l) => l.quantity > 0).map((l) => ({ slug: l.slug, quantity: l.quantity, price: l.price })) });
async function checkout(c, ...products) {
  for (const p of products) await put(c, p);
  const bag = await c.call('get', '/me/bag');
  const r = await c.call('post', '/checkout').send({ addressId: c.addressId, expect: expectOf(bag.body) });
  if (r.status !== 200) throw new Error(`checkout: ${r.status} ${JSON.stringify(r.body)}`);
  return r.body;
}
async function paid(c, ...products) {
  const { order, razorpay } = await checkout(c, ...(products.length ? products : [await saree()]));
  const { receipt } = fake.pay(razorpay.orderId, { method: 'upi' });
  const v = await c.call('post', `/orders/${order.number}/verify`).send({ razorpayOrderId: receipt.razorpay_order_id, razorpayPaymentId: receipt.razorpay_payment_id, razorpaySignature: receipt.razorpay_signature });
  expect(v.body.order.status).toBe('paid');
  return v.body.order;
}
const idOf = async (number) => (await prisma.order.findUnique({ where: { orderNumber: number } })).id;
const O = (method, path) => authed(method, path, owner.session, owner.device);
const awb = () => `D${String(crypto.randomInt(1e9, 9e9))}`;
async function ship(number, tracking = awb()) {
  const r = await O('post', `${OR}/${await idOf(number)}/ship`).send({ awb: tracking });
  expect(r.status, JSON.stringify(r.body)).toBe(200);
  return tracking;
}
const delivered = async (number) => expect((await O('post', `${OR}/${await idOf(number)}/delivered`)).status).toBe(200);
function webhook(event) {
  const body = JSON.stringify(event);
  return api().post('/api/v2/payments/razorpay/webhook').set('content-type', 'application/json').set('x-razorpay-signature', hmac(Buffer.from(body), 'test_webhook_secret_0123456789abcdef')).set('x-razorpay-event-id', crypto.randomUUID()).send(body);
}
// An order from the old website: a Payment, no payment tries (Module 7 tests make them the same way).
async function oldWebsiteOrder(accountId, product, { at = new Date(Date.now() - 40 * 86400_000) } = {}) {
  const piece = await prisma.piece.findFirst({ where: { productId: product.id } });
  await prisma.piece.update({ where: { id: piece.id }, data: { status: 'sold_online' } });
  return prisma.order.create({
    data: {
      orderNumber: `NH${String(crypto.randomInt(0, 1e8)).padStart(8, '0')}`, authAccountId: accountId, channel: 'online', status: 'delivered', subtotal: 5800, total: 5800, placedAt: at,
      shippingAddress: { fullName: 'Sada', phone: '9848571449', line1: 'Bfsk', line2: 'Bsns', city: 'Guntur', state: 'Andhra Pradesh', pincode: '522503', country: 'India' },
      items: { create: [{ productId: product.id, pieceId: piece.id, nameSnapshot: product.name, priceSnapshot: 5800, quantity: 1, imageSnapshot: 'https://example.test/old.jpg' }] },
      payment: { create: { razorpayOrderId: `order_old${crypto.randomUUID().slice(0, 12)}`, razorpayPaymentId: `pay_old${crypto.randomUUID().slice(0, 12)}`, status: 'paid', amount: 5800 } },
      shipment: { create: { carrier: 'DTDC', awbNumber: awb(), status: 'delivered', shippedAt: new Date(at.getTime() + 2 * 86400_000), deliveredAt: new Date(at.getTime() + 5 * 86400_000) } },
    },
  });
}

beforeAll(async () => {
  cat = await prisma.category.create({ data: { name: `MY ORDERS TEST ${T}`, slug: `my-orders-test-${T}`, description: 'My orders test sarees', sortOrder: 996 } });
  const sub = (name, price) => prisma.subcategory.create({ data: { categoryId: cat.id, name, description: 'Pure handloom', onlinePrice: price, storePrice: price, mrp: 16999 } });
  col.pure = await sub(`Pure Pattu Butta ${T}`, 5800);
  col.plain = await sub(`Plain Saree ${T}`, 2700);
  owner = await signedIn({ role: 'ADMIN', name: 'Orders W7' });
});
beforeEach(() => fake.reset());

describe('the list (rule 2)', () => {
  it('needs a sign-in; a new customer has no orders', async () => {
    expect((await api().get('/api/v2/shop/orders')).status).toBe(401);
    const c = await customer();
    const r = await c.call('get', '/orders');
    expect(r.status).toBe(200);
    expect(r.headers['cache-control']).toBe('no-store');
    expect(r.body).toEqual({ orders: [], nextOffset: null });
  });

  it('paid, being confirmed, refunded and a checkout still held show, newest first; checkouts that ended unpaid never do', async () => {
    const c = await customer();
    // An abandoned checkout: the window closed, the 15 minutes ended.
    const ended = await checkout(c, await saree());
    await prisma.reservation.updateMany({ where: { orderId: await idOf(ended.order.number) }, data: { expiresAt: new Date(Date.now() - 1000) } });
    // A checkout replaced by the next one (cancelled, nothing paid).
    const replaced = await checkout(c, await saree());
    const p1 = await paid(c);
    // Paid late: the saree sold meanwhile, refunded automatically.
    const late = await checkout(c, await saree());
    const lateId = await idOf(late.order.number);
    await prisma.reservation.updateMany({ where: { orderId: lateId }, data: { status: 'expired' } });
    await prisma.piece.updateMany({ where: { id: { in: (await prisma.orderItem.findMany({ where: { orderId: lateId } })).map((i) => i.pieceId) } }, data: { status: 'sold_offline' } });
    const { payment } = fake.pay(late.razorpay.orderId);
    expect((await webhook({ event: 'payment.captured', payload: { payment: { entity: payment } } })).body.result).toBe('refunded');
    // Being confirmed with the bank.
    const slow = await checkout(c, await saree());
    await prisma.paymentAttempt.updateMany({ where: { orderId: await idOf(slow.order.number) }, data: { status: 'confirming' } });
    await prisma.order.update({ where: { id: await idOf(slow.order.number) }, data: { placedAt: new Date(Date.now() + 1000) } });

    const r = await c.call('get', '/orders');
    const byNumber = Object.fromEntries(r.body.orders.map((o) => [o.number, o]));
    expect(byNumber[ended.order.number]).toBeUndefined();
    expect(byNumber[replaced.order.number]).toBeUndefined();
    expect(byNumber[p1.number]).toMatchObject({ status: 'paid', methodText: 'UPI', canBuyAgain: true, invoice: { ready: true }, shipping: null, oldWebsite: false });
    expect(byNumber[late.order.number]).toMatchObject({ status: 'refunded', refund: { amount: 5800 }, canBuyAgain: true });
    expect(byNumber[slow.order.number]).toMatchObject({ status: 'confirming', canBuyAgain: false });
    expect(r.body.orders.map((o) => o.number)).toEqual([slow.order.number, late.order.number, p1.number]);

    // A checkout whose sarees are held (7.9 A): shown, with Pay now's time.
    const held = await checkout(c, await saree());
    const again = await c.call('get', '/orders');
    expect(again.body.orders[0]).toMatchObject({ number: held.order.number, status: 'awaiting_payment', canBuyAgain: false });
    expect(Date.parse(again.body.orders[0].holdUntil)).toBeGreaterThan(Date.now());
  });

  it('each card: the first saree\'s name, up to 4 photos, how many more, pieces and sarees', async () => {
    const c = await customer();
    const five = [];
    for (let i = 0; i < 5; i++) five.push(await saree(col.plain));
    const o = await paid(c, ...five);
    const row = (await c.call('get', '/orders')).body.orders[0];
    expect(row).toMatchObject({ number: o.number, total: 13500, pieces: 5, sarees: 5, more: 1, title: col.plain.name });
    expect(row.photos).toHaveLength(4);
    expect(row.photos[0]).toMatch(/^https:\/\/example\.test\//); // the photo kept with the order
  });

  it('20 at a time, then Show more (nextOffset)', async () => {
    const c = await customer();
    const p = await saree();
    for (let i = 0; i < 22; i++) {
      await prisma.order.create({
        data: {
          orderNumber: `NH${String(crypto.randomInt(0, 1e8)).padStart(8, '0')}`, authAccountId: c.who.customer.id, channel: 'online', status: 'processing', subtotal: 5800, total: 5800,
          placedAt: new Date(Date.now() - (i + 1) * 3600_000), shippingAddress: { fullName: 'Priya', phone: '9876543210', line1: 'Flat 302', city: 'Hyderabad', state: 'Telangana', pincode: '500034', country: 'India' },
          items: { create: [{ productId: p.id, nameSnapshot: p.name, priceSnapshot: 5800, quantity: 1 }] },
          payment: { create: { razorpayOrderId: `order_pg${crypto.randomUUID().slice(0, 12)}`, status: 'paid', amount: 5800 } },
        },
      });
    }
    const first = await c.call('get', '/orders');
    expect(first.body.orders).toHaveLength(20);
    expect(first.body.nextOffset).toBe(20);
    const times = first.body.orders.map((o) => Date.parse(o.placedAt));
    expect(times).toEqual([...times].sort((a, b) => b - a));
    const second = await c.call('get', '/orders?offset=20');
    expect(second.body.orders).toHaveLength(2);
    expect(second.body.nextOffset).toBeNull();
    expect(new Set([...first.body.orders, ...second.body.orders].map((o) => o.number)).size).toBe(22);
    expect((await c.call('get', '/orders?offset=-1')).status).toBe(400);
  });

  it('only the customer\'s own orders (rule 1): another\'s number is "not found" everywhere', async () => {
    const a = await customer();
    const b = await customer();
    const o = await paid(a);
    expect((await b.call('get', '/orders')).body.orders).toEqual([]);
    for (const [m, path] of [['get', `/orders/${o.number}`], ['get', `/orders/${o.number}/invoice`], ['post', `/orders/${o.number}/buy-again`]]) {
      const r = await b.call(m, path);
      expect(r.status, path).toBe(404);
      expect(r.body.error.code).toBe('ORDER_NOT_FOUND');
    }
    expect((await b.call('get', '/orders/NH00000000')).body.error.code).toBe('ORDER_NOT_FOUND');
    expect((await b.call('get', '/orders/not-a-number')).status).toBe(400);
  });

  it('an order from the old website shows like any other, marked as such', async () => {
    const c = await customer();
    const old = await oldWebsiteOrder(c.who.customer.id, await saree());
    const row = (await c.call('get', '/orders')).body.orders.find((o) => o.number === old.orderNumber);
    expect(row).toMatchObject({ status: 'delivered', oldWebsite: true, methodText: 'Online', shipping: { carrier: 'DTDC' } });
    const one = (await c.call('get', `/orders/${old.orderNumber}`)).body.order;
    expect(one).toMatchObject({ status: 'delivered', oldWebsite: true, address: { fullName: 'Sada', city: 'Guntur' } });
  });
});

describe('one order: tracking, the address kept, nothing secret (rules 3, 4, 9)', () => {
  it('being packed, then shipped (courier, number, date, DTDC\'s page), then delivered (its date)', async () => {
    const c = await customer();
    const o = await paid(c);
    let r = (await c.call('get', `/orders/${o.number}`)).body.order;
    expect(r).toMatchObject({ status: 'paid', shipping: null, invoice: { number: expect.stringMatching(/^INV-\d{6}$/), ready: true, cancelled: false }, canBuyAgain: true });
    const tracking = await ship(o.number);
    r = (await c.call('get', `/orders/${o.number}`)).body.order;
    expect(r.status).toBe('shipped');
    expect(r.shipping).toMatchObject({ status: 'shipped', carrier: 'DTDC', trackingNumber: tracking, deliveredAt: null, trackingUrl: DTDC_TRACKING_URL });
    expect(Math.abs(Date.parse(r.shipping.shippedAt) - Date.now())).toBeLessThan(60_000);
    await delivered(o.number);
    r = (await c.call('get', `/orders/${o.number}`)).body.order;
    expect(r).toMatchObject({ status: 'delivered', shipping: { status: 'delivered', trackingNumber: tracking } });
    expect(Date.parse(r.shipping.deliveredAt)).toBeGreaterThan(Date.parse(r.shipping.shippedAt) - 1);
    // A corrected tracking number shows at once.
    const list = (await c.call('get', '/orders')).body.orders[0];
    expect(list).toMatchObject({ number: o.number, status: 'delivered', shipping: { trackingNumber: tracking } });
  });

  it('the address is the copy kept on the order: changing the saved one later changes nothing', async () => {
    const c = await customer();
    const o = await paid(c);
    await c.call('patch', `/me/addresses/${c.addressId}`).send({ line1: 'New House 9, Other Street', city: 'Vijayawada', state: 'Andhra Pradesh', pincode: '520010' });
    const r = (await c.call('get', `/orders/${o.number}`)).body.order;
    expect(r.address).toMatchObject({ line1: 'Flat 302, Sri Sai Residency', city: 'Hyderabad', state: 'Telangana', pincode: '500034' });
  });

  it('no payment signature, storage name, invoice address or internal id reaches the page', async () => {
    const c = await customer();
    const o = await paid(c);
    const db = await prisma.order.findUnique({ where: { orderNumber: o.number }, include: { payment: true, invoice: true } });
    for (const path of [`/orders/${o.number}`, '/orders']) {
      const text = JSON.stringify((await c.call('get', path)).body);
      for (const secret of [db.id, db.payment.razorpaySignature, db.payment.razorpayOrderId, db.payment.razorpayPaymentId, db.invoice.storageKey, db.invoice.url, db.authAccountId]) {
        expect(secret && text.includes(secret), `${path} must not show ${secret}`).toBe(false);
      }
      expect(text).not.toMatch(/storageKey|razorpaySignature|"url":"http:\/\/[^"]*\/invoices\//);
    }
  });

  it('cancelled by the shop after paying: "refund on its way", never "nothing was charged"; the owners\' refund in Razorpay shows when it goes through', async () => {
    const c = await customer();
    const o = await paid(c);
    const id = await idOf(o.number);
    expect((await O('post', `${OR}/${id}/cancel`).send({ reason: 'The saree was damaged while packing' })).status).toBe(200);
    let r = (await c.call('get', `/orders/${o.number}`)).body.order;
    expect(r).toMatchObject({ status: 'cancelled_paid', total: 5800, cancelled: { refundedAt: null }, payment: { methodText: 'UPI' }, invoice: { cancelled: true }, canBuyAgain: true });
    expect(Math.abs(Date.parse(r.cancelled.at) - Date.now())).toBeLessThan(60_000);
    expect(JSON.stringify(r)).not.toContain('damaged while packing'); // the shop's own note stays in the admin app
    expect((await c.call('get', '/orders')).body.orders.find((x) => x.number === o.number)).toMatchObject({ status: 'cancelled_paid' });
    // The owner refunds it in Razorpay's dashboard; Razorpay's notice arrives.
    const pay = (await prisma.payment.findUnique({ where: { orderId: id } })).razorpayPaymentId;
    const w = await webhook({ event: 'refund.processed', payload: { refund: { entity: { id: `rfnd_hand${T}`, payment_id: pay, amount: 580000, status: 'processed' } } } });
    expect(w.body.result).toBe('refund by hand processed');
    r = (await c.call('get', `/orders/${o.number}`)).body.order;
    expect(Math.abs(Date.parse(r.cancelled.refundedAt) - Date.now())).toBeLessThan(60_000);
    // A refund notice for a payment we don't know stays "unknown".
    expect((await webhook({ event: 'refund.processed', payload: { refund: { entity: { id: `rfnd_x${T}`, payment_id: 'pay_NotOursAtAll01', amount: 100 } } } })).body.result).toBe('unknown refund');
  });
});

describe('the invoice (7.6 A, rule 5)', () => {
  const download = (c, number) => c.call('get', `/orders/${number}/invoice`).buffer(true).parse((res, cb) => {
    const chunks = [];
    res.on('data', (d) => chunks.push(d));
    res.on('end', () => cb(null, Buffer.concat(chunks)));
  });

  it('a paid order\'s PDF, downloaded through our server: its number as the name, never cached', async () => {
    const c = await customer();
    const o = await paid(c);
    const r = await download(c, o.number);
    expect(r.status).toBe(200);
    expect(r.headers['content-type']).toBe('application/pdf');
    expect(r.headers['content-disposition']).toMatch(/^attachment; filename="INV-\d{6}\.pdf"$/);
    expect(r.headers['cache-control']).toBe('private, no-store');
    expect(r.body.subarray(0, 4).toString()).toBe('%PDF');
    const text = pdfText(r.body);
    expect(text).toContain(o.number);
    expect(text).toContain('Paid online (UPI)');
    expect(await prisma.authEvent.count({ where: { eventType: 'shop_invoice_downloaded', authAccountId: c.who.customer.id } })).toBe(1);
  });

  it('not made yet: "being made" (no broken link); not paid: no invoice', async () => {
    const c = await customer();
    const o = await paid(c);
    await prisma.invoice.deleteMany({ where: { order: { orderNumber: o.number } } });
    const r = await c.call('get', `/orders/${o.number}/invoice`);
    expect(r.status).toBe(409);
    expect(r.body.error.code).toBe('INVOICE_NOT_READY');
    expect((await c.call('get', `/orders/${o.number}`)).body.order.invoice).toEqual({ number: null, ready: false, cancelled: false });
    const held = await checkout(c, await saree());
    const u = await c.call('get', `/orders/${held.order.number}/invoice`);
    expect(u.status).toBe(404);
    expect(u.body.error.code).toBe('NO_INVOICE');
  });

  it('its stored file missing: drawn again from the records, the same number', async () => {
    const c = await customer();
    const o = await paid(c);
    const inv = await prisma.invoice.findFirst({ where: { order: { orderNumber: o.number } } });
    fs.unlinkSync(`${storage().root}/${inv.storageKey}`);
    const r = await download(c, o.number);
    expect(r.status).toBe(200);
    expect(pdfText(r.body)).toContain(inv.invoiceNumber);
  });

  it('cancelled after paying: the PDF stamped CANCELLED (drawn stamped if the stamp is missing)', async () => {
    const c = await customer();
    const o = await paid(c);
    const id = await idOf(o.number);
    await O('post', `${OR}/${id}/cancel`).send({ reason: 'Customer asked to cancel' });
    expect(pdfText((await download(c, o.number)).body)).toContain('CANCELLED');
    const inv = await prisma.invoice.findUnique({ where: { orderId: id } });
    await prisma.invoice.update({ where: { id: inv.id }, data: { storageKey: inv.storageKey.replace('invoices/cancelled/', 'invoices/') } });
    expect(pdfText((await download(c, o.number)).body)).toContain('CANCELLED');
  });
});

describe('Buy again (7.7 A, rule 6)', () => {
  it('puts the order\'s sarees back in the bag at today\'s price, and says which have sold since', async () => {
    const c = await customer();
    const keep = await saree(col.plain, 3);
    const gone = await saree();
    const o = await paid(c, keep, gone);
    await prisma.piece.updateMany({ where: { productId: gone.id, status: 'in_stock' }, data: { status: 'sold_offline' } }); // nothing left
    await prisma.subcategory.update({ where: { id: col.plain.id }, data: { onlinePrice: 2900 } });
    try {
      const r = await c.call('post', `/orders/${o.number}/buy-again`);
      expect(r.status).toBe(200);
      expect(r.body.buyAgain.added).toEqual([{ slug: keep.slug, name: col.plain.name, quantity: 1, fewer: false }]);
      expect(r.body.buyAgain.skipped).toEqual([{ slug: gone.slug, name: col.pure.name, reason: 'sold_out' }]);
      expect(r.body.items.find((l) => l.slug === keep.slug)).toMatchObject({ quantity: 1, price: 2900, priceWas: null, state: 'ok' });
      expect(r.body.totals).toMatchObject({ pieces: 1, amount: 2900 });
      expect((await c.call('get', '/me/bag')).body.items.map((l) => l.slug)).toContain(keep.slug);
    } finally {
      await prisma.subcategory.update({ where: { id: col.plain.id }, data: { onlinePrice: 2700 } });
    }
  });

  it('never more than in stock; a saree already in the bag keeps the larger number; off the website: skipped', async () => {
    const c = await customer();
    const set = await saree(col.plain, 4);
    const off = await saree();
    const o = await paid(c, set, off);
    await c.call('put', `/me/bag/items/${set.slug}`).send({ quantity: 1 });
    // The order had 1 of `set`; buy again raises nothing (the bag already has 1).
    let r = await c.call('post', `/orders/${o.number}/buy-again`);
    expect(r.body.buyAgain.already).toEqual([{ slug: set.slug, name: col.plain.name, quantity: 1 }]);
    await prisma.product.update({ where: { id: off.id }, data: { channelVisibility: 'store_only' } });
    await prisma.orderItem.updateMany({ where: { order: { orderNumber: o.number }, productId: set.id }, data: { quantity: 9 } }); // as if 9 were bought
    await c.call('delete', `/me/bag/items/${set.slug}`);
    r = await c.call('post', `/orders/${o.number}/buy-again`);
    expect(r.body.buyAgain.added).toEqual([{ slug: set.slug, name: col.plain.name, quantity: 3, fewer: true }]); // 3 left in stock
    expect(r.body.buyAgain.skipped).toEqual([{ slug: off.slug, name: col.pure.name, reason: 'unavailable' }]);
  });

  it('a full bag (20 sarees): what doesn\'t fit is said', async () => {
    const c = await customer();
    const o = await paid(c, await saree(col.pure, 2)); // one piece left after the order
    for (let i = 0; i < 20; i++) await put(c, await saree(col.plain));
    const r = await c.call('post', `/orders/${o.number}/buy-again`);
    expect(r.body.buyAgain.skipped).toEqual([expect.objectContaining({ reason: 'bag_full' })]);
    expect(r.body.items).toHaveLength(20);
  });

  it('not offered on an order still being paid for', async () => {
    const c = await customer();
    const held = await checkout(c, await saree());
    const r = await c.call('post', `/orders/${held.order.number}/buy-again`);
    expect(r.status).toBe(409);
    expect(r.body.error.code).toBe('CANT_BUY_AGAIN');
  });
});

describe('notices to the customer (7.8 A, rule 7)', () => {
  const token = () => `mo-${T}-${crypto.randomUUID()}-abcdefghijklmnopqrstuvwxyz0123456789`;

  it('shipped (with the tracking number) and delivered, once each, to the browsers with order updates on', async () => {
    const c = await customer();
    const t = token();
    expect((await c.call('post', '/push/subscribe').send({ token: t })).body.topics).toEqual(['orders']);
    const o = await paid(c);
    await noticesSettled();
    outbox.length = 0;
    const tracking = await ship(o.number);
    await noticesSettled();
    expect(outbox).toEqual([expect.objectContaining({ token: t, title: 'Your order has shipped', link: `/order/${o.number}`, tag: 'order_shipped' })]);
    expect(outbox[0].body).toContain(tracking);
    expect(outbox[0].body).toContain(o.number);
    await delivered(o.number);
    await delivered(o.number); // pressed twice: one notice
    await noticesSettled();
    expect(outbox.map((m) => m.title)).toEqual(['Your order has shipped', 'Your order was delivered']);
    const notes = await prisma.notification.findMany({ where: { authAccountId: c.who.customer.id, type: { in: ['order_shipped', 'order_delivered'] } }, orderBy: { createdAt: 'asc' } });
    expect(notes.map((x) => [x.type, x.status])).toEqual([['order_shipped', 'sent'], ['order_delivered', 'sent']]);
  });

  it('no browser with notifications: recorded, nothing sent; a WhatsApp order\'s customer is never told', async () => {
    const c = await customer();
    const o = await paid(c);
    await ship(o.number);
    await noticesSettled();
    expect((await prisma.notification.findFirst({ where: { authAccountId: c.who.customer.id, type: 'order_shipped' } })).status).toBe('no_device');

    const p = await saree();
    const piece = await prisma.piece.findFirst({ where: { productId: p.id } });
    const sale = await O('post', '/api/v2/sales').send({ clientRef: `w7-${crypto.randomUUID()}`, lines: [{ pieceId: piece.id, price: 5800, storePrice: 5800 }], channel: 'whatsapp', paymentMethod: 'upi', invoice: false, customer: { name: 'Padma', mobile: '9123456780', address: 'Flat 3B\nGuntur 522007' } });
    expect(sale.status, JSON.stringify(sale.body)).toBe(201);
    const before = await prisma.notification.count({ where: { type: 'order_shipped' } });
    outbox.length = 0;
    expect((await O('post', `${OR}/${sale.body.sale.id}/ship`).send({ awb: awb() })).status).toBe(200);
    await noticesSettled();
    expect(await prisma.notification.count({ where: { type: 'order_shipped' } })).toBe(before);
    expect(outbox).toEqual([]);
  });
});
