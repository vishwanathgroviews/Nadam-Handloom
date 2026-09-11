import { randomUUID } from 'crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { vi } from 'vitest';

vi.mock('../../config/prisma', async () => {
  const { createFakePrisma } = await import('../../test/fakePrisma');
  const fake = createFakePrisma();
  return { prisma: fake.client, __fake: fake };
});

import * as prismaModule from '../../config/prisma';
import { seedRoles } from '../../test/fakePrisma';
import { hashSecret } from '../../utils/hash';
import app from '../../app';

const fake = (prismaModule as any).__fake;
let roles: Record<string, { id: string }>;

beforeEach(() => {
  for (const key of Object.keys(fake.db)) fake.db[key] = [];
  roles = seedRoles(fake.db);
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
  return login.body.data.tokens.accessToken as string;
};

const seedCategory = (name: string) => {
  const category = {
    id: randomUUID(), name, slug: `${name.toLowerCase()}-${randomUUID().slice(0, 6)}`,
    description: 'Test', imageUrl: null, sortOrder: 0, isActive: true,
    createdAt: new Date(), updatedAt: new Date(),
  };
  fake.db.category.push(category);
  return category;
};

const seedSubcategory = (categoryId: string, name: string) => {
  const subcategory = {
    id: randomUUID(), categoryId, name, description: 'Test', sortOrder: 0, isActive: true,
    onlinePrice: 999, storePrice: 899, mrp: null,
    createdAt: new Date(), updatedAt: new Date(),
  };
  fake.db.subcategory.push(subcategory);
  return subcategory;
};

const seedProduct = (categoryId: string, name: string, subcategoryId?: string) => {
  const product = {
    id: randomUUID(), slug: `${name.toLowerCase()}-${randomUUID().slice(0, 6)}`, sku: `NH-TEST-${randomUUID().slice(0, 6).toUpperCase()}`,
    name, categoryId, subcategoryId, technique: null, borderStyle: null, purity: null, zariTier: null,
    blouseType: null, pattern: null, color: null, fabric: null, occasion: [],
    channelVisibility: 'both', trackingMode: 'quantity', stock: 10, isFeatured: false, isActive: true,
    createdAt: new Date(), updatedAt: new Date(),
  };
  fake.db.product.push(product);
  return product;
};

const seedOrder = (opts: {
  channel: 'online' | 'store';
  status: string;
  placedAt: Date;
  total: number;
  productId: string;
  productName: string;
  unitPrice: number;
  quantity: number;
}) => {
  const order = {
    id: randomUUID(), orderNumber: `NH-${randomUUID().slice(0, 8).toUpperCase()}`,
    authAccountId: null, addressId: null, channel: opts.channel, status: opts.status,
    subtotal: opts.total, total: opts.total, shippingAddress: {},
    placedAt: opts.placedAt, updatedAt: opts.placedAt,
  };
  fake.db.order.push(order);
  fake.db.orderItem.push({
    id: randomUUID(), orderId: order.id, productId: opts.productId,
    nameSnapshot: opts.productName, priceSnapshot: opts.unitPrice, imageSnapshot: null, quantity: opts.quantity,
  });
  return order;
};

describe('analytics', () => {
  it('rejects STAFF from every analytics route', async () => {
    const staffToken = await createToken('STAFF', '9200000001');
    const routes = ['/api/v1/admin/analytics/summary', '/api/v1/admin/analytics/top-subcategories'];
    for (const route of routes) {
      const res = await request(app).get(route).set('Authorization', `Bearer ${staffToken}`);
      expect(res.status).toBe(403);
    }
  });

  it("computes summary totals correctly and excludes unpaid online orders and orders outside the date window", async () => {
    const adminToken = await createToken('ADMIN', '9200000002');
    const categoryA = seedCategory('CategoryA');
    const productA = seedProduct(categoryA.id, 'Product A');

    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);

    // Counts: paid online today.
    seedOrder({ channel: 'online', status: 'delivered', placedAt: now, total: 1000, productId: productA.id, productName: 'Product A', unitPrice: 500, quantity: 2 });
    // Excluded: unpaid online order.
    seedOrder({ channel: 'online', status: 'pending_payment', placedAt: now, total: 500, productId: productA.id, productName: 'Product A', unitPrice: 500, quantity: 1 });
    // Counts: store order today (store orders need no status filter).
    seedOrder({ channel: 'store', status: 'delivered', placedAt: now, total: 300, productId: productA.id, productName: 'Product A', unitPrice: 300, quantity: 1 });
    // Excluded by date window: yesterday.
    seedOrder({ channel: 'online', status: 'delivered', placedAt: new Date(now.getTime() - 26 * 60 * 60 * 1000), total: 500, productId: productA.id, productName: 'Product A', unitPrice: 500, quantity: 1 });

    const res = await request(app)
      .get(`/api/v1/admin/analytics/summary?from=${startOfToday.toISOString()}&to=${now.toISOString()}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.orderCount).toBe(2);
    expect(res.body.data.totalRevenue).toBe(1300);
    expect(res.body.data.online).toEqual({ count: 1, total: 1000 });
    expect(res.body.data.store).toEqual({ count: 1, total: 300 });
    expect(res.body.data.averageOrderValue).toBe(650);
  });

  it('filters the summary and rankings down to a single channel', async () => {
    const adminToken = await createToken('ADMIN', '9200000005');
    const category = seedCategory('CategoryC');
    const product = seedProduct(category.id, 'Product C');
    const now = new Date();

    seedOrder({ channel: 'online', status: 'delivered', placedAt: now, total: 1000, productId: product.id, productName: 'Product C', unitPrice: 1000, quantity: 1 });
    seedOrder({ channel: 'store', status: 'delivered', placedAt: now, total: 300, productId: product.id, productName: 'Product C', unitPrice: 300, quantity: 1 });

    const onlineRes = await request(app)
      .get('/api/v1/admin/analytics/summary?channel=online')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(onlineRes.body.data.orderCount).toBe(1);
    expect(onlineRes.body.data.totalRevenue).toBe(1000);

    const storeRes = await request(app)
      .get('/api/v1/admin/analytics/summary?channel=store')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(storeRes.body.data.orderCount).toBe(1);
    expect(storeRes.body.data.totalRevenue).toBe(300);
  });

  it('compares revenue and order count against the immediately preceding period of equal length', async () => {
    const adminToken = await createToken('ADMIN', '9200000007');
    const category = seedCategory('CategoryE');
    const product = seedProduct(category.id, 'Product E');
    const now = new Date();
    const oneHourMs = 60 * 60 * 1000;

    // A fixed 2-hour "current" window, rather than "start of today", so the
    // test isn't sensitive to what wall-clock time the suite happens to run at.
    const windowFrom = new Date(now.getTime() - 2 * oneHourMs);
    const windowTo = now;
    seedOrder({ channel: 'store', status: 'delivered', placedAt: now, total: 1000, productId: product.id, productName: 'Product E', unitPrice: 1000, quantity: 1 });

    // Previous window is the equal-length 2 hours immediately before that —
    // 1 hour before windowFrom sits safely in the middle of it.
    const previousMoment = new Date(windowFrom.getTime() - oneHourMs);
    seedOrder({ channel: 'store', status: 'delivered', placedAt: previousMoment, total: 500, productId: product.id, productName: 'Product E', unitPrice: 500, quantity: 1 });

    const res = await request(app)
      .get(`/api/v1/admin/analytics/summary?from=${windowFrom.toISOString()}&to=${windowTo.toISOString()}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.body.data.totalRevenue).toBe(1000);
    expect(res.body.data.previousPeriod.totalRevenue).toBe(500);
    expect(res.body.data.previousPeriod.revenueChangePct).toBe(100);
    expect(res.body.data.previousPeriod.orderCountChangePct).toBe(0); // 1 order both periods
  });

  it('ranks top subcategories by revenue within the date window', async () => {
    const adminToken = await createToken('ADMIN', '9200000004');
    const category = seedCategory('Sarees');
    const subcategoryA = seedSubcategory(category.id, 'Winner Subcategory');
    const subcategoryB = seedSubcategory(category.id, 'Runner-up Subcategory');
    const productA = seedProduct(category.id, 'Winner Product', subcategoryA.id);
    const productB = seedProduct(category.id, 'Runner-up Product', subcategoryB.id);
    const now = new Date();

    seedOrder({ channel: 'store', status: 'delivered', placedAt: now, total: 1000, productId: productA.id, productName: 'Winner Product', unitPrice: 500, quantity: 2 });
    seedOrder({ channel: 'store', status: 'delivered', placedAt: now, total: 200, productId: productB.id, productName: 'Runner-up Product', unitPrice: 200, quantity: 1 });

    const res = await request(app)
      .get('/api/v1/admin/analytics/top-subcategories')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data[0].subcategoryName).toBe('Winner Subcategory');
    expect(res.body.data[0].revenue).toBe(1000);
    expect(res.body.data[0].unitsSold).toBe(2);
    expect(res.body.data[1].subcategoryName).toBe('Runner-up Subcategory');
  });
});
