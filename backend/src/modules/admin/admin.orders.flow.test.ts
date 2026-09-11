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
import { seedRoles, seedCatalogFixture } from '../../test/fakePrisma';
import { hashSecret } from '../../utils/hash';
import app from '../../app';

const fake = (prismaModule as any).__fake;
const sendMock = smsProvider.sendOtp as ReturnType<typeof vi.fn>;

const extractCode = (): string => {
  const call = sendMock.mock.calls[sendMock.mock.calls.length - 1];
  return call[1];
};

let roles: Record<string, { id: string }>;
let fixture: ReturnType<typeof seedCatalogFixture>;

beforeEach(() => {
  for (const key of Object.keys(fake.db)) fake.db[key] = [];
  roles = seedRoles(fake.db);
  fixture = seedCatalogFixture(fake.db);
  sendMock.mockClear();
});

const registerLoginCustomerAndPlaceOrder = async () => {
  const phone = '9876511111';
  await request(app).post('/api/v1/auth/customer/register').send({
    firstName: 'Test', lastName: 'Customer', phone, state: 'Telangana', pincode: '500001',
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
    .send({ fullName: 'Test Customer', phone, line1: '221B Baker Street', city: 'Hyderabad', state: 'Telangana', pincode: '500001' });

  const product = fixture.products[0]!;
  const checkoutRes = await request(app)
    .post('/api/v1/orders/checkout')
    .set('Authorization', `Bearer ${customerToken}`)
    .send({ items: [{ productId: product.id, quantity: 1 }], addressId: addressRes.body.data.id });

  const { orderId, razorpayOrderId } = checkoutRes.body.data;
  await request(app)
    .post(`/api/v1/orders/${orderId}/verify-payment`)
    .set('Authorization', `Bearer ${customerToken}`)
    .send({ razorpay_order_id: razorpayOrderId, razorpay_payment_id: 'pay_test_123', razorpay_signature: 'sig_test' });

  return { customerToken, orderId };
};

const createStaffToken = async () => {
  const mpinHash = await hashSecret('284759');
  const account = await fake.client.authAccount.create({
    data: {
      email: 'staff@example.com',
      phone: '9000000001',
      mpinHash,
      mpinSetAt: new Date(),
      status: 'active',
      phoneVerifiedAt: new Date(),
      adminProfile: { create: { firstName: 'Shipping', lastName: 'Staff' } },
    },
  });
  await fake.client.userRole.create({ data: { authAccountId: account.id, roleId: roles.STAFF!.id } });
  const login = await request(app).post('/api/v1/auth/app/login').send({ mobile: '9000000001', mpin: '284759' });
  return login.body.data.tokens.accessToken as string;
};

describe('admin orders & shipment flow', () => {
  it('lets STAFF list orders, enter a DTDC AWB, and mark an order shipped', async () => {
    const { orderId, customerToken } = await registerLoginCustomerAndPlaceOrder();
    const staffToken = await createStaffToken();

    const listRes = await request(app).get('/api/v1/admin/orders').set('Authorization', `Bearer ${staffToken}`);
    expect(listRes.status).toBe(200);
    expect(listRes.body.data.items.some((o: any) => o.id === orderId)).toBe(true);

    const beforeShip = await request(app)
      .get(`/api/v1/orders/${orderId}/tracking`)
      .set('Authorization', `Bearer ${customerToken}`);
    expect(beforeShip.body.data.awbNumber).toBeNull();
    // The DTDC tracking page is a static site link, not AWB-specific, so
    // it's shown to the customer even before the order ships.
    expect(beforeShip.body.data.trackingUrl).toBe('https://www.dtdc.com/track-your-shipment/');

    const shipRes = await request(app)
      .patch(`/api/v1/admin/orders/${orderId}/shipment`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ awbNumber: 'D123456789' });

    expect(shipRes.status).toBe(200);
    expect(shipRes.body.data.awbNumber).toBe('D123456789');
    expect(shipRes.body.data.status).toBe('shipped');
    expect(shipRes.body.data.trackingUrl).toBe('https://www.dtdc.com/track-your-shipment/');

    const order = fake.db.order.find((o: any) => o.id === orderId);
    expect(order.status).toBe('shipped');
    const shipment = fake.db.shipment.find((s: any) => s.orderId === orderId);
    expect(shipment.awbNumber).toBe('D123456789');
    expect(shipment.status).toBe('shipped');
    expect(shipment.shippedAt).toBeInstanceOf(Date);

    const afterShip = await request(app)
      .get(`/api/v1/orders/${orderId}/tracking`)
      .set('Authorization', `Bearer ${customerToken}`);
    expect(afterShip.body.data.awbNumber).toBe('D123456789');
    expect(afterShip.body.data.trackingUrl).toBe('https://www.dtdc.com/track-your-shipment/');
  });

  // The staff app puts these links in the WhatsApp shipment message, so the
  // customer can open exactly what they bought. Built server-side from
  // FRONTEND_URL — the mobile app has no copy of the site URL to drift from.
  it('hands back a customer-site product link with every order item', async () => {
    const { orderId } = await registerLoginCustomerAndPlaceOrder();
    const staffToken = await createStaffToken();
    const expectedSuffix = '/product/' + fixture.products[0]!.slug;

    const detailRes = await request(app)
      .get('/api/v1/admin/orders/' + orderId)
      .set('Authorization', 'Bearer ' + staffToken);
    expect(detailRes.status).toBe(200);
    expect(detailRes.body.data.items[0].productUrl.endsWith(expectedSuffix)).toBe(true);

    const listRes = await request(app).get('/api/v1/admin/orders').set('Authorization', 'Bearer ' + staffToken);
    const listed = listRes.body.data.items.find((o: any) => o.id === orderId);
    expect(listed.items[0].productUrl.endsWith(expectedSuffix)).toBe(true);
  });

  it('returns the product links alongside the AWB when the order is marked shipped', async () => {
    const { orderId } = await registerLoginCustomerAndPlaceOrder();
    const staffToken = await createStaffToken();
    const expectedSuffix = '/product/' + fixture.products[0]!.slug;

    const shipRes = await request(app)
      .patch('/api/v1/admin/orders/' + orderId + '/shipment')
      .set('Authorization', 'Bearer ' + staffToken)
      .send({ awbNumber: 'D987654321' });

    expect(shipRes.status).toBe(200);
    expect(shipRes.body.data.productLinks).toHaveLength(1);
    expect(shipRes.body.data.productLinks[0].url.endsWith(expectedSuffix)).toBe(true);
    expect(shipRes.body.data.productLinks[0].name).toBeTruthy();
  });

  it('rejects shipment updates from a plain CUSTOMER account', async () => {
    const { orderId, customerToken } = await registerLoginCustomerAndPlaceOrder();

    const res = await request(app)
      .patch(`/api/v1/admin/orders/${orderId}/shipment`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ awbNumber: 'D123456789' });

    expect(res.status).toBe(403);
  });

  it('rejects a shipment update for an order that has not been paid yet', async () => {
    const staffToken = await createStaffToken();

    const orphanOrder = await fake.client.order.create({
      data: {
        orderNumber: 'NH-UNPAID-1',
        authAccountId: (await fake.client.authAccount.create({ data: { email: 'x@example.com' } })).id,
        subtotal: 100,
        total: 100,
        shippingAddress: {},
      },
    });

    const res = await request(app)
      .patch(`/api/v1/admin/orders/${orphanOrder.id}/shipment`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ awbNumber: 'D123456789' });

    expect(res.status).toBe(400);
  });

  it('returns 404 for an unknown order', async () => {
    const staffToken = await createStaffToken();
    const res = await request(app)
      .patch('/api/v1/admin/orders/00000000-0000-0000-0000-000000000000/shipment')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ awbNumber: 'D123456789' });
    expect(res.status).toBe(404);
  });

  it('validates the AWB number is present and long enough', async () => {
    const { orderId } = await registerLoginCustomerAndPlaceOrder();
    const staffToken = await createStaffToken();

    const res = await request(app)
      .patch(`/api/v1/admin/orders/${orderId}/shipment`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ awbNumber: '1' });

    expect(res.status).toBe(400);
  });
});

