// Admin app → Online payments (owners), payment notifications to the owners' phones, the
// largest payment allowed, and the customer's recent orders. Razorpay is the stand-in
// (PAYMENT_PROVIDER=fake); notifications go to the test outbox (PUSH_PROVIDER=console).
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import crypto from 'node:crypto';
import http2 from 'node:http2';
import { api, prisma, SHOP, signUp, as } from '../support/shop.js';
import { signedIn, authed } from '../support/helpers.js';
import * as fake from '../../src/services/payments/fake.provider.js';
import { outbox } from '../../src/services/push/console.provider.js';
import { fcmBody } from '../../src/services/push/fcm.provider.js';
import { apnsSender, apnsPayload } from '../../src/services/push/apns.provider.js';
import { alertsSettled } from '../../src/services/ownerAlerts.service.js';
import { endExpiredHolds, checkPending } from '../../src/services/shop/checkout.service.js';
import { hmac } from '../../src/services/payments/signature.js';
import { env } from '../../src/config/env.js';

vi.mock('../../src/config/env.js', async (importOriginal) => {
  const mod = await importOriginal();
  return { ...mod, env: { ...mod.env, payments: { ...mod.env.payments } } };
});

const T = String(crypto.randomInt(10_000_000, 99_999_999));
// Every customer here has this name (letters only, unique to this run): the list is searched by it.
const letters = T.replace(/\d/g, (d) => 'abcdefghij'[d]).replace(/^./, (x) => x.toUpperCase());
const NAME = `Kavya ${letters}`;
const LIST_NAME = `Meena ${letters}`; // the Online payments list's own customers
const MIN = 60_000;
let cat;
let col;
let k = 0;
async function fresh(price = 4200) {
  k += 1;
  col ??= await prisma.subcategory.create({ data: { categoryId: cat.id, name: `Kanchi Pattu ${T}`, description: 'Pure handloom', onlinePrice: price, storePrice: price, mrp: 9999 } });
  return prisma.product.create({
    data: {
      slug: `op-${T}-${k}`, sku: `NH-OP${T}-${k}`, name: col.name, categoryId: cat.id, subcategoryId: col.id, channelVisibility: 'both', trackingMode: 'serialized',
      images: { create: [{ url: `https://example.test/${T}-${k}.jpg`, sortOrder: 0 }] },
      pieces: { create: [{ barcode: `OP${T}${k}`, status: 'in_stock' }] },
    },
  });
}
const ADDRESS = { label: 'home', fullName: NAME, mobile: '9876543210', line1: 'Door 4-12, Temple Street', pincode: '500034', city: 'Hyderabad', state: 'Telangana' };
async function customer(mobile = '9876543210', fullName = NAME) {
  const who = await signUp();
  const call = as(who);
  const a = await call('post', '/me/addresses').send({ ...ADDRESS, mobile, fullName });
  return { who, call, addressId: a.body.address.id };
}
const expectOf = (b) => ({ amount: b.totals.amount, lines: b.items.filter((l) => l.quantity > 0).map((l) => ({ slug: l.slug, quantity: l.quantity, price: l.price })) });
async function checkout(c, product) {
  await c.call('put', `/me/bag/items/${product.slug}`).send({ quantity: 1 });
  const bag = await c.call('get', '/me/bag');
  return c.call('post', '/checkout').send({ addressId: c.addressId, expect: expectOf(bag.body) });
}
const verify = (c, number, receipt) => c.call('post', `/orders/${number}/verify`).send({ razorpayOrderId: receipt.razorpay_order_id, razorpayPaymentId: receipt.razorpay_payment_id, razorpaySignature: receipt.razorpay_signature });
function webhook(event) {
  const body = JSON.stringify(event);
  return api().post('/api/v2/payments/razorpay/webhook').set('content-type', 'application/json').set('x-razorpay-signature', hmac(Buffer.from(body), 'test_webhook_secret_0123456789abcdef')).set('x-razorpay-event-id', crypto.randomUUID()).send(body);
}
async function paidOrder(c, method = 'upi') {
  const r = await checkout(c, await fresh());
  const { receipt } = fake.pay(r.body.razorpay.orderId, { method });
  await verify(c, r.body.order.number, receipt);
  return { number: r.body.order.number, receipt, total: r.body.order.total };
}
const sentTo = (token) => outbox.filter((m) => m.token === token);
const tok = (who) => `fcm-${who}-${T}-0123456789abcdefghij`;

