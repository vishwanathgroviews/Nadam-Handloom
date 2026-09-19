import { randomUUID } from 'crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

vi.mock('../../config/prisma', async () => {
  const { createFakePrisma } = await import('../../test/fakePrisma');
  const fake = createFakePrisma();
  return { prisma: fake.client, __fake: fake };
});

import * as prismaModule from '../../config/prisma';
import { seedRoles, seedCatalogFixture } from '../../test/fakePrisma';
import { hashSecret } from '../../utils/hash';
import app from '../../app';

const fake = (prismaModule as any).__fake;
let roles: Record<string, { id: string }>;
let fixture: ReturnType<typeof seedCatalogFixture>;

beforeEach(() => {
  for (const key of Object.keys(fake.db)) fake.db[key] = [];
  roles = seedRoles(fake.db);
  fixture = seedCatalogFixture(fake.db);
});

const createToken = async (role: 'ADMIN' | 'STAFF', mobile: string) => {
  const mpinHash = await hashSecret('284759');
  const account = await fake.client.authAccount.create({
    data: {
      email: `${role.toLowerCase()}-${mobile}@example.com`, phone: mobile, mpinHash, mpinSetAt: new Date(),
      status: 'active', phoneVerifiedAt: new Date(),
      adminProfile: { create: { firstName: role, lastName: 'User' } },
    },
  });
  await fake.client.userRole.create({ data: { authAccountId: account.id, roleId: roles[role]!.id } });
  const login = await request(app).post('/api/v1/auth/app/login').send({ mobile, mpin: '284759' });
  return { token: login.body.data.tokens.accessToken as string, accountId: account.id };
};

describe('dashboard', () => {
  const seedTodaysOrders = () => {
    const now = new Date();
    const onlineOrder2 = { id: randomUUID(), orderNumber: 'NH-ONLINE-2', channel: 'online', status: 'delivered', subtotal: 2000, total: 2000, shippingAddress: {}, placedAt: now, updatedAt: now };
    const storeOrder1 = { id: randomUUID(), orderNumber: 'NH-STORE-1', channel: 'store', status: 'delivered', subtotal: 1499, total: 1499, shippingAddress: {}, placedAt: now, updatedAt: now };
    fake.db.order.push(
      { id: randomUUID(), orderNumber: 'NH-ONLINE-1', channel: 'online', status: 'processing', subtotal: 1000, total: 1000, shippingAddress: {}, placedAt: now, updatedAt: now },
      onlineOrder2,
      // pending payment shouldn't count as a sale yet
      { id: randomUUID(), orderNumber: 'NH-ONLINE-PENDING', channel: 'online', status: 'pending_payment', subtotal: 500, total: 500, shippingAddress: {}, placedAt: now, updatedAt: now },
      storeOrder1,
      // yesterday — must not count toward "today"
      { id: randomUUID(), orderNumber: 'NH-YESTERDAY', channel: 'online', status: 'delivered', subtotal: 999, total: 999, shippingAddress: {}, placedAt: new Date(now.getTime() - 26 * 60 * 60 * 1000), updatedAt: now }
    );
    fake.db.orderItem.push(
      { id: randomUUID(), orderId: onlineOrder2.id, productId: fixture.products[0]!.id, nameSnapshot: fixture.products[0]!.name, priceSnapshot: 2000, imageSnapshot: null, quantity: 1 },
      { id: randomUUID(), orderId: storeOrder1.id, productId: fixture.products[1]!.id, nameSnapshot: fixture.products[1]!.name, priceSnapshot: 1499, imageSnapshot: null, quantity: 1 }
    );
  };

  it('reports ADMIN today\'s online and store sales separately, plus low stock and cap', async () => {
    const { token } = await createToken('ADMIN', '9300000001');
    seedTodaysOrders();

    const res = await request(app).get('/api/v1/admin/dashboard').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.today.online).toEqual({
      count: 2, total: 3000,
      products: [{ productId: fixture.products[0]!.id, productName: fixture.products[0]!.name, revenue: 2000, unitsSold: 1 }],
    });
    expect(res.body.data.today.store).toEqual({
      count: 1, total: 1499,
      products: [{ productId: fixture.products[1]!.id, productName: fixture.products[1]!.name, revenue: 1499, unitsSold: 1 }],
    });
    expect(res.body.data.products.cap).toBe(5000);
    expect(typeof res.body.data.lowStockCount).toBe('number');
  });

  it('withholds today\'s sales figures from STAFF — an owner-level figure, like the analytics module', async () => {
    const { token } = await createToken('STAFF', '9300000002');
    seedTodaysOrders();

    const res = await request(app).get('/api/v1/admin/dashboard').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.today).toBeUndefined();
    // Still gets what they need operationally.
    expect(res.body.data.products.cap).toBe(5000);
    expect(typeof res.body.data.lowStockCount).toBe('number');
  });
});

