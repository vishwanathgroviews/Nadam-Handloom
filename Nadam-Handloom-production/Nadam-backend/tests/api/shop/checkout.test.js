// Website W6: checkout and payment (docs/modules/web-04-checkout.md), with the stand-in for
// Razorpay (PAYMENT_PROVIDER=fake): every rule in section 7 and every ending in section 8.
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { api, prisma, SHOP, signUp, as } from '../../support/shop.js';
import { signedIn, authed } from '../../support/helpers.js';
import * as fake from '../../../src/services/payments/fake.provider.js';
import { endExpiredHolds, checkPending, holdOf } from '../../../src/services/shop/checkout.service.js';
import { statusOf } from '../../../src/services/onlinePayments.service.js';
import { hmac } from '../../../src/services/payments/signature.js';
import { renderInvoicePdf } from '../../../src/services/invoicePdf.service.js';
import { storage } from '../../../src/services/storage/index.js';
import { env } from '../../../src/config/env.js';
import { pdfText } from '../../support/pdf.js';

// The settings are frozen; this file gets a copy it can switch (payments off, IGST on).
vi.mock('../../../src/config/env.js', async (importOriginal) => {
  const mod = await importOriginal();
  return { ...mod, env: { ...mod.env, payments: { ...mod.env.payments }, company: { ...mod.env.company } } };
});

const T = String(crypto.randomInt(10_000_000, 99_999_999));
const MIN = 60_000;
let cat;
const col = {};
const p = {};
let n = 0;

async function saree(key, collection, pieces = 1) {
  n += 1;
  const row = await prisma.product.create({
    data: {
      slug: `co-${T}-${key}`, sku: `NH-C${T}-${key}`.toUpperCase(), name: collection.name, categoryId: cat.id, subcategoryId: collection.id,
      channelVisibility: 'both', trackingMode: 'serialized', createdAt: new Date(Date.now() - n * 1000),
      images: { create: [{ url: `https://example.test/${T}-${key}.jpg`, sortOrder: 0 }] },
      pieces: { create: Array.from({ length: pieces }, (_, i) => ({ barcode: `C${T}${key}${i}`.toUpperCase(), status: 'in_stock' })) },
    },
  });
  p[key] = row;
  return row;
}
// A new single-piece saree for one test (tests don't share stock).
let k = 0;
const fresh = async (collection = col.pure, pieces = 1) => saree(`f${(k += 1)}`, collection, pieces);

const ADDRESS = { label: 'home', fullName: 'Priya Sharma', mobile: '9876543210', line1: 'Flat 302, Sri Sai Residency', line2: 'Road No. 12, Banjara Hills', landmark: 'Near the water tank', pincode: '500034', city: 'Hyderabad', state: 'Telangana' };

async function customer(address = ADDRESS) {
  const who = await signUp();
  const call = as(who);
  const a = await call('post', '/me/addresses').send(address);
  if (a.status !== 201) throw new Error(`address: ${a.status} ${JSON.stringify(a.body)}`);
  return { who, call, addressId: a.body.address.id };
}
const put = (c, product, quantity = 1) => c.call('put', `/me/bag/items/${product.slug}`).send({ quantity });
const expectOf = (bagBody) => ({ amount: bagBody.totals.amount, lines: bagBody.items.filter((l) => l.quantity > 0).map((l) => ({ slug: l.slug, quantity: l.quantity, price: l.price })) });
async function pay(c, over = {}) {
  const bag = await c.call('get', '/me/bag');
  return c.call('post', '/checkout').send({ addressId: c.addressId, expect: expectOf(bag.body), ...over });
}
const verify = (c, number, receipt) => c.call('post', `/orders/${number}/verify`).send({ razorpayOrderId: receipt.razorpay_order_id, razorpayPaymentId: receipt.razorpay_payment_id, razorpaySignature: receipt.razorpay_signature });
const dbOrder = (number) => prisma.order.findUnique({ where: { orderNumber: number }, include: { items: true, reservations: true, payment: true, attempts: true, invoice: true, shipment: true } });
const pieceStatus = async (product) => (await prisma.piece.findMany({ where: { productId: product.id }, orderBy: { barcode: 'asc' } })).map((x) => x.status);

function webhook(event, { secret = 'test_webhook_secret_0123456789abcdef', eventId = crypto.randomUUID(), raw } = {}) {
  const body = raw ?? JSON.stringify(event);
  return api().post('/api/v2/payments/razorpay/webhook').set('content-type', 'application/json').set('x-razorpay-signature', hmac(Buffer.from(body), secret)).set('x-razorpay-event-id', eventId).send(body);
}
const captured = (payment) => ({ event: 'payment.captured', payload: { payment: { entity: payment } } });

beforeAll(async () => {
  cat = await prisma.category.create({ data: { name: `CHECKOUT TEST ${T}`, slug: `checkout-test-${T}`, description: 'Checkout test sarees', sortOrder: 997 } });
  const sub = (name, price) => prisma.subcategory.create({ data: { categoryId: cat.id, name, description: 'Pure handloom', onlinePrice: price, storePrice: price, mrp: 16999 } });
  col.pure = await sub(`Pure Pattu Butta ${T}`, 5800);
  col.plain = await sub(`Plain Saree ${T}`, 2700);
});
beforeEach(() => fake.reset());

describe('the website learns payments are on', () => {
  it('/config says so, with the 15-minute hold and the GST settings', async () => {
    const r = await api().get(`${SHOP}/config`);
    expect(r.body.payments).toEqual({ enabled: true, testersOnly: false, holdMinutes: 15, mode: 'test', maxAmount: 500000 });
    expect(r.body.gst).toEqual({ ratePercent: 5, shopState: 'Andhra Pradesh', igstOtherStates: false });
  });

  it('switched off (PAYMENTS_ENABLED=false): /config says so and Pay is refused, nothing held', async () => {
    const c = await customer();
    const one = await fresh();
    await put(c, one);
    env.payments.enabled = false;
    try {
      expect((await api().get(`${SHOP}/config`)).body.payments.enabled).toBe(false);
      const r = await pay(c);
      expect(r.status).toBe(503);
      expect(r.body.error.code).toBe('PAYMENTS_OFF');
      expect(await pieceStatus(one)).toEqual(['in_stock']);
    } finally {
      env.payments.enabled = true;
    }
  });
});

