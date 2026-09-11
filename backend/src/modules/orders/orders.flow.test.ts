import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

vi.mock('../../config/prisma', async () => {
  const { createFakePrisma } = await import('../../test/fakePrisma');
  const fake = createFakePrisma();
  return { prisma: fake.client, __fake: fake };
});

vi.mock('../../providers/sms', () => ({ smsProvider: { sendOtp: vi.fn() } }));

vi.mock('../../providers/payment', () => ({
  paymentProvider: {
    isConfigured: vi.fn(() => true),
    createOrder: vi.fn(async (input: any) => ({
      providerOrderId: `order_test_${Math.random().toString(36).slice(2)}`,
      amount: input.amount,
      currency: input.currency,
    })),
    verifyPaymentSignature: vi.fn(() => true),
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

const registerAndLogin = async (phone: string) => {
  await request(app).post('/api/v1/auth/customer/register').send({
    firstName: 'Test', lastName: 'Customer', phone, state: 'Telangana', pincode: '500001',
  });
  const code = extractCode();
  const verify = await request(app).post('/api/v1/auth/customer/otp/verify').send({ phone, code });
  const setup = await request(app)
    .post('/api/v1/auth/customer/mpin/setup')
    .send({ setupToken: verify.body.data.setupToken, mpin: '284759', confirmMpin: '284759' });
  return setup.body.data.tokens.accessToken as string;
};

let fixture: ReturnType<typeof seedCatalogFixture>;

beforeEach(() => {
  for (const key of Object.keys(fake.db)) fake.db[key] = [];
  seedRoles(fake.db);
  fixture = seedCatalogFixture(fake.db);
  sendMock.mockClear();
  (paymentProvider.isConfigured as ReturnType<typeof vi.fn>).mockReturnValue(true);
  (paymentProvider.verifyPaymentSignature as ReturnType<typeof vi.fn>).mockReturnValue(true);
});

describe('orders flow', () => {
  it('checks out, verifies payment, and lists the resulting order', async () => {
    const token = await registerAndLogin('9876500001');

    const addressRes = await request(app)
      .post('/api/v1/addresses')
      .set('Authorization', `Bearer ${token}`)
      .send({ fullName: 'Test Customer', phone: '9876500001', line1: '221B Baker Street', city: 'Hyderabad', state: 'Telangana', pincode: '500001' });
    expect(addressRes.status).toBe(201);
    const addressId = addressRes.body.data.id;

    const product = fixture.products[0]!;
    const initialStock = product.stock; // capture before mutation — `product` shares identity with the live db row
    const checkoutRes = await request(app)
      .post('/api/v1/orders/checkout')
      .set('Authorization', `Bearer ${token}`)
      .send({ items: [{ productId: product.id, quantity: 2 }], addressId });

    expect(checkoutRes.status).toBe(201);
    expect(checkoutRes.body.data.amount).toBe(Number(fixture.subcategory.onlinePrice) * 2);
    expect(checkoutRes.body.data.razorpayOrderId).toBeTruthy();

    const { orderId, razorpayOrderId } = checkoutRes.body.data;

    const verifyRes = await request(app)
      .post(`/api/v1/orders/${orderId}/verify-payment`)
      .set('Authorization', `Bearer ${token}`)
      .send({ razorpay_order_id: razorpayOrderId, razorpay_payment_id: 'pay_test_123', razorpay_signature: 'sig_test' });
    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.data.status).toBe('processing');

    const listRes = await request(app).get('/api/v1/orders').set('Authorization', `Bearer ${token}`);
    expect(listRes.status).toBe(200);
    expect(listRes.body.data.total).toBe(1);
    expect(listRes.body.data.items[0].status).toBe('processing');

    const updatedProduct = fake.db.product.find((p: any) => p.id === product.id);
    expect(updatedProduct.stock).toBe(initialStock - 2);
  });

  it('rejects checkout when requested quantity exceeds stock', async () => {
    const token = await registerAndLogin('9876500002');
    const addressRes = await request(app)
      .post('/api/v1/addresses')
      .set('Authorization', `Bearer ${token}`)
      .send({ fullName: 'Test Customer', phone: '9876500002', line1: 'Line 1', city: 'Hyderabad', state: 'Telangana', pincode: '500001' });

    const lowStockProduct = fixture.products[1]!; // stock: 1
    const res = await request(app)
      .post('/api/v1/orders/checkout')
      .set('Authorization', `Bearer ${token}`)
      .send({ items: [{ productId: lowStockProduct.id, quantity: 5 }], addressId: addressRes.body.data.id });

    // 409, not 400 — this is a stock conflict (OUT_OF_STOCK), not a malformed request.
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('OUT_OF_STOCK');
  });

  it('returns 503 when the payment provider is not configured', async () => {
    (paymentProvider.isConfigured as ReturnType<typeof vi.fn>).mockReturnValue(false);
    const token = await registerAndLogin('9876500003');
    const addressRes = await request(app)
      .post('/api/v1/addresses')
      .set('Authorization', `Bearer ${token}`)
      .send({ fullName: 'Test Customer', phone: '9876500003', line1: 'Line 1', city: 'Hyderabad', state: 'Telangana', pincode: '500001' });

    const product = fixture.products[0]!;
    const res = await request(app)
      .post('/api/v1/orders/checkout')
      .set('Authorization', `Bearer ${token}`)
      .send({ items: [{ productId: product.id, quantity: 1 }], addressId: addressRes.body.data.id });

    expect(res.status).toBe(503);
    expect(res.body.code).toBe('PAYMENT_NOT_CONFIGURED');
  });

  it('marks the order payment_failed on an invalid signature', async () => {
    const token = await registerAndLogin('9876500004');
    const addressRes = await request(app)
      .post('/api/v1/addresses')
      .set('Authorization', `Bearer ${token}`)
      .send({ fullName: 'Test Customer', phone: '9876500004', line1: 'Line 1', city: 'Hyderabad', state: 'Telangana', pincode: '500001' });

    const product = fixture.products[0]!;
    const checkoutRes = await request(app)
      .post('/api/v1/orders/checkout')
      .set('Authorization', `Bearer ${token}`)
      .send({ items: [{ productId: product.id, quantity: 1 }], addressId: addressRes.body.data.id });

    (paymentProvider.verifyPaymentSignature as ReturnType<typeof vi.fn>).mockReturnValue(false);

    const { orderId, razorpayOrderId } = checkoutRes.body.data;
    const verifyRes = await request(app)
      .post(`/api/v1/orders/${orderId}/verify-payment`)
      .set('Authorization', `Bearer ${token}`)
      .send({ razorpay_order_id: razorpayOrderId, razorpay_payment_id: 'pay_bad', razorpay_signature: 'sig_bad' });

    expect(verifyRes.status).toBe(400);

    const order = fake.db.order.find((o: any) => o.id === orderId);
    expect(order.status).toBe('payment_failed');
  });

  it('does not let one customer view another customer\'s order', async () => {
    const tokenA = await registerAndLogin('9876500005');
    const addressRes = await request(app)
      .post('/api/v1/addresses')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ fullName: 'Owner A', phone: '9876500005', line1: 'Line 1', city: 'Hyderabad', state: 'Telangana', pincode: '500001' });

    const product = fixture.products[0]!;
    const checkoutRes = await request(app)
      .post('/api/v1/orders/checkout')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ items: [{ productId: product.id, quantity: 1 }], addressId: addressRes.body.data.id });

    const tokenB = await registerAndLogin('9876500006');
    const res = await request(app)
      .get(`/api/v1/orders/${checkoutRes.body.data.orderId}`)
      .set('Authorization', `Bearer ${tokenB}`);

    expect(res.status).toBe(404);
  });
});