let owner;
let staff;
beforeAll(async () => {
  cat = await prisma.category.create({ data: { name: `ONLINE PAYMENTS TEST ${T}`, slug: `op-test-${T}`, description: 'x', sortOrder: 996 } });
  owner = await signedIn({ role: 'ADMIN' });
  staff = await signedIn({ role: 'STAFF', device: { id: `test-${crypto.randomUUID()}`, name: 'Test Pixel', platform: 'android' } });
});
beforeEach(() => { fake.reset(); });

describe('this phone\'s notifications (/me/push)', () => {
  it('an owner\'s phone is registered with payment notifications on; turning them off and back; a test notification', async () => {
    let r = await authed('put', '/api/v2/me/push', owner.session, owner.device).send({ token: tok('owner'), platform: 'ios' });
    expect(r.status).toBe(200);
    expect(r.body.push).toEqual({ registered: true, payments: true, canGetPayments: true, ready: true });
    r = await authed('patch', '/api/v2/me/push', owner.session, owner.device).send({ payments: false });
    expect(r.body.push.payments).toBe(false);
    r = await authed('put', '/api/v2/me/push', owner.session, owner.device).send({ token: tok('owner'), platform: 'ios' });
    expect(r.body.push.payments).toBe(false); // a new token keeps the owner's choice
    await authed('patch', '/api/v2/me/push', owner.session, owner.device).send({ payments: true });
    outbox.length = 0;
    r = await authed('post', '/api/v2/me/push/test', owner.session, owner.device);
    expect(r.body.sent).toBe(true);
    expect(sentTo(tok('owner'))[0]).toMatchObject({ title: 'Payment notifications are on', platform: 'ios' });
  });

  it('the same token sent twice at the same moment (the app does, on start): one row, no error', async () => {
    const two = await signedIn({ role: 'ADMIN' });
    const send = () => authed('put', '/api/v2/me/push', two.session, two.device).send({ token: tok('twice'), platform: 'android' });
    const replies = await Promise.all([send(), send(), send()]);
    expect(replies.map((x) => x.status)).toEqual([200, 200, 200]);
    expect(await prisma.staffPushToken.count({ where: { token: tok('twice') } })).toBe(1);
  });

  it('staff: registered, but never payment notifications', async () => {
    const r = await authed('put', '/api/v2/me/push', staff.session, staff.device).send({ token: tok('staff'), platform: 'android', payments: true });
    expect(r.body.push).toMatchObject({ registered: true, payments: false, canGetPayments: false });
    expect((await authed('patch', '/api/v2/me/push', staff.session, staff.device).send({ payments: true })).body.error.code).toBe('OWNERS_ONLY');
  });
});