describe('payments tried on the live website first (PAYMENTS_TESTERS)', () => {
  it('only the listed customers see Checkout and may pay; everyone else orders on WhatsApp as before', async () => {
    const tester = await customer();
    const other = await customer();
    const one = await fresh();
    const two = await fresh();
    await put(tester, one);
    await put(other, two);
    env.payments.testers = [tester.who.mobile];
    try {
      expect((await api().get(`${SHOP}/config`)).body.payments).toMatchObject({ enabled: true, testersOnly: true });
      expect((await tester.call('get', '/me')).body.customer.payOnline).toBe(true);
      expect((await other.call('get', '/me')).body.customer.payOnline).toBe(false);
      const refused = await pay(other);
      expect(refused.status).toBe(503);
      expect(refused.body.error.code).toBe('PAYMENTS_OFF');
      expect(await pieceStatus(two)).toEqual(['in_stock']); // nothing held
      const ok = await pay(tester);
      expect(ok.status).toBe(200);
      expect(await pieceStatus(one)).toEqual(['reserved']);
      // A tester taken off the list can't pay again either.
      env.payments.testers = ['9000000099'];
      expect((await tester.call('post', `/orders/${ok.body.order.number}/pay`)).body.error.code).toBe('PAYMENTS_OFF');
    } finally {
      env.payments.testers = [];
    }
    expect((await api().get(`${SHOP}/config`)).body.payments.testersOnly).toBe(false);
    expect((await other.call('get', '/me')).body.customer.payOnline).toBe(true);
  });

  it('the live server refuses to start with test keys unless only listed customers can pay', () => {
    const start = (extra) => spawnSync(process.execPath, ['-e', "import('./src/config/env.js').then(() => console.log('started'))"], {
      encoding: 'utf8',
      env: { ...process.env, NODE_ENV: 'production', PAYMENTS_ENABLED: 'true', PAYMENT_PROVIDER: 'razorpay', RAZORPAY_KEY_ID: 'rzp_test_AbCdEf123456', RAZORPAY_KEY_SECRET: 'x'.repeat(24), PAYMENTS_ALLOW_TEST_KEYS_IN_PRODUCTION: 'true', ...extra },
    });
    const without = start({ PAYMENTS_TESTERS: '' });
    expect(without.stderr).toContain('need PAYMENTS_TESTERS');
    expect(without.status).toBe(1);
    expect(start({ PAYMENTS_TESTERS: '98765 43210' }).stderr).toContain('must be a 10-digit Indian mobile number');
    expect(start({ PAYMENTS_TESTERS: '9876543210,9123456780' }).stderr).not.toMatch(/PAYMENTS_TESTERS/);
    // Open to every visitor only when the owner says so (the website shows "Test payment").
    expect(start({ PAYMENTS_TESTERS: '', PAYMENTS_TEST_FOR_EVERYONE: 'true' }).stderr).not.toMatch(/PAYMENTS_TESTERS/);
    expect(start({ PAYMENTS_TESTERS: '', PAYMENTS_TEST_FOR_EVERYONE: 'false' }).status).toBe(1);
    // A blank line copied from .env.example (KEY=) counts as not set: never a refusal to start.
    expect(start({ PAYMENTS_TESTERS: '9876543210', RAZORPAY_WEBHOOK_SECRET: '', PUSH_PROVIDER: '', APNS_KEY_ID: '' }).stderr).not.toMatch(/RAZORPAY_WEBHOOK_SECRET|PUSH_PROVIDER|APNS/);
  });
});

