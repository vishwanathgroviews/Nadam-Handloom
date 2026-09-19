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
    isWebhookConfigured: vi.fn(() => false),
    verifyWebhookSignature: vi.fn(() => false),
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

let orderSeq = 0;

const placePaidOrder = async () => {
  orderSeq += 1;
  const phone = `98765${String(10000 + orderSeq).slice(-5)}`;
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

  return orderId as string;
};

const createAdminToken = async () => {
  const mpinHash = await hashSecret('284759');
  const account = await fake.client.authAccount.create({
    data: {
      email: 'admin@example.com',
      phone: '9000000002',
      mpinHash,
      mpinSetAt: new Date(),
      status: 'active',
      phoneVerifiedAt: new Date(),
      adminProfile: { create: { firstName: 'Owner', lastName: 'Admin' } },
    },
  });
  await fake.client.userRole.create({ data: { authAccountId: account.id, roleId: roles.ADMIN!.id } });
  const login = await request(app).post('/api/v1/auth/app/login').send({ mobile: '9000000002', mpin: '284759' });
  return login.body.data.tokens.accessToken as string;
};

const createStaffToken = async () => {
  const mpinHash = await hashSecret('284759');
  const account = await fake.client.authAccount.create({
    data: {
      email: 'staff@example.com',
      phone: '9000000003',
      mpinHash,
      mpinSetAt: new Date(),
      status: 'active',
      phoneVerifiedAt: new Date(),
      adminProfile: { create: { firstName: 'Shipping', lastName: 'Staff' } },
    },
  });
  await fake.client.userRole.create({ data: { authAccountId: account.id, roleId: roles.STAFF!.id } });
  const login = await request(app).post('/api/v1/auth/app/login').send({ mobile: '9000000003', mpin: '284759' });
  return login.body.data.tokens.accessToken as string;
};

const monthsAgo = (n: number): Date => {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return d;
};

describe('retention: purge preview & purge', () => {
  it('previews and purges only orders older than the 6-month cutoff, leaving recent orders and clearing their reservations', async () => {
    const oldOrderId = await placePaidOrder();
    const recentOrderId = await placePaidOrder();

    const oldOrder = fake.db.order.find((o: any) => o.id === oldOrderId);
    oldOrder.placedAt = monthsAgo(7);

    const adminToken = await createAdminToken();

    const preview = await request(app).get('/api/v1/admin/retention/preview').set('Authorization', `Bearer ${adminToken}`);
    expect(preview.status).toBe(200);
    expect(preview.body.data.count).toBe(1);

    expect(fake.db.reservation.some((r: any) => r.orderId === oldOrderId)).toBe(true);

    const purge = await request(app).post('/api/v1/admin/retention/purge').set('Authorization', `Bearer ${adminToken}`);
    expect(purge.status).toBe(200);
    expect(purge.body.data.purgedCount).toBe(1);

    expect(fake.db.order.some((o: any) => o.id === oldOrderId)).toBe(false);
    expect(fake.db.order.some((o: any) => o.id === recentOrderId)).toBe(true);
    expect(fake.db.reservation.some((r: any) => r.orderId === oldOrderId)).toBe(false);
    expect(fake.db.orderItem.some((i: any) => i.orderId === oldOrderId)).toBe(false);
    expect(fake.db.payment.some((p: any) => p.orderId === oldOrderId)).toBe(false);
    expect(fake.db.shipment.some((s: any) => s.orderId === oldOrderId)).toBe(false);
  });

  it('reports zero when nothing is old enough to purge', async () => {
    await placePaidOrder();
    const adminToken = await createAdminToken();

    const preview = await request(app).get('/api/v1/admin/retention/preview').set('Authorization', `Bearer ${adminToken}`);
    expect(preview.body.data.count).toBe(0);

    const purge = await request(app).post('/api/v1/admin/retention/purge').set('Authorization', `Bearer ${adminToken}`);
    expect(purge.body.data.purgedCount).toBe(0);
  });

  it('rejects STAFF from previewing, purging, or exporting order data', async () => {
    const staffToken = await createStaffToken();

    const preview = await request(app).get('/api/v1/admin/retention/preview').set('Authorization', `Bearer ${staffToken}`);
    expect(preview.status).toBe(403);

    const purge = await request(app).post('/api/v1/admin/retention/purge').set('Authorization', `Bearer ${staffToken}`);
    expect(purge.status).toBe(403);

    const csv = await request(app).get('/api/v1/admin/retention/export-csv').set('Authorization', `Bearer ${staffToken}`);
    expect(csv.status).toBe(403);
  });

  it('rate-limits repeated manual purge triggers from the same admin', async () => {
    const adminToken = await createAdminToken();

    for (let i = 0; i < 3; i++) {
      const res = await request(app).post('/api/v1/admin/retention/purge').set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
    }

    const fourth = await request(app).post('/api/v1/admin/retention/purge').set('Authorization', `Bearer ${adminToken}`);
    expect(fourth.status).toBe(429);
  });
});

describe('retention: monthly CSV export', () => {
  it('produces a full-snapshot CSV with a header row and one row per order', async () => {
    const orderId = await placePaidOrder();
    const adminToken = await createAdminToken();

    const res = await request(app).get('/api/v1/admin/retention/export-csv').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    expect(res.headers['content-disposition']).toMatch(/attachment/);

    const lines: string[] = res.text.trim().split('\n');
    expect(lines[0]).toBe(
      'orderNumber,channel,status,placedAt,customerEmail,customerPhone,subtotal,total,paymentStatus,carrier,awbNumber,shipmentStatus,items'
    );
    expect(lines.length).toBe(2);

    const order = fake.db.order.find((o: any) => o.id === orderId);
    expect(lines[1]).toContain(order.orderNumber);
    expect(lines[1]).toContain('paid');
  });

  it('includes orders regardless of age (a full snapshot, not just recent activity)', async () => {
    const oldOrderId = await placePaidOrder();
    const oldOrder = fake.db.order.find((o: any) => o.id === oldOrderId);
    oldOrder.placedAt = monthsAgo(9);

    const adminToken = await createAdminToken();
    const res = await request(app).get('/api/v1/admin/retention/export-csv').set('Authorization', `Bearer ${adminToken}`);
    expect(res.text).toContain(oldOrder.orderNumber);
  });
});

describe('audit log retention', () => {
  it('removes staff-app entries older than 30 days and keeps everything else', async () => {
    const { purgeOldAuditLogs } = await import('./retention.service');
    const fakeDb = (await import('../../config/prisma') as any).__fake.db;
    fakeDb.authEvent.length = 0;
    const now = new Date('2026-09-19T12:00:00Z');
    const daysAgo = (d: number) => new Date(now.getTime() - d * 86_400_000);
    const push = (id: string, createdAt: Date, source = 'staff_app') =>
      fakeDb.authEvent.push({ id, authAccountId: null, eventType: 'product_updated', source, ipAddress: null, userAgent: null, metadata: {}, createdAt });

    push('old-staff', daysAgo(31));
    push('recent-staff', daysAgo(29));
    push('old-customer', daysAgo(45), 'customer_web');

    const result = await purgeOldAuditLogs(now);

    expect(result.purgedCount).toBe(1);
    expect(fakeDb.authEvent.map((e: any) => e.id).sort()).toEqual(['old-customer', 'recent-staff']);
  });
});