describe('notifications to the owners\' phones', () => {
  it('a paid order: only owners, only signed-in phones, only with payment notifications on; a gone token is forgotten', async () => {
    const off = await signedIn({ role: 'ADMIN' });
    const out = await signedIn({ role: 'ADMIN' });
    const gone = await signedIn({ role: 'ADMIN' });
    await authed('put', '/api/v2/me/push', off.session, off.device).send({ token: tok('off'), platform: 'android', payments: false });
    await authed('put', '/api/v2/me/push', out.session, out.device).send({ token: tok('out'), platform: 'android' });
    await authed('put', '/api/v2/me/push', gone.session, gone.device).send({ token: `invalid-${tok('gone')}`, platform: 'android' });
    await api().post('/api/v2/auth/logout').send({ refreshToken: out.session.refreshToken });
    expect(await prisma.staffPushToken.count({ where: { token: tok('out') } })).toBe(0); // signing out forgets it
    outbox.length = 0;
    const c = await customer();
    const { number } = await paidOrder(c);
    await alertsSettled();
    const [m] = sentTo(tok('owner'));
    expect(m).toMatchObject({ title: 'New online order · ₹4,200', body: `${number} · 1 saree · ${NAME}, Hyderabad · UPI`, data: { type: 'payment', number, event: 'paid' }, channel: 'payments', urgent: true });
    expect(sentTo(tok('off'))).toEqual([]);
    expect(sentTo(tok('staff'))).toEqual([]);
    expect(await prisma.staffPushToken.count({ where: { token: `invalid-${tok('gone')}` } })).toBe(0);
  });

  it('an automatic refund, and a refund Razorpay keeps refusing: tried later and later, the owners told once', async () => {
    const c = await customer();
    const r = await checkout(c, await fresh());
    fake.failNextCall('refundPayment', { times: 4, status: 400, message: 'The balance is insufficient for the refund' });
    outbox.length = 0;
    await verify(c, r.body.order.number, fake.pay(r.body.razorpay.orderId, { amount: 100 }).receipt); // a different amount → refund
    let att = (await prisma.paymentAttempt.findMany({ where: { order: { orderNumber: r.body.order.number } } }))[0];
    expect(att).toMatchObject({ status: 'refund_due', refundTries: 1, refundError: 'The balance is insufficient for the refund' });
    expect(att.nextRefundAt.getTime()).toBeGreaterThan(Date.now() + 50_000); // 1 minute
    await checkPending(); // too early: not tried
    expect((await prisma.paymentAttempt.findUnique({ where: { id: att.id } })).refundTries).toBe(1);
    await checkPending(new Date(Date.now() + 2 * MIN));
    await checkPending(new Date(Date.now() + 8 * MIN));
    att = await prisma.paymentAttempt.findUnique({ where: { id: att.id } });
    expect(att.refundTries).toBe(3);
    expect(att.alertedAt).not.toBeNull();
    await checkPending(new Date(Date.now() + 30 * MIN));
    await alertsSettled();
    const stuck = sentTo(tok('owner')).filter((m) => m.data.event === 'refund_stuck');
    expect(stuck).toHaveLength(1);
    expect(stuck[0]).toMatchObject({ title: 'Refund stuck · ₹4,200' });
    expect(stuck[0].body).toContain('Refund it by hand in the Razorpay dashboard');
    // Razorpay accepts it at last: refunded, and the owners hear it started.
    await checkPending(new Date(Date.now() + 120 * MIN));
    expect((await prisma.paymentAttempt.findUnique({ where: { id: att.id } })).status).toBe('refunded');
    await alertsSettled();
    expect(sentTo(tok('owner')).some((m) => m.data.event === 'refund_started' && m.title === 'Refund started · ₹4,200')).toBe(true);
  });

  it('Razorpay can\'t complete a refund it started (refund.failed): stuck, the owners told once', async () => {
    const c = await customer();
    const r = await checkout(c, await fresh());
    await verify(c, r.body.order.number, fake.pay(r.body.razorpay.orderId, { amount: 100 }).receipt);
    const att = (await prisma.paymentAttempt.findMany({ where: { order: { orderNumber: r.body.order.number } } }))[0];
    outbox.length = 0;
    const ev = { event: 'refund.failed', payload: { refund: { entity: { id: att.refundId, payment_id: att.razorpayPaymentId, status: 'failed' } } } };
    expect((await webhook(ev)).body.result).toBe('refund failed');
    await webhook(ev);
    await alertsSettled();
    expect(sentTo(tok('owner')).filter((m) => m.data.event === 'refund_stuck')).toHaveLength(1);
  });
});