describe('Pay: an order, the sarees held, a payment request', () => {
  it('needs a sign-in', async () => {
    const r = await api().post(`${SHOP}/checkout`).send({});
    expect(r.status).toBe(401);
  });

  it('makes the order from the bag, holds every saree for 15 minutes and asks Razorpay for the exact total', async () => {
    const c = await customer();
    const one = await fresh();
    const set = await fresh(col.plain, 3);
    await put(c, one);
    await put(c, set, 2);
    const r = await pay(c);
    expect(r.status).toBe(200);
    expect(r.headers['cache-control']).toBe('no-store');
    const { order, razorpay } = r.body;
    expect(order).toMatchObject({ status: 'awaiting_payment', total: 11200, pieces: 3, canPay: true, payment: null });
    expect(order.number).toMatch(/^NH\d{8}$/);
    expect(order.lines).toEqual(expect.arrayContaining([
      expect.objectContaining({ slug: one.slug, quantity: 1, price: 5800, lineTotal: 5800 }),
      expect.objectContaining({ slug: set.slug, quantity: 2, price: 2700, lineTotal: 5400 }),
    ]));
    expect(order.address).toMatchObject({ fullName: 'Priya Sharma', mobile: '9876543210', landmark: 'Near the water tank', state: 'Telangana' });
    expect(Math.abs(Date.parse(order.holdUntil) - (Date.now() + 15 * MIN))).toBeLessThan(10_000);
    expect(razorpay).toMatchObject({ keyId: 'rzp_test_fakeprovider01', amount: 1120000, currency: 'INR', name: 'Nandam Handlooms', description: `Order ${order.number}`, prefill: { name: 'Priya Sharma', contact: `+91${c.who.mobile}` } });
    expect(razorpay.timeoutSeconds).toBeGreaterThan(14 * 60);
    expect(razorpay.orderId).toMatch(/^order_/);
    expect(fake.order(razorpay.orderId)).toMatchObject({ amount: 1120000, receipt: order.number, captureMinutes: 15, notes: { orderNumber: order.number } });

    const o = await dbOrder(order.number);
    expect(o).toMatchObject({ channel: 'online', status: 'pending_payment', authAccountId: c.who.customer.id });
    expect(o.shippingAddress).toMatchObject({ fullName: 'Priya Sharma', phone: '9876543210', landmark: 'Near the water tank', state: 'Telangana', country: 'India' });
    expect(o.items).toHaveLength(3); // one line per piece
    expect(o.items.every((i) => i.pieceId && i.quantity === 1)).toBe(true);
    expect(o.reservations.map((x) => x.status)).toEqual(['active', 'active', 'active']);
    expect(await pieceStatus(one)).toEqual(['reserved']);
    expect((await pieceStatus(set)).sort()).toEqual(['in_stock', 'reserved', 'reserved']);
    expect(o.payment).toMatchObject({ status: 'created', razorpayOrderId: razorpay.orderId });
    expect(o.attempts).toHaveLength(1);
    expect(await prisma.stockLedger.count({ where: { ref: order.number, reason: 'reserve' } })).toBe(3);
  });

  it('something changed since the page showed it: no order, the bag now, and Pay works after', async () => {
    const c = await customer();
    const one = await fresh();
    await put(c, one);
    const bag = await c.call('get', '/me/bag');
    const stale = expectOf(bag.body);
    stale.amount = 5000;
    stale.lines[0].price = 5000;
    let r = await c.call('post', '/checkout').send({ addressId: c.addressId, expect: stale });
    expect(r.status).toBe(409);
    expect(r.body.error.code).toBe('BAG_CHANGED');
    expect(r.body.error.details.bag.items[0]).toMatchObject({ slug: one.slug, price: 5800 });
    expect(await pieceStatus(one)).toEqual(['in_stock']);
    r = await pay(c);
    expect(r.status).toBe(200);
  });

  it('an empty bag, an address of someone else, an old address with a broken state', async () => {
    const c = await customer();
    let r = await c.call('post', '/checkout').send({ addressId: c.addressId, expect: { amount: 100, lines: [{ slug: 'x-1', quantity: 1, price: 100 }] } });
    expect(r.body.error.code).toBe('BAG_EMPTY');
    const other = await customer();
    await put(c, await fresh());
    r = await pay(c, { addressId: other.addressId });
    expect(r.status).toBe(404);
    expect(r.body.error.code).toBe('ADDRESS_NOT_FOUND');
    const old = await prisma.address.create({ data: { authAccountId: c.who.customer.id, fullName: 'Priya', phone: '9876543210', line1: 'Main road', city: 'Mangalagiri', state: 'Ap', pincode: '522503' } });
    r = await pay(c, { addressId: old.id });
    expect(r.status).toBe(400);
    expect(r.body.error).toMatchObject({ code: 'ADDRESS_INVALID', details: { field: 'state' } });
    // The address list says so too, so the checkout page asks before Pay.
    const list = await c.call('get', '/me/addresses');
    expect(list.body.addresses.find((x) => x.id === old.id).problem).toEqual({ field: 'state', message: 'Choose the state.' });
    expect(list.body.addresses.find((x) => x.id === c.addressId).problem).toBeNull();
  });

  it('pressing Pay again with the same bag reuses the order and its hold, with a fresh payment request', async () => {
    const c = await customer();
    await put(c, await fresh());
    const a = await pay(c);
    const b = await pay(c);
    expect(b.body.order.number).toBe(a.body.order.number);
    expect(b.body.razorpay.orderId).not.toBe(a.body.razorpay.orderId);
    const o = await dbOrder(a.body.order.number);
    expect(o.attempts).toHaveLength(2);
    expect(o.payment.razorpayOrderId).toBe(b.body.razorpay.orderId);
    expect(o.reservations).toHaveLength(1);
  });

  it('while paying, the sarees held are still the customer\'s in their bag (sold out to everyone else)', async () => {
    const c = await customer();
    const one = await fresh();
    await put(c, one);
    await pay(c);
    const mine = await c.call('get', '/me/bag');
    expect(mine.body.items[0]).toMatchObject({ slug: one.slug, state: 'ok', quantity: 1, available: 1 });
    expect((await put(c, one, 1)).status).toBe(200);
    const other = await customer();
    expect((await put(other, one)).body.error.code).toBe('SOLD_OUT');
  });

  it('no secret ever reaches the page: only the public key id', async () => {
    const c = await customer();
    await put(c, await fresh());
    const r = await pay(c);
    expect(Object.keys(r.body.razorpay).sort()).toEqual(['amount', 'currency', 'description', 'keyId', 'mode', 'name', 'notes', 'orderId', 'prefill', 'timeoutSeconds']);
    const g = await c.call('get', `/orders/${r.body.order.number}`);
    expect(g.headers['cache-control']).toBe('no-store');
    for (const text of [JSON.stringify(r.body), JSON.stringify(g.body)]) {
      expect(text).not.toContain(env.payments.keySecret);
      expect(text).not.toContain(env.payments.webhookSecret);
      expect(text).not.toMatch(/signature|reservation|authAccountId/i);
    }
  });

  it('a changed bag ends the earlier checkout (its sarees back on sale) and starts a new one', async () => {
    const c = await customer();
    const first = await fresh();
    await put(c, first);
    const a = await pay(c);
    await put(c, await fresh());
    const b = await pay(c);
    expect(b.body.order.number).not.toBe(a.body.order.number);
    const old = await dbOrder(a.body.order.number);
    expect(old).toMatchObject({ status: 'cancelled', cancelReason: 'Replaced by a newer checkout' });
    expect(old.reservations.map((x) => x.status)).toEqual(['released']);
    expect((await dbOrder(b.body.order.number)).items).toHaveLength(2);
  });

  it('two taps on Pay at the same moment make one order', async () => {
    const c = await customer();
    await put(c, await fresh());
    const bag = await c.call('get', '/me/bag');
    const body = { addressId: c.addressId, expect: expectOf(bag.body) };
    const [x, y] = await Promise.all([c.call('post', '/checkout').send(body), c.call('post', '/checkout').send(body)]);
    expect([x.status, y.status]).toEqual([200, 200]);
    expect(x.body.order.number).toBe(y.body.order.number);
  });

  it('two customers and the last piece: one order; the other sees it gone', async () => {
    const last = await fresh();
    const c1 = await customer();
    const c2 = await customer();
    await put(c1, last);
    await put(c2, last);
    const [r1, r2] = await Promise.all([pay(c1), pay(c2)]);
    expect([r1.status, r2.status].sort()).toEqual([200, 409]);
    expect([r1, r2].find((r) => r.status === 409).body.error.code).toBe('BAG_CHANGED');
  });

  it('Razorpay can\'t be reached: nothing kept, the sarees back on sale', async () => {
    const c = await customer();
    const one = await fresh();
    await put(c, one);
    fake.failNextCall('createOrder');
    const r = await pay(c);
    expect(r.status).toBe(503);
    expect(r.body.error.code).toBe('PAYMENTS_UNAVAILABLE');
    expect(await pieceStatus(one)).toEqual(['in_stock']);
  });
});