describe('admin orders — filters', () => {
  const seedOrder = async (overrides: Record<string, any> = {}) => {
    const suffix = Math.random().toString(36).slice(2, 10);
    let authAccountId: string | null = null;
    if (!overrides.noAccount) {
      const account = await fake.client.authAccount.create({
        data: { email: overrides.email ?? `buyer-${suffix}@example.com`, phone: overrides.phone ?? `9${suffix.padEnd(9, '0').slice(0, 9)}` },
      });
      authAccountId = account.id;
    }
    const order = await fake.client.order.create({
      data: {
        orderNumber: overrides.orderNumber ?? `NH-FILT-${suffix.toUpperCase()}`,
        authAccountId,
        channel: overrides.channel ?? 'online',
        status: overrides.status ?? 'paid',
        subtotal: 1000,
        total: 1000,
        shippingAddress: {},
        placedAt: overrides.placedAt ?? new Date(),
      },
    });
    if (overrides.paymentStatus) {
      await fake.client.payment.create({
        data: { orderId: order.id, razorpayOrderId: `order_${suffix}`, amount: 1000, status: overrides.paymentStatus },
      });
    }
    return order;
  };

  it('filters by a comma-separated status list', async () => {
    const staffToken = await createStaffToken();
    await seedOrder({ status: 'processing' });
    await seedOrder({ status: 'shipped' });
    await seedOrder({ status: 'delivered' });

    const res = await request(app)
      .get('/api/v1/admin/orders')
      .query({ status: 'processing,shipped' })
      .set('Authorization', `Bearer ${staffToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(2);
    expect(res.body.data.items.every((o: any) => ['processing', 'shipped'].includes(o.status))).toBe(true);
  });

  it('rejects an invalid status value rather than silently matching nothing', async () => {
    const staffToken = await createStaffToken();
    const res = await request(app)
      .get('/api/v1/admin/orders')
      .query({ status: 'not_a_real_status' })
      .set('Authorization', `Bearer ${staffToken}`);
    expect(res.status).toBe(400);
  });

  it('filters by channel', async () => {
    const staffToken = await createStaffToken();
    await seedOrder({ channel: 'online' });
    await seedOrder({ channel: 'store', noAccount: true });

    const res = await request(app)
      .get('/api/v1/admin/orders')
      .query({ channel: 'store' })
      .set('Authorization', `Bearer ${staffToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0].channel).toBe('store');
  });

  it('filters by payment status', async () => {
    const staffToken = await createStaffToken();
    await seedOrder({ paymentStatus: 'paid' });
    await seedOrder({ paymentStatus: 'failed' });

    const res = await request(app)
      .get('/api/v1/admin/orders')
      .query({ paymentStatus: 'failed' })
      .set('Authorization', `Bearer ${staffToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0].payment.status).toBe('failed');
  });

  it('filters by a placedAt date range', async () => {
    const staffToken = await createStaffToken();
    await seedOrder({ placedAt: new Date('2026-01-01') });
    await seedOrder({ placedAt: new Date('2026-06-01') });

    const res = await request(app)
      .get('/api/v1/admin/orders')
      .query({ from: '2026-05-01', to: '2026-07-01' })
      .set('Authorization', `Bearer ${staffToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(1);
  });

  it('searches by order number and by customer email/phone', async () => {
    const staffToken = await createStaffToken();
    const target = await seedOrder({ orderNumber: 'NH-SEARCHME-1', email: 'findme@example.com', phone: '9123456780' });
    await seedOrder();

    const byOrderNumber = await request(app)
      .get('/api/v1/admin/orders')
      .query({ search: 'searchme' })
      .set('Authorization', `Bearer ${staffToken}`);
    expect(byOrderNumber.body.data.items.map((o: any) => o.id)).toEqual([target.id]);

    const byEmail = await request(app)
      .get('/api/v1/admin/orders')
      .query({ search: 'findme' })
      .set('Authorization', `Bearer ${staffToken}`);
    expect(byEmail.body.data.items.map((o: any) => o.id)).toEqual([target.id]);

    const byPhone = await request(app)
      .get('/api/v1/admin/orders')
      .query({ search: '9123456780' })
      .set('Authorization', `Bearer ${staffToken}`);
    expect(byPhone.body.data.items.map((o: any) => o.id)).toEqual([target.id]);
  });
});