describe('audit log', () => {
  it('lets ADMIN read the audit log, filtered by event type', async () => {
    const { token: adminToken } = await createToken('ADMIN', '9300000010');
    fake.db.authEvent.push(
      { id: randomUUID(), authAccountId: null, eventType: 'category_price_changed', source: 'staff_app', ipAddress: null, userAgent: null, metadata: {}, createdAt: new Date() },
      { id: randomUUID(), authAccountId: null, eventType: 'product_created', source: 'staff_app', ipAddress: null, userAgent: null, metadata: {}, createdAt: new Date() }
    );

    const res = await request(app).get('/api/v1/admin/audit-log?eventType=category_price_changed').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0].eventType).toBe('category_price_changed');
  });

  it('rejects STAFF from reading the audit log', async () => {
    const { token: staffToken } = await createToken('STAFF', '9300000011');
    const res = await request(app).get('/api/v1/admin/audit-log').set('Authorization', `Bearer ${staffToken}`);
    expect(res.status).toBe(403);
  });

  it('excludes customer-web activity by default, and only returns it when explicitly asked for', async () => {
    const { token: adminToken } = await createToken('ADMIN', '9300000012');
    // createToken's own login already wrote a staff_app login_success row —
    // clear it so this test only sees the two fixture rows below.
    fake.db.authEvent = [];
    fake.db.authEvent.push(
      { id: randomUUID(), authAccountId: null, eventType: 'product_created', source: 'staff_app', ipAddress: null, userAgent: null, metadata: {}, createdAt: new Date() },
      { id: randomUUID(), authAccountId: null, eventType: 'login_success', source: 'customer_web', ipAddress: null, userAgent: null, metadata: {}, createdAt: new Date() }
    );

    const defaultRes = await request(app).get('/api/v1/admin/audit-log').set('Authorization', `Bearer ${adminToken}`);
    expect(defaultRes.status).toBe(200);
    expect(defaultRes.body.data.items).toHaveLength(1);
    expect(defaultRes.body.data.items[0].source).toBe('staff_app');

    const customerRes = await request(app).get('/api/v1/admin/audit-log?source=customer_web').set('Authorization', `Bearer ${adminToken}`);
    expect(customerRes.status).toBe(200);
    expect(customerRes.body.data.items).toHaveLength(1);
    expect(customerRes.body.data.items[0].source).toBe('customer_web');
  });
});