describe('the payment', () => {
  it('paid: sold online, To ship in the admin app, invoice, out of the bag; checking again changes nothing', async () => {
    const c = await customer();
    const one = await fresh();
    await put(c, one);
    const { body } = await pay(c);
    const { receipt } = fake.pay(body.razorpay.orderId, { method: 'upi' });
    let r = await verify(c, body.order.number, receipt);
    expect(r.status).toBe(200);
    expect(r.body.order).toMatchObject({ status: 'paid', payment: { method: 'upi', methodText: 'UPI' }, canPay: false, holdUntil: null });
    expect(JSON.stringify(r.body)).not.toMatch(/signature/i);
    const o = await dbOrder(body.order.number);
    expect(o).toMatchObject({ status: 'processing', paymentMethod: 'upi' });
    expect(o.payment).toMatchObject({ status: 'paid', method: 'upi', razorpayPaymentId: receipt.razorpay_payment_id });
    expect(o.attempts[0]).toMatchObject({ status: 'paid' });
    expect(o.reservations.map((x) => x.status)).toEqual(['converted']);
    expect(o.shipment).toMatchObject({ status: 'not_shipped' });
    expect(o.invoice.invoiceNumber).toMatch(/^INV-\d{6}$/);
    expect(Number(o.invoice.igstAmount)).toBe(0);
    expect(o.invoice.placeOfSupply).toBe('Telangana');
    expect(await pieceStatus(one)).toEqual(['sold_online']);
    expect((await c.call('get', '/me/bag')).body.items).toEqual([]);
    // Again (the page and Razorpay's notice): nothing doubles.
    r = await verify(c, body.order.number, receipt);
    expect(r.body.order.status).toBe('paid');
    expect(await prisma.stockLedger.count({ where: { ref: body.order.number, reason: 'online_sale' } })).toBe(1);
    // The admin app: To ship, paid online by UPI, the landmark in the address.
    const { session, device } = await signedIn({ role: 'ADMIN' });
    const list = await authed('get', `/api/v2/orders?q=${body.order.number}`, session, device);
    const row = list.body.orders.find((x) => x.orderNumber === body.order.number);
    expect(row).toBeTruthy();
    const d = await authed('get', `/api/v2/orders/${row.id}`, session, device);
    expect(d.body.order.payment).toEqual({ text: 'Paid online (Razorpay) · UPI', paid: true });
    expect(d.body.order.customer.lines).toContain('Near the water tank');
    expect(d.body.actions.ship).toBe(true);
  });

  it('a receipt with a wrong signature changes nothing', async () => {
    const c = await customer();
    await put(c, await fresh());
    const { body } = await pay(c);
    const { receipt } = fake.pay(body.razorpay.orderId);
    const r = await verify(c, body.order.number, { ...receipt, razorpay_signature: 'a'.repeat(64) });
    expect(r.status).toBe(400);
    expect(r.body.error.code).toBe('PAYMENT_NOT_VERIFIED');
    expect((await dbOrder(body.order.number)).status).toBe('pending_payment');
  });

  it('a receipt for another payment request, or someone else\'s order, is refused', async () => {
    const c = await customer();
    await put(c, await fresh());
    const { body } = await pay(c);
    const { receipt } = fake.pay(body.razorpay.orderId);
    const r = await verify(c, body.order.number, { ...receipt, razorpay_order_id: 'order_SomethingElse1' });
    expect(r.body.error.code).toBe('PAYMENT_NOT_FOUND');
    const other = await customer();
    expect((await verify(other, body.order.number, receipt)).status).toBe(404);
    expect((await other.call('get', `/orders/${body.order.number}`)).status).toBe(404);
  });

  it('a different amount is never accepted: refunded, the sarees back on sale', async () => {
    const c = await customer();
    const one = await fresh();
    await put(c, one);
    const { body } = await pay(c);
    const { receipt } = fake.pay(body.razorpay.orderId, { amount: 100 });
    const r = await verify(c, body.order.number, receipt);
    expect(r.body.order).toMatchObject({ status: 'refunded', refund: { amount: 5800 } });
    const o = await dbOrder(body.order.number);
    expect(o.status).toBe('cancelled');
    expect(o.attempts[0]).toMatchObject({ status: 'refunded', refundReason: 'The amount paid didn\'t match the order' });
    expect(await pieceStatus(one)).toEqual(['in_stock']);
  });

  it('a failed payment: nothing taken, the sarees still held, Pay again works', async () => {
    const c = await customer();
    const one = await fresh();
    await put(c, one);
    const { body } = await pay(c);
    const { receipt } = fake.pay(body.razorpay.orderId, { status: 'failed' });
    const r = await verify(c, body.order.number, receipt);
    expect(r.body.order).toMatchObject({ status: 'awaiting_payment', canPay: true });
    expect((await dbOrder(body.order.number)).attempts[0]).toMatchObject({ status: 'failed', failureReason: 'Your bank declined the payment' });
    expect(await pieceStatus(one)).toEqual(['reserved']);
    const again = await c.call('post', `/orders/${body.order.number}/pay`);
    expect(again.status).toBe(200);
    expect(again.body.razorpay.orderId).not.toBe(body.razorpay.orderId);
  });

  it('Razorpay can\'t be asked at that moment: "confirming", then the background check completes it', async () => {
    const c = await customer();
    await put(c, await fresh());
    const { body } = await pay(c);
    const { receipt } = fake.pay(body.razorpay.orderId);
    fake.failNextCall('fetchPayment');
    let r = await verify(c, body.order.number, receipt);
    expect(r.body.order.status).toBe('confirming');
    await checkPending();
    r = await c.call('get', `/orders/${body.order.number}`);
    expect(r.body.order.status).toBe('paid');
  });

  it('authorised but not yet taken while the sarees are held: taken now', async () => {
    const c = await customer();
    await put(c, await fresh());
    const { body } = await pay(c);
    const { receipt } = fake.pay(body.razorpay.orderId, { status: 'authorized' });
    const r = await verify(c, body.order.number, receipt);
    expect(r.body.order.status).toBe('paid');
  });
});

describe('payments the page never reported', () => {
  it('a payment request whose time is up is looked at once: a payment found completes the order', async () => {
    const c = await customer();
    await put(c, await fresh());
    const { body } = await pay(c);
    fake.pay(body.razorpay.orderId); // paid, but the page and the notice never arrived
    await prisma.paymentAttempt.updateMany({ where: { razorpayOrderId: body.razorpay.orderId }, data: { createdAt: new Date(Date.now() - 15 * MIN) } });
    await checkPending();
    expect((await c.call('get', `/orders/${body.order.number}`)).body.order.status).toBe('paid');
    const att = (await dbOrder(body.order.number)).attempts[0];
    expect(att.lastCheckedAt).not.toBeNull();
  });

  it('an invoice that couldn\'t be made at payment is made by the background check', async () => {
    const c = await customer();
    await put(c, await fresh());
    const { body } = await pay(c);
    await verify(c, body.order.number, fake.pay(body.razorpay.orderId).receipt);
    const o = await dbOrder(body.order.number);
    await prisma.invoice.delete({ where: { id: o.invoice.id } });
    await checkPending();
    expect((await dbOrder(body.order.number)).invoice?.invoiceNumber).toMatch(/^INV-\d{6}$/);
  });

  it('a second payment on the request that already paid: refunded, the paid record untouched', async () => {
    const c = await customer();
    await put(c, await fresh());
    const { body } = await pay(c);
    const first = fake.pay(body.razorpay.orderId);
    await verify(c, body.order.number, first.receipt);
    const second = fake.pay(body.razorpay.orderId);
    expect((await webhook(captured(second.payment))).body.result).toBe('refunded');
    const o = await dbOrder(body.order.number);
    expect(o.status).toBe('processing');
    expect(o.attempts[0]).toMatchObject({ status: 'paid', razorpayPaymentId: first.receipt.razorpay_payment_id });
    expect(o.payment.razorpayPaymentId).toBe(first.receipt.razorpay_payment_id);
    expect((await fake.fetchPayment(second.payment.id)).status).toBe('refunded');
  });
});