describe('Online payments (owners)', () => {
  const list = (query = '') => authed('get', `/api/v2/payments?q=${encodeURIComponent(LIST_NAME)}${query}`, owner.session, owner.device);
  const buyer = (mobile) => customer(mobile, LIST_NAME);
  let o;
  beforeAll(async () => {
    fake.reset();
    const c = await buyer('9123456789');
    o = { paid: await paidOrder(c), card: await paidOrder(await buyer(), 'card') };
    // Not paid: the window closed.
    const c3 = await buyer();
    const r3 = await checkout(c3, await fresh());
    o.notPaid = r3.body.order.number;
    // Refunded: paid after the 15 minutes, the saree sold at the store meanwhile.
    const c4 = await buyer();
    const p4 = await fresh();
    const r4 = await checkout(c4, p4);
    await prisma.reservation.updateMany({ where: { order: { orderNumber: r4.body.order.number } }, data: { expiresAt: new Date(Date.now() - 1000) } });
    await endExpiredHolds();
    await prisma.piece.updateMany({ where: { productId: p4.id }, data: { status: 'sold_offline' } });
    await webhook({ event: 'payment.captured', payload: { payment: { entity: fake.pay(r4.body.razorpay.orderId).payment } } });
    o.refunded = r4.body.order.number;
    // Confirming: Razorpay couldn't be asked.
    const c5 = await buyer();
    const r5 = await checkout(c5, await fresh());
    fake.failNextCall('fetchPayment');
    await verify(c5, r5.body.order.number, fake.pay(r5.body.razorpay.orderId).receipt);
    o.confirming = r5.body.order.number;
    // Cancelled after paying (in the admin app): refunded by hand.
    const c6 = await buyer();
    o.byHand = await paidOrder(c6);
    const id = (await prisma.order.findUnique({ where: { orderNumber: o.byHand.number } })).id;
    expect((await authed('post', `/api/v2/orders/${id}/cancel`, owner.session, owner.device).send({ reason: 'Customer asked to cancel' })).status).toBe(200);
  });

  it('owners only', async () => {
    expect((await authed('get', '/api/v2/payments', staff.session, staff.device)).status).toBe(403);
    expect((await api().get('/api/v2/payments')).status).toBe(401);
  });

  it('every payment, newest first, with its status, the counts and totals of what is shown', async () => {
    const r = await list();
    expect(r.status).toBe(200);
    const by = Object.fromEntries(r.body.payments.map((p) => [p.number, p]));
    expect(by[o.paid.number]).toMatchObject({ status: 'paid', statusText: 'Paid', total: 4200, method: 'upi', methodText: 'UPI', customer: LIST_NAME, town: 'Hyderabad', sarees: 1, tries: 1, refund: null });
    expect(by[o.card.number]).toMatchObject({ status: 'paid', method: 'card', methodText: 'Card' });
    expect(by[o.notPaid]).toMatchObject({ status: 'not_paid', statusText: 'Not paid', paidAt: null });
    expect(by[o.refunded]).toMatchObject({ status: 'refunded', refund: { amount: 4200, state: 'processed', reason: 'Paid after the sarees were sold' } });
    expect(by[o.confirming]).toMatchObject({ status: 'confirming' });
    expect(by[o.byHand.number]).toMatchObject({ status: 'refund_by_hand', statusText: 'Cancelled after paying' });
    const times = r.body.payments.map((p) => Date.parse(p.placedAt));
    expect(times).toEqual([...times].sort((a, b) => b - a));
    expect(r.body.counts).toMatchObject({ paid: 2, not_paid: 1, refunded: 1, confirming: 1, refund_by_hand: 1 });
    expect(r.body.totals).toMatchObject({ paid: 8400, paidCount: 2, refunded: 4200, refundedCount: 1 });
  });

  it('filters: status, method, days, and a search by order number, Razorpay id, mobile or name', async () => {
    expect((await list('&status=paid')).body.payments.map((p) => p.number).sort()).toEqual([o.paid.number, o.card.number].sort());
    expect((await list('&method=card')).body.payments.map((p) => p.number)).toEqual([o.card.number]);
    expect((await list('&period=today')).body.total).toBe(6);
    expect((await list('&period=custom&from=2025-01-01&to=2025-01-31')).body.total).toBe(0);
    const s = (q) => authed('get', `/api/v2/payments?q=${encodeURIComponent(q)}`, owner.session, owner.device).then((x) => x.body.payments.map((p) => p.number));
    expect(await s(o.paid.number)).toEqual([o.paid.number]);
    expect(await s(o.paid.receipt.razorpay_payment_id)).toEqual([o.paid.number]);
    expect(await s('91234 56789')).toEqual([o.paid.number]);
    expect((await authed('get', '/api/v2/payments?status=nope', owner.session, owner.device)).status).toBe(400);
  });

  it('one payment: the sarees, the customer, each try, refunds and Razorpay\'s notices', async () => {
    let r = await authed('get', `/api/v2/payments/${o.refunded}`, owner.session, owner.device);
    expect(r.status).toBe(200);
    const p = r.body.payment;
    expect(p).toMatchObject({ number: o.refunded, status: 'refunded', orderStatusText: 'Cancelled', canOpenOrder: true });
    expect(p.customer).toMatchObject({ name: LIST_NAME, mobile: '9876543210' });
    expect(p.items).toEqual([expect.objectContaining({ quantity: 1, price: 4200 })]);
    expect(p.tries[0]).toMatchObject({ status: 'refunded', statusText: 'Refunded', amount: 4200, refund: { state: 'processed', reason: 'Paid after the sarees were sold' } });
    expect(p.notices).toEqual([expect.objectContaining({ type: 'payment.captured', result: 'refunded' })]);
    r = await authed('get', `/api/v2/payments/${o.notPaid}`, owner.session, owner.device);
    expect(r.body.payment).toMatchObject({ status: 'not_paid', canOpenOrder: false, hold: { held: true } });
    expect(r.body.payment.tries[0].statusText).toBe('Window opened, not paid');
    expect((await authed('get', '/api/v2/payments/NH00000000', owner.session, owner.device)).status).toBe(404);
  });
});

