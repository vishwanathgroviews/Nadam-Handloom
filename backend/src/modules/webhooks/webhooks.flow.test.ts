import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

vi.mock('../../config/prisma', async () => {
  const { createFakePrisma } = await import('../../test/fakePrisma');
  const fake = createFakePrisma();
  return { prisma: fake.client, __fake: fake };
});

vi.mock('../../providers/sms', () => ({ smsProvider: { sendOtp: vi.fn() } }));

// A signature is "valid" in this fake exactly when the header equals
// 'valid-sig' — the real HMAC comparison is covered separately by
// razorpay.provider unit tests; this file is about the webhook/idempotency
// wiring, not cryptography.
vi.mock('../../providers/payment', () => ({
  paymentProvider: {
    isConfigured: vi.fn(() => true),
    createOrder: vi.fn(async (input: any) => ({
      providerOrderId: `order_test_${Math.random().toString(36).slice(2)}`,
      amount: input.amount,
      currency: input.currency,
    })),
    verifyPaymentSignature: vi.fn(() => true),
    isWebhookConfigured: vi.fn(() => true),
    verifyWebhookSignature: vi.fn((_rawBody: Buffer, signature: string) => signature === 'valid-sig'),
  },
}));

import * as prismaModule from '../../config/prisma';
import { smsProvider } from '../../providers/sms';
import { paymentProvider } from '../../providers/payment';
import { seedRoles, seedCatalogFixture } from '../../test/fakePrisma';
import app from '../../app';

const fake = (prismaModule as any).__fake;
const sendMock = smsProvider.sendOtp as ReturnType<typeof vi.fn>;

const extractCode = (): string => {
  const call = sendMock.mock.calls[sendMock.mock.calls.length - 1];
  return call[1];
};

let fixture: ReturnType<typeof seedCatalogFixture>;
let orderSeq = 0;

beforeEach(() => {
  for (const key of Object.keys(fake.db)) fake.db[key] = [];
  seedRoles(fake.db);
  fixture = seedCatalogFixture(fake.db);
  sendMock.mockClear();
  (paymentProvider.isWebhookConfigured as ReturnType<typeof vi.fn>).mockReturnValue(true);
  (paymentProvider.verifyWebhookSignature as ReturnType<typeof vi.fn>).mockImplementation(
    (_rawBody: Buffer, signature: string) => signature === 'valid-sig'
  );
});

const placeOrder = async () => {
  orderSeq += 1;
  const phone = `98764${String(10000 + orderSeq).slice(-5)}`;
  await request(app).post('/api/v1/auth/customer/register').send({
    firstName: 'Webhook', lastName: 'Buyer', phone, state: 'Telangana', pincode: '500001',
  });
  const code = extractCode();
  const verify = await request(app).post('/api/v1/auth/customer/otp/verify').send({ phone, code });
  const setup = await request(app)
    .post('/api/v1/auth/customer/mpin/setup')
    .send({ setupToken: verify.body.data.setupToken, mpin: '284759', confirmMpin: '284759' });
  const customerToken = setup.body.data.tokens.accessToken as string;

  const addressRes = await request(app)
    .post('/api/v1/addresses')
    .set('Authorization', `Bearer ${customerToken}`)
    .send({ fullName: 'Webhook Buyer', phone, line1: '221B Baker Street', city: 'Hyderabad', state: 'Telangana', pincode: '500001' });

  const product = fixture.products[0]!;
  const checkoutRes = await request(app)
    .post('/api/v1/orders/checkout')
    .set('Authorization', `Bearer ${customerToken}`)
    .send({ items: [{ productId: product.id, quantity: 1 }], addressId: addressRes.body.data.id });

  const { orderId, razorpayOrderId } = checkoutRes.body.data;
  return { customerToken, orderId, razorpayOrderId };
};

const capturedPayload = (razorpayOrderId: string, razorpayPaymentId: string) => ({
  event: 'payment.captured',
  payload: { payment: { entity: { order_id: razorpayOrderId, id: razorpayPaymentId } } },
});