describe('the 15-minute hold', () => {
  it('ends by itself: sarees back on sale, the order still waiting (Unpaid checkouts), Pay again refused', async () => {
    const c = await customer();
    const one = await fresh();
    await put(c, one);
    const { body } = await pay(c);
    await prisma.reservation.updateMany({ where: { order: { orderNumber: body.order.number } }, data: { expiresAt: new Date(Date.now() - 1000) } });
    expect(await endExpiredHolds()).toBeGreaterThanOrEqual(1);
    const o = await dbOrder(body.order.number);
    expect(o.status).toBe('pending_payment');
    expect(o.reservations.map((x) => x.status)).toEqual(['expired']);
    expect(await pieceStatus(one)).toEqual(['in_stock']);
    expect((await c.call('get', `/orders/${body.order.number}`)).body.order.status).toBe('hold_ended');
    const again = await c.call('post', `/orders/${body.order.number}/pay`);
    expect(again.body.error.code).toBe('HOLD_ENDED');
    expect(await endExpiredHolds()).toBe(0); // nothing twice
  });

  it('Pay again renews it, but never past 30 minutes from the first Pay', async () => {
    const c = await customer();
    await put(c, await fresh());
    const { body } = await pay(c);
    const o = await dbOrder(body.order.number);
    await prisma.order.update({ where: { id: o.id }, data: { placedAt: new Date(Date.now() - 20 * MIN) } });
    let r = await c.call('post', `/orders/${body.order.number}/pay`);
    expect(r.status).toBe(200);
    expect(Math.abs(Date.parse(r.body.order.holdUntil) - (Date.now() + 10 * MIN))).toBeLessThan(10_000); // capped at 30
    await prisma.order.update({ where: { id: o.id }, data: { placedAt: new Date(Date.now() - 29.5 * MIN) } });
    r = await c.call('post', `/orders/${body.order.number}/pay`);
    expect(r.body.error.code).toBe('HOLD_ENDED');
  });

  it('"Change my bag": the checkout ends and its sarees go back on sale', async () => {
    const c = await customer();
    const one = await fresh();
    await put(c, one);
    const { body } = await pay(c);
    const r = await c.call('post', `/orders/${body.order.number}/cancel`);
    expect(r.body.order.status).toBe('cancelled');
    expect(await pieceStatus(one)).toEqual(['in_stock']);
    expect((await dbOrder(body.order.number)).cancelReason).toBe('The customer went back to change the bag');
  });
});

describe('late payments (rule 7.6)', () => {
  it('after the hold ended, every saree still there: the order goes through', async () => {
    const c = await customer();
    const one = await fresh();
    await put(c, one);
    const { body } = await pay(c);
    await prisma.reservation.updateMany({ where: { order: { orderNumber: body.order.number } }, data: { expiresAt: new Date(Date.now() - 1000) } });
    await endExpiredHolds();
    const { receipt } = fake.pay(body.razorpay.orderId);
    const r = await verify(c, body.order.number, receipt);
    expect(r.body.order.status).toBe('paid');
    expect(await pieceStatus(one)).toEqual(['sold_online']);
    expect(await prisma.stockLedger.findFirst({ where: { ref: body.order.number, reason: 'online_sale' } })).toMatchObject({ delta: -1 });
  });

  it('after the hold ended, a saree sold at the counter meanwhile: refunded in full, never sold twice', async () => {
    const c = await customer();
    const one = await fresh();
    await put(c, one);
    const { body } = await pay(c);
    await prisma.reservation.updateMany({ where: { order: { orderNumber: body.order.number } }, data: { expiresAt: new Date(Date.now() - 1000) } });
    await endExpiredHolds();
    await prisma.piece.updateMany({ where: { productId: one.id }, data: { status: 'sold_offline' } });
    const { receipt } = fake.pay(body.razorpay.orderId);
    const r = await verify(c, body.order.number, receipt);
    expect(r.body.order).toMatchObject({ status: 'refunded', refund: { amount: 5800, status: 'processed', reason: 'Paid after the sarees were sold' } });
    const o = await dbOrder(body.order.number);
    expect(o).toMatchObject({ status: 'cancelled', cancelReason: 'Paid after the sarees were sold; refunded' });
    expect(o.payment.status).not.toBe('paid');
    expect(o.attempts[0].refundId).toMatch(/^rfnd_/);
    expect(await pieceStatus(one)).toEqual(['sold_offline']);
  });

  it('a checkout cancelled by an owner\'s "Sell anyway" at the counter, then paid: refunded (the old server\'s bug)', async () => {
    const c = await customer();
    const one = await fresh();
    await put(c, one);
    const { body } = await pay(c);
    const o = await dbOrder(body.order.number);
    await prisma.$transaction([
      prisma.reservation.updateMany({ where: { orderId: o.id }, data: { status: 'released' } }),
      prisma.piece.updateMany({ where: { productId: one.id }, data: { status: 'sold_offline' } }),
      prisma.order.update({ where: { id: o.id }, data: { status: 'cancelled', cancelledAt: new Date(), cancelReason: 'Sold at the counter (order NH00000001)' } }),
    ]);
    const { payment } = fake.pay(body.razorpay.orderId);
    const w = await webhook(captured(payment));
    expect(w.status).toBe(200);
    expect(w.body.result).toBe('refunded');
    const after = await dbOrder(body.order.number);
    expect(after.status).toBe('cancelled');
    expect(after.attempts[0].status).toBe('refunded');
  });

  it('a refund that can\'t be started is tried again', async () => {
    const c = await customer();
    await put(c, await fresh());
    const { body } = await pay(c);
    fake.failNextCall('refundPayment');
    const { receipt } = fake.pay(body.razorpay.orderId, { amount: 1 });
    await verify(c, body.order.number, receipt);
    expect((await dbOrder(body.order.number)).attempts[0].status).toBe('refund_due');
    await checkPending(new Date(Date.now() + 2 * MIN)); // tried again after a minute
    expect((await dbOrder(body.order.number)).attempts[0].status).toBe('refunded');
  });

  it('a second payment on an older request after the order was paid: that one is refunded', async () => {
    const c = await customer();
    await put(c, await fresh());
    const a = await pay(c);
    const b = await pay(c); // same order, a newer request
    const paid = fake.pay(b.body.razorpay.orderId);
    await verify(c, b.body.order.number, paid.receipt);
    const late = fake.pay(a.body.razorpay.orderId);
    const w = await webhook(captured(late.payment));
    expect(w.body.result).toBe('refunded');
    const o = await dbOrder(a.body.order.number);
    expect(o.status).toBe('processing');
    expect(o.payment.razorpayPaymentId).toBe(paid.receipt.razorpay_payment_id);
    expect(o.attempts.find((x) => x.razorpayOrderId === a.body.razorpay.orderId)).toMatchObject({ status: 'refunded', refundReason: 'Paid twice: this order was already paid' });
  });
});