describe('the largest payment', () => {
  it('a bag above the limit: Pay asks to order on WhatsApp, nothing held; /config says the limit', async () => {
    const c = await customer();
    const p = await fresh();
    env.payments.maxAmount = 4000;
    try {
      expect((await api().get(`${SHOP}/config`)).body.payments.maxAmount).toBe(4000);
      const r = await checkout(c, p);
      expect(r.status).toBe(409);
      expect(r.body.error).toMatchObject({ code: 'ORDER_TOO_LARGE', details: { maxAmount: 4000 } });
      expect(r.body.error.message).toContain('Please order on WhatsApp');
      expect((await prisma.piece.findFirst({ where: { productId: p.id } })).status).toBe('in_stock');
    } finally {
      env.payments.maxAmount = 500000;
    }
  });

  it('Razorpay\'s own limit is lower: the same answer, the sarees back on sale', async () => {
    const c = await customer();
    const p = await fresh();
    fake.failNextCall('createOrder', { status: 400, message: 'Amount exceeds maximum amount allowed.' });
    const r = await checkout(c, p);
    expect(r.body.error.code).toBe('ORDER_TOO_LARGE');
    expect((await prisma.piece.findFirst({ where: { productId: p.id } })).status).toBe('in_stock');
  });
});

describe('the customer\'s orders (GET /shop/orders; W7 adds more in shop/orders.test.js)', () => {
  it('paid, held and refunded orders; checkouts that ended unpaid are left out', async () => {
    const c = await customer();
    const paid = await paidOrder(c);
    const held = await checkout(c, await fresh()); // replaces nothing: the first was paid
    const gone = await checkout(c, await fresh()); // replaces the held one (cancelled)
    const r = await c.call('get', '/orders');
    expect(r.status).toBe(200);
    expect(r.headers['cache-control']).toBe('no-store');
    const numbers = r.body.orders.map((x) => x.number);
    expect(numbers).toContain(paid.number);
    expect(numbers).toContain(gone.body.order.number);
    expect(numbers).not.toContain(held.body.order.number);
    expect(r.body.orders.find((x) => x.number === paid.number)).toMatchObject({ status: 'paid', total: 4200, pieces: 1, title: expect.any(String) });
    expect((await (await customer()).call('get', '/orders')).body.orders).toEqual([]);
  });
});