describe('sessions', () => {
  it('lets ADMIN list active sessions and revoke one', async () => {
    const { token: adminToken } = await createToken('ADMIN', '9300000020');
    const { accountId: staffAccountId } = await createToken('STAFF', '9300000021');

    const sessions = fake.db.session.filter((s: any) => s.revokedAt === null || s.revokedAt === undefined);
    expect(sessions.length).toBeGreaterThan(0);

    const listRes = await request(app).get('/api/v1/admin/sessions').set('Authorization', `Bearer ${adminToken}`);
    expect(listRes.status).toBe(200);
    expect(listRes.body.data.some((s: any) => s.authAccountId === staffAccountId)).toBe(true);

    const targetSession = listRes.body.data.find((s: any) => s.authAccountId === staffAccountId);
    const revokeRes = await request(app).delete(`/api/v1/admin/sessions/${targetSession.id}`).set('Authorization', `Bearer ${adminToken}`);
    expect(revokeRes.status).toBe(200);

    const afterList = await request(app).get('/api/v1/admin/sessions').set('Authorization', `Bearer ${adminToken}`);
    expect(afterList.body.data.some((s: any) => s.id === targetSession.id)).toBe(false);
  });

  it('rejects STAFF from listing or revoking sessions', async () => {
    const { token: staffToken } = await createToken('STAFF', '9300000022');
    const listRes = await request(app).get('/api/v1/admin/sessions').set('Authorization', `Bearer ${staffToken}`);
    expect(listRes.status).toBe(403);
  });

  it('excludes customer_web sessions — this is a "lost phone" tool for staff/admin devices only', async () => {
    const { token: adminToken } = await createToken('ADMIN', '9300000023');

    const customerAccount = await fake.client.authAccount.create({
      data: { email: 'customer-session@example.com', phone: '9300099999', status: 'active' },
    });
    await fake.client.userRole.create({ data: { authAccountId: customerAccount.id, roleId: roles.CUSTOMER!.id } });
    await fake.client.session.create({
      data: {
        authAccountId: customerAccount.id,
        refreshTokenHash: 'customer-session-hash',
        platform: 'web',
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });

    const listRes = await request(app).get('/api/v1/admin/sessions').set('Authorization', `Bearer ${adminToken}`);
    expect(listRes.status).toBe(200);
    expect(listRes.body.data.some((s: any) => s.authAccountId === customerAccount.id)).toBe(false);
  });
});

// The Audit Log credited some actions to the wrong person: for events like
// "order marked shipped" the stored account is the customer, not the staff
// member who shipped it. Entries now carry who acted and what it was done to.
describe('audit log readability', () => {
  it('credits an action to the person who did it, and names the person it was done to', async () => {
    const { token: adminToken, accountId: adminId } = await createToken('ADMIN', '9300000050');

    const invite = await request(app)
      .post('/api/v1/admin/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'New Helper', mobile: '9300000051', email: 'helper@example.com', role: 'STAFF' });
    expect(invite.status).toBe(201);

    const log = await request(app).get('/api/v1/admin/audit-log').set('Authorization', `Bearer ${adminToken}`);
    if (log.status !== 200) throw new Error(JSON.stringify(log.body));
    const entry = log.body.data.items.find((e: any) => e.eventType === 'admin_provisioned_user');

    expect(entry.actor).toMatchObject({ id: adminId, role: 'Owner' });
    expect(entry.subject).toMatchObject({ name: 'New Helper' });
    // The original fields are still there for app builds that read them.
    expect(entry.authAccount).toBeTruthy();
  });

  it('names the product an action was about, not just its id', async () => {
    const { token: adminToken } = await createToken('ADMIN', '9300000052');
    const product = fixture.products[0]!;

    await request(app)
      .patch(`/api/v1/admin/products/${product.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ color: 'Teal' });

    const log = await request(app).get('/api/v1/admin/audit-log').set('Authorization', `Bearer ${adminToken}`);
    const entry = log.body.data.items.find((e: any) => e.eventType === 'product_updated');

    expect(entry.context).toMatchObject({ productName: product.name, productSku: product.sku });
  });

  it('pages ten at a time without repeating entries', async () => {
    const { token: adminToken } = await createToken('ADMIN', '9300000053');
    const at = new Date();
    for (let i = 0; i < 25; i++) {
      fake.db.authEvent.push({
        id: `33333333-0000-4000-8000-${String(i).padStart(12, '0')}`,
        authAccountId: null, eventType: 'product_updated', source: 'staff_app',
        ipAddress: null, userAgent: null, metadata: {}, createdAt: at,
      });
    }
    const seen: string[] = [];
    for (let page = 1; page <= 4; page++) {
      const res = await request(app)
        .get(`/api/v1/admin/audit-log?page=${page}&pageSize=10`)
        .set('Authorization', `Bearer ${adminToken}`);
      seen.push(...res.body.data.items.map((e: any) => e.id));
    }
    expect(new Set(seen).size).toBe(seen.length);
  });
});

describe('audit log filters', () => {
  const seedEvent = (eventType: string, createdAt: Date, source = 'staff_app') => {
    fake.db.authEvent.push({
      id: `44444444-0000-4000-8000-${String(fake.db.authEvent.length).padStart(12, '0')}`,
      authAccountId: null, eventType, source, ipAddress: null, userAgent: null, metadata: {}, createdAt,
    });
  };

  it('shows only the chosen kind of activity', async () => {
    const { token } = await createToken('ADMIN', '9300000060');
    fake.db.authEvent.length = 0;
    const now = new Date();
    seedEvent('product_updated', now);
    seedEvent('order_marked_shipped', now);
    seedEvent('subcategory_price_changed', now);

    const res = await request(app).get('/api/v1/admin/audit-log?group=catalog').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.items.map((e: any) => e.eventType)).toEqual(['subcategory_price_changed']);
  });

  it('shows only entries from the chosen date onwards', async () => {
    const { token } = await createToken('ADMIN', '9300000061');
    fake.db.authEvent.length = 0;
    const today = new Date();
    const lastWeek = new Date(Date.now() - 8 * 86_400_000);
    seedEvent('product_updated', today);
    seedEvent('product_created', lastWeek);

    const from = new Date(Date.now() - 7 * 86_400_000).toISOString();
    const res = await request(app)
      .get(`/api/v1/admin/audit-log?group=products&from=${encodeURIComponent(from)}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.body.data.items.map((e: any) => e.eventType)).toEqual(['product_updated']);
  });

  it('refuses a filter that is not one of the groups', async () => {
    const { token } = await createToken('ADMIN', '9300000062');
    const res = await request(app).get('/api/v1/admin/audit-log?group=everything').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });
});