describe('Razorpay\'s notices (webhook)', () => {
  it('a payment the page never confirmed (phone lost the connection) completes the order', async () => {
    const c = await customer();
    await put(c, await fresh());
    const { body } = await pay(c);
    const { payment } = fake.pay(body.razorpay.orderId);
    const w = await webhook(captured(payment));
    expect(w.status).toBe(200);
    expect(w.body).toEqual({ ok: true, result: 'paid' });
    expect((await c.call('get', `/orders/${body.order.number}`)).body.order.status).toBe('paid');
  });

  it('the same notice twice is handled once; checked on the exact bytes; a wrong signature is refused', async () => {
    const c = await customer();
    await put(c, await fresh());
    const { body } = await pay(c);
    const { payment } = fake.pay(body.razorpay.orderId);
    const eventId = `evt_${T}${k}`;
    const raw = `{ "event": "payment.captured",  "payload": {"payment": {"entity": ${JSON.stringify(payment)}}} }`;
    expect((await webhook(null, { raw, eventId })).body.result).toBe('paid');
    expect((await webhook(null, { raw, eventId })).body).toEqual({ ok: true, duplicate: true });
    const bad = await api().post('/api/v2/payments/razorpay/webhook').set('content-type', 'application/json').set('x-razorpay-signature', hmac(Buffer.from(JSON.parse(JSON.stringify(raw))), 'wrong-secret-0000000000')).send(raw);
    expect(bad.status).toBe(401);
    const reformatted = await api().post('/api/v2/payments/razorpay/webhook').set('content-type', 'application/json').set('x-razorpay-signature', hmac(Buffer.from(raw), 'test_webhook_secret_0123456789abcdef')).send(JSON.stringify(JSON.parse(raw)));
    expect(reformatted.status).toBe(401);
  });

  it('payment failed, refund processed, an unknown request, another event', async () => {
    const c = await customer();
    await put(c, await fresh());
    const { body } = await pay(c);
    const { payment } = fake.pay(body.razorpay.orderId, { status: 'failed' });
    expect((await webhook({ event: 'payment.failed', payload: { payment: { entity: payment } } })).body.result).toBe('failed');
    expect((await webhook(captured({ ...payment, order_id: 'order_NotOursAtAll1', status: 'captured' }))).body.result).toBe('unknown order');
    expect((await webhook({ event: 'payment.downtime.started', payload: {} })).body.result).toBe('ignored');
    // A refund we started, then Razorpay's notice that it's done.
    const late = fake.pay(body.razorpay.orderId, { amount: 7 });
    expect((await webhook(captured(late.payment))).body.result).toBe('refunded');
    const att = (await dbOrder(body.order.number)).attempts[0];
    await prisma.paymentAttempt.update({ where: { id: att.id }, data: { refundStatus: 'pending' } });
    const done = await webhook({ event: 'refund.processed', payload: { refund: { entity: { id: att.refundId, payment_id: att.razorpayPaymentId, status: 'processed' } } } });
    expect(done.body.result).toBe('refund processed');
    expect((await dbOrder(body.order.number)).attempts[0].refundStatus).toBe('processed');
  });

  it('an order made by the old website, paid late through the old payment request: same rules', async () => {
    const c = await customer();
    const one = await fresh();
    const order = await prisma.order.create({
      data: {
        orderNumber: `NH${String(crypto.randomInt(10_000_000, 99_999_999))}`, authAccountId: c.who.customer.id, channel: 'online', status: 'pending_payment',
        subtotal: 5800, total: 5800, shippingAddress: { fullName: 'Old Site', phone: '9876543210', line1: 'Old road', city: 'Guntur', state: 'Andhra Pradesh', pincode: '522002' },
        items: { create: [{ productId: one.id, pieceId: (await prisma.piece.findFirst({ where: { productId: one.id } })).id, nameSnapshot: 'Old', priceSnapshot: 5800, quantity: 1 }] },
        payment: { create: { razorpayOrderId: `order_OldSite${T}`, amount: 5800, status: 'created' } },
      },
    });
    const { payment } = fake.pay(`order_OldSite${T}`, { amount: 580000 });
    const w = await webhook(captured(payment));
    expect(w.body.result).toBe('paid');
    expect((await dbOrder(order.orderNumber)).status).toBe('processing');
    expect(await pieceStatus(one)).toEqual(['sold_online']);
  });

  it('a notice without a signature is refused; without the webhook secret set, every notice is', async () => {
    const r = await api().post('/api/v2/payments/razorpay/webhook').set('content-type', 'application/json').send('{}');
    expect(r.status).toBe(401);
    const had = env.payments.webhookSecret;
    env.payments.webhookSecret = '';
    try {
      const w = await webhook({ event: 'payment.captured', payload: {} });
      expect(w.status).toBe(503);
      expect(w.body.error.code).toBe('WEBHOOK_NOT_CONFIGURED');
    } finally {
      env.payments.webhookSecret = had;
    }
  });
});

describe('the stand-in payment window (website browser tests only)', () => {
  it('pays a payment request and gives the page the receipt; unknown requests are refused', async () => {
    const c = await customer();
    await put(c, await fresh());
    const { body } = await pay(c);
    const r = await api().post('/api/v2/payments/fake/pay').send({ orderId: body.razorpay.orderId, method: 'card' });
    expect(r.status).toBe(200);
    expect((await verify(c, body.order.number, r.body.receipt)).body.order).toMatchObject({ status: 'paid', payment: { method: 'card' } });
    expect((await api().post('/api/v2/payments/fake/pay').send({ orderId: 'order_NoSuchThing01' })).status).toBe(404);
  });
});