describe('the senders', () => {
  it('Android (Firebase): a notification Android shows itself, in the payments channel, with the data for a tap', () => {
    const b = fcmBody({ token: 't', platform: 'android', title: 'New online order · ₹4,200', body: 'NH1 · 1 saree', data: { type: 'payment', number: 'NH1' }, channel: 'payments', urgent: true, tag: 'pay-NH1' });
    expect(b.message).toEqual({
      token: 't',
      notification: { title: 'New online order · ₹4,200', body: 'NH1 · 1 saree' },
      data: { type: 'payment', number: 'NH1', body: '{"type":"payment","number":"NH1"}' },
      android: { priority: 'HIGH', ttl: '86400s', notification: { channel_id: 'payments', sound: 'default', tag: 'pay-NH1' } },
    });
    expect(b.message.webpush).toBeUndefined();
  });

  it('iPhone (Apple): the push key\'s signed token, the app\'s topic, the payload; a removed app is forgotten', async () => {
    const { privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
    const seen = [];
    const server = http2.createServer();
    server.on('stream', (stream, headers) => {
      let body = '';
      stream.on('data', (c) => { body += c; });
      stream.on('end', () => {
        seen.push({ headers, body: JSON.parse(body) });
        const gone = headers[':path'].endsWith('/gone-token');
        stream.respond({ ':status': gone ? 410 : 200 });
        stream.end(gone ? JSON.stringify({ reason: 'Unregistered' }) : '');
      });
    });
    await new Promise((r) => { server.listen(0, r); });
    const port = server.address().port;
    const sender = apnsSender({ keyId: 'ABC123DEFG', teamId: 'TEAM123456', privateKey: privateKey.export({ type: 'pkcs8', format: 'pem' }), bundleId: 'com.nandamhandlooms.staff', production: true }, () => http2.connect(`http://localhost:${port}`));
    try {
      expect(await sender.send({ token: 'good-token', title: 'New online order · ₹4,200', body: 'NH1', data: { number: 'NH1' }, urgent: true, tag: 'pay-NH1' })).toEqual({ ok: true });
      expect(await sender.send({ token: 'gone-token', title: 'a', body: 'b' })).toEqual({ ok: false, invalidToken: true, error: 'Unregistered' });
    } finally {
      sender.close();
      server.close();
    }
    const [h] = seen;
    expect(h.headers).toMatchObject({ ':path': '/3/device/good-token', 'apns-topic': 'com.nandamhandlooms.staff', 'apns-push-type': 'alert', 'apns-priority': '10', 'apns-collapse-id': 'pay-NH1' });
    const [head, claims] = h.headers.authorization.replace('bearer ', '').split('.').slice(0, 2).map((x) => JSON.parse(Buffer.from(x, 'base64url').toString()));
    expect(head).toMatchObject({ alg: 'ES256', kid: 'ABC123DEFG' });
    expect(claims.iss).toBe('TEAM123456');
    expect(h.body).toEqual(apnsPayload({ title: 'New online order · ₹4,200', body: 'NH1', data: { number: 'NH1' }, tag: 'pay-NH1' }));
    expect(h.body.aps.alert).toEqual({ title: 'New online order · ₹4,200', body: 'NH1' });
  });
});