describe('Razorpay webhook', () => {
  it('finalizes payment, order, shipment, reservation and an order.paid event on a valid signature', async () => {
    const { orderId, razorpayOrderId } = await placeOrder();

    const res = await request(app)
      .post('/api/v1/webhooks/razorpay')
      .set('X-Razorpay-Signature', 'valid-sig')
      .send(capturedPayload(razorpayOrderId, 'pay_webhook_1'));
    expect(res.status).toBe(200);

    const order = fake.db.order.find((o: any) => o.id === orderId);
    expect(order.status).toBe('processing');

    const payment = fake.db.payment.find((p: any) => p.orderId === orderId);
    expect(payment.status).toBe('paid');
    expect(payment.razorpayPaymentId).toBe('pay_webhook_1');

    expect(fake.db.shipment.filter((s: any) => s.orderId === orderId)).toHaveLength(1);
    expect(fake.db.reservation.filter((r: any) => r.orderId === orderId).every((r: any) => r.status === 'converted')).toBe(true);
    expect(fake.db.eventsOutbox.filter((e: any) => e.eventType === 'order.paid' && e.payload.orderId === orderId)).toHaveLength(1);
  });

  it('rejects a webhook with an invalid signature and leaves the payment untouched', async () => {
    const { orderId, razorpayOrderId } = await placeOrder();

    const res = await request(app)
      .post('/api/v1/webhooks/razorpay')
      .set('X-Razorpay-Signature', 'garbage-sig')
      .send(capturedPayload(razorpayOrderId, 'pay_webhook_2'));
    expect(res.status).toBe(401);

    const payment = fake.db.payment.find((p: any) => p.orderId === orderId);
    expect(payment.status).toBe('created');
  });

  it('returns 503 when no webhook secret is configured', async () => {
    (paymentProvider.isWebhookConfigured as ReturnType<typeof vi.fn>).mockReturnValue(false);
    const { razorpayOrderId } = await placeOrder();

    const res = await request(app)
      .post('/api/v1/webhooks/razorpay')
      .set('X-Razorpay-Signature', 'valid-sig')
      .send(capturedPayload(razorpayOrderId, 'pay_webhook_3'));
    expect(res.status).toBe(503);
  });

  it('is idempotent under duplicate delivery — no double shipment and no double event', async () => {
    const { orderId, razorpayOrderId } = await placeOrder();
    const payload = capturedPayload(razorpayOrderId, 'pay_webhook_4');

    const first = await request(app).post('/api/v1/webhooks/razorpay').set('X-Razorpay-Signature', 'valid-sig').send(payload);
    const second = await request(app).post('/api/v1/webhooks/razorpay').set('X-Razorpay-Signature', 'valid-sig').send(payload);
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);

    expect(fake.db.shipment.filter((s: any) => s.orderId === orderId)).toHaveLength(1);
    expect(fake.db.eventsOutbox.filter((e: any) => e.eventType === 'order.paid' && e.payload.orderId === orderId)).toHaveLength(1);
  });

  it('is a clean no-op when the webhook arrives after the client callback already finalized the order', async () => {
    const { customerToken, orderId, razorpayOrderId } = await placeOrder();

    const verify = await request(app)
      .post(`/api/v1/orders/${orderId}/verify-payment`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ razorpay_order_id: razorpayOrderId, razorpay_payment_id: 'pay_client_1', razorpay_signature: 'sig_client' });
    expect(verify.status).toBe(200);

    const webhook = await request(app)
      .post('/api/v1/webhooks/razorpay')
      .set('X-Razorpay-Signature', 'valid-sig')
      .send(capturedPayload(razorpayOrderId, 'pay_webhook_5'));
    expect(webhook.status).toBe(200);

    const payment = fake.db.payment.find((p: any) => p.orderId === orderId);
    // The client callback's payment id wins — the webhook's later id never overwrites it.
    expect(payment.razorpayPaymentId).toBe('pay_client_1');
    expect(fake.db.shipment.filter((s: any) => s.orderId === orderId)).toHaveLength(1);
    expect(fake.db.eventsOutbox.filter((e: any) => e.eventType === 'order.paid' && e.payload.orderId === orderId)).toHaveLength(1);
  });

  it('is a clean no-op when the client callback arrives after the webhook already finalized the order', async () => {
    const { customerToken, orderId, razorpayOrderId } = await placeOrder();

    const webhook = await request(app)
      .post('/api/v1/webhooks/razorpay')
      .set('X-Razorpay-Signature', 'valid-sig')
      .send(capturedPayload(razorpayOrderId, 'pay_webhook_6'));
    expect(webhook.status).toBe(200);

    const verify = await request(app)
      .post(`/api/v1/orders/${orderId}/verify-payment`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ razorpay_order_id: razorpayOrderId, razorpay_payment_id: 'pay_client_2', razorpay_signature: 'sig_client' });
    expect(verify.status).toBe(200);
    expect(verify.body.data.status).toBe('processing');

    const payment = fake.db.payment.find((p: any) => p.orderId === orderId);
    expect(payment.razorpayPaymentId).toBe('pay_webhook_6');
    expect(fake.db.shipment.filter((s: any) => s.orderId === orderId)).toHaveLength(1);
    expect(fake.db.eventsOutbox.filter((e: any) => e.eventType === 'order.paid' && e.payload.orderId === orderId)).toHaveLength(1);
  });

  it('ignores webhook events it does not handle and events for unknown Razorpay orders, without erroring', async () => {
    const ignoredEvent = await request(app)
      .post('/api/v1/webhooks/razorpay')
      .set('X-Razorpay-Signature', 'valid-sig')
      .send({ event: 'payment.failed', payload: {} });
    expect(ignoredEvent.status).toBe(200);

    const unknownOrder = await request(app)
      .post('/api/v1/webhooks/razorpay')
      .set('X-Razorpay-Signature', 'valid-sig')
      .send(capturedPayload('order_does_not_exist', 'pay_orphan'));
    expect(unknownOrder.status).toBe(200);
  });

  it('is rate-limited against a flood of requests to the public endpoint', async () => {
    const { razorpayOrderId } = await placeOrder();
    const payload = capturedPayload(razorpayOrderId, 'pay_flood');

    let lastStatus = 200;
    for (let i = 0; i < 61; i++) {
      const res = await request(app).post('/api/v1/webhooks/razorpay').set('X-Razorpay-Signature', 'garbage-sig').send(payload);
      lastStatus = res.status;
    }
    expect(lastStatus).toBe(429);
  });
});