describe('rare situations found before going live (18 Oct)', () => {
  const full = (number) => prisma.order.findUnique({ where: { orderNumber: number }, include: { payment: true, attempts: { orderBy: { createdAt: 'desc' } } } });
  const failed = (payment) => ({ event: 'payment.failed', payload: { payment: { entity: payment } } });
  // The background check takes 50 at a time, oldest first: other files' open payments are parked
  // so the one under test is looked at (and a made-up Razorpay outage hits it, not another).
  const parkOthers = async () => {
    const later = new Date(Date.now() + 86400_000);
    await prisma.paymentAttempt.updateMany({ where: { status: { in: ['created', 'failed'] } }, data: { lastCheckedAt: later } });
    await prisma.paymentAttempt.updateMany({ where: { status: 'refund_due' }, data: { nextRefundAt: later } });
    await prisma.paymentAttempt.updateMany({ where: { status: 'confirming' }, data: { status: 'failed', failureReason: 'Parked by a test' } });
  };

  it('paid in one tab while Pay again is pressed in another: no new request on the paid order; the payment is kept, never refunded', async () => {
    const c = await customer();
    await put(c, await fresh());
    const { body } = await pay(c);
    const number = body.order.number;
    const tab1 = fake.pay(body.razorpay.orderId);
    // While tab 2 asks Razorpay for a new request, tab 1's payment is confirmed.
    fake.duringNextCall('createOrder', async () => { await verify(c, number, tab1.receipt); });
    const r = await c.call('post', `/orders/${number}/pay`);
    expect(r.status).toBe(409);
    expect(r.body.error.code).toBe('ORDER_PAID');
    expect(r.body.error.details.order).toMatchObject({ number, status: 'paid' });
    const o = await full(number);
    expect(o).toMatchObject({ status: 'processing', payment: { status: 'paid', razorpayPaymentId: tab1.payment.id } });
    expect(o.attempts).toHaveLength(1); // no second request saved
    // Razorpay tells us the same payment again: nothing changes, nothing is refunded.
    expect((await webhook({ event: 'order.paid', payload: { payment: { entity: tab1.payment } } })).body.result).toBe('paid');
    expect(fake.order(body.razorpay.orderId).status).toBe('paid');
    expect((await full(number)).attempts[0]).toMatchObject({ status: 'paid', refundId: null });
  });

  it('a payment told again after its order\'s record changed is still "the same payment": never refunded', async () => {
    const c = await customer();
    await put(c, await fresh());
    const { body } = await pay(c);
    const p = fake.pay(body.razorpay.orderId);
    await verify(c, body.order.number, p.receipt);
    await prisma.payment.update({ where: { orderId: (await full(body.order.number)).id }, data: { razorpayPaymentId: 'pay_SomethingElse01' } });
    expect((await webhook(captured(p.payment))).body.result).toBe('paid');
    expect((await full(body.order.number)).attempts[0].refundId).toBeNull();
  });

  it('a failed try, then a successful one on the same request whose page couldn\'t reach Razorpay: confirmed by the background check', async () => {
    await parkOthers();
    const c = await customer();
    const one = await fresh();
    await put(c, one);
    const { body } = await pay(c);
    const number = body.order.number;
    const bad = fake.pay(body.razorpay.orderId, { status: 'failed' });
    expect((await webhook(failed(bad.payment))).body.result).toBe('failed');
    const good = fake.pay(body.razorpay.orderId);
    fake.failNextCall('fetchPayment');
    expect((await verify(c, number, good.receipt)).body.order.status).toBe('confirming');
    // A late notice of the failed try doesn't undo it.
    await webhook(failed(bad.payment));
    expect((await full(number)).attempts[0]).toMatchObject({ status: 'confirming', razorpayPaymentId: good.payment.id });
    await checkPending();
    expect((await full(number)).status).toBe('processing');
    expect(await pieceStatus(one)).toEqual(['sold_online']);
  });

  it('a failed try, then a success whose page never came back and whose notice was lost: found by the check every few minutes', async () => {
    await parkOthers();
    const c = await customer();
    await put(c, await fresh());
    const { body } = await pay(c);
    const bad = fake.pay(body.razorpay.orderId, { status: 'failed' });
    await webhook(failed(bad.payment));
    fake.pay(body.razorpay.orderId); // paid in the UPI app; the notice never arrives
    await checkPending(new Date(Date.now() + 2 * MIN)); // too soon: not looked at yet
    expect((await full(body.order.number)).status).toBe('pending_payment');
    await checkPending(new Date(Date.now() + 4 * MIN));
    expect((await full(body.order.number)).status).toBe('processing');
  });

  it('a request looked at once while Razorpay was down is looked at again 5 minutes later', async () => {
    await parkOthers();
    const c = await customer();
    await put(c, await fresh());
    const { body } = await pay(c);
    fake.pay(body.razorpay.orderId);
    fake.failNextCall('orderPayments');
    await checkPending(new Date(Date.now() + 4 * MIN));
    expect((await full(body.order.number)).status).toBe('pending_payment');
    await checkPending(new Date(Date.now() + 6 * MIN)); // last looked at under 5 minutes ago
    expect((await full(body.order.number)).status).toBe('pending_payment');
    await checkPending(new Date(Date.now() + 10 * MIN));
    expect((await full(body.order.number)).status).toBe('processing');
  });

  it('a notice for a payment that isn\'t a website order (a QR code): answered, noted, never retried', async () => {
    const r = await webhook(captured({ id: `pay_Qr${T}`, entity: 'payment', order_id: null, amount: 50000, currency: 'INR', status: 'captured', method: 'upi' }));
    expect(r.status).toBe(200);
    expect(r.body.result).toBe('not a website payment');
  });

  it('a second payment on a paid request whose refund Razorpay refuses: "Refund stuck" for the owners, told once', async () => {
    const c = await customer();
    await put(c, await fresh());
    const { body } = await pay(c);
    const first = fake.pay(body.razorpay.orderId);
    await verify(c, body.order.number, first.receipt);
    const second = fake.pay(body.razorpay.orderId);
    fake.failNextCall('refundPayment', { status: 400, message: 'The balance is insufficient' });
    expect((await webhook(captured(second.payment))).body.result).toBe('refund failed');
    const o = await full(body.order.number);
    expect(o.attempts[0]).toMatchObject({ status: 'paid', refundStatus: 'failed' });
    expect(o.attempts[0].refundError).toContain(second.payment.id);
    expect(o.attempts[0].alertedAt).not.toBeNull();
    expect(statusOf(o)).toBe('refund_stuck');
    expect(o.status).toBe('processing'); // the order itself goes ahead
  });

  it('a late payment reported by the page and a notice at the same moment: one refund, never started twice', async () => {
    const c = await customer();
    const one = await fresh();
    await put(c, one);
    const { body } = await pay(c);
    const o = await full(body.order.number);
    await prisma.reservation.updateMany({ where: { orderId: o.id }, data: { status: 'expired' } });
    await prisma.piece.updateMany({ where: { productId: one.id }, data: { status: 'sold_offline' } });
    const p = fake.pay(body.razorpay.orderId);
    await Promise.all([verify(c, body.order.number, p.receipt), webhook(captured(p.payment))]);
    const after = await full(body.order.number);
    expect(after.attempts[0]).toMatchObject({ status: 'refunded', refundTries: 0 });
    expect(after.status).toBe('cancelled');
    expect(await pieceStatus(one)).toEqual(['sold_offline']);
  });

  it('a held saree put back on sale by another sweep a moment before the payment: sold once, to this order', async () => {
    const c = await customer();
    const one = await fresh();
    await put(c, one);
    const { body } = await pay(c);
    await prisma.piece.updateMany({ where: { productId: one.id }, data: { status: 'in_stock' } }); // the old server's sweep
    const p = fake.pay(body.razorpay.orderId);
    expect((await verify(c, body.order.number, p.receipt)).body.order.status).toBe('paid');
    expect(await pieceStatus(one)).toEqual(['sold_online']);
  });

  it('paid twice (two requests), the extra refunded, then cancelled by the shop: the customer sees the shop\'s cancel', async () => {
    const c = await customer();
    await put(c, await fresh());
    const { body } = await pay(c);
    const number = body.order.number;
    const again = await c.call('post', `/orders/${number}/pay`);
    const a2 = fake.pay(again.body.razorpay.orderId);
    await verify(c, number, a2.receipt);
    const a1 = fake.pay(body.razorpay.orderId); // the first window paid too
    expect((await webhook(captured(a1.payment))).body.result).toBe('refunded');
    const owner = await signedIn({ role: 'ADMIN', name: 'Cancel W6' });
    const id = (await full(number)).id;
    expect((await authed('post', `/api/v2/orders/${id}/cancel`, owner.session, owner.device).send({ reason: 'Damaged' })).status).toBe(200);
    const view = (await c.call('get', `/orders/${number}`)).body.order;
    expect(view.status).toBe('cancelled_paid');
  });
});

describe('invoices', () => {
  const invoiceText = async (number) => {
    const o = await dbOrder(number);
    const inv = await prisma.invoice.findUnique({ where: { id: o.invoice.id } });
    return { inv, text: pdfText(fs.readFileSync(`${storage().root}/${inv.storageKey}`)) };
  };
  const paidOrder = async (address) => {
    const c = await customer(address);
    await put(c, await fresh());
    const { body } = await pay(c);
    await verify(c, body.order.number, fake.pay(body.razorpay.orderId, { method: 'card' }).receipt);
    return body.order.number;
  };

  it('today (IGST off): CGST + SGST, the place of supply printed, "Paid online (Card)"', async () => {
    const { inv, text } = await invoiceText(await paidOrder());
    expect(inv).toMatchObject({ placeOfSupply: 'Telangana', channel: 'online' });
    expect(Number(inv.igstAmount)).toBe(0);
    expect(Number(inv.cgstAmount)).toBeGreaterThan(0);
    expect(text).toContain('Place of supply');
    expect(text).toContain('Telangana');
    expect(text).toContain('CGST @ 2.50%');
    expect(text).not.toContain('IGST');
    expect(text).toContain('Paid online (Card)');
  });

  it('IGST on (once the accountant confirms): another state gets one IGST line; Andhra Pradesh keeps CGST + SGST', async () => {
    env.company.igstOtherStates = true;
    try {
      const other = await invoiceText(await paidOrder());
      expect(Number(other.inv.igstAmount)).toBeCloseTo(276.19, 2);
      expect(Number(other.inv.cgstAmount)).toBe(0);
      expect(Number(other.inv.sgstAmount)).toBe(0);
      expect(other.text).toContain('IGST @ 5.00%');
      expect(other.text).not.toContain('CGST');
      const home = await invoiceText(await paidOrder({ ...ADDRESS, city: 'Mangalagiri', state: 'Andhra Pradesh', pincode: '522503' }));
      expect(Number(home.inv.igstAmount)).toBe(0);
      expect(home.text).toContain('CGST @ 2.50%');
      expect(home.inv.placeOfSupply).toBe('Andhra Pradesh');
    } finally {
      env.company.igstOtherStates = false;
    }
  });

  it('paid with Razorpay\'s TEST keys on the live server: a TEST- invoice, "not a tax invoice"; the real numbers untouched', async () => {
    const highBefore = await prisma.invoice.findFirst({ where: { invoiceNumber: { startsWith: 'INV-' } }, orderBy: { invoiceNumber: 'desc' } });
    env.isProduction = true;
    let test;
    try {
      test = await invoiceText(await paidOrder());
    } finally {
      env.isProduction = false;
    }
    expect(test.inv.invoiceNumber).toMatch(/^TEST-\d{6}$/);
    expect(test.text).toContain('Test invoice (not a tax invoice)');
    expect(test.text).toContain('NOT A TAX INVOICE');
    const real = await invoiceText(await paidOrder());
    expect(real.inv.invoiceNumber).toMatch(/^INV-\d{6}$/);
    expect(real.inv.invoiceNumber > (highBefore?.invoiceNumber || 'INV-000000')).toBe(true);
    expect(real.text).not.toContain('NOT A TAX INVOICE');
  });

  it('the PDF layout alone, and holdOf with nothing held', async () => {
    const pdf = await renderInvoicePdf({
      number: 'INV-999999', orderNumber: 'NH12345678', date: '17 Oct 2026', paidBy: 'Paid online (UPI)', customerName: 'Priya', customerMobile: '9876543210',
      lines: [{ name: 'Pure Pattu', tag: null, price: 5800, quantity: 1 }], rate: 5, gst: { taxableValue: 5523.81, gstAmount: 276.19, cgst: 138.1, sgst: 138.09 }, igst: true, placeOfSupply: 'Telangana', total: 5800,
    });
    expect(pdfText(pdf)).toContain('IGST @ 5.00%');
    expect(holdOf({ reservations: [] }).held).toBe(false);
  });
});
