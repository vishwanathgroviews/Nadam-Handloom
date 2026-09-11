import { randomUUID } from 'crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

vi.mock('../../config/prisma', async () => {
  const { createFakePrisma } = await import('../../test/fakePrisma');
  const fake = createFakePrisma();
  return { prisma: fake.client, __fake: fake };
});

vi.mock('../../providers/storage', () => ({
  storageProvider: {
    isConfigured: vi.fn(() => true),
    upload: vi.fn(),
    deleteObject: vi.fn(() => Promise.resolve()),
  },
}));

import * as prismaModule from '../../config/prisma';
import { storageProvider } from '../../providers/storage';
import { seedRoles } from '../../test/fakePrisma';
import { hashSecret } from '../../utils/hash';
import { normalizeBarcode } from '../../utils/barcode';
import app from '../../app';

const fake = (prismaModule as any).__fake;
let roles: Record<string, { id: string }>;
let uploadCounter = 0;

beforeEach(() => {
  for (const key of Object.keys(fake.db)) fake.db[key] = [];
  roles = seedRoles(fake.db);
  uploadCounter = 0;
  (storageProvider.isConfigured as ReturnType<typeof vi.fn>).mockReturnValue(true);
  (storageProvider.upload as ReturnType<typeof vi.fn>).mockImplementation(async () => {
    uploadCounter += 1;
    return { url: `https://cdn.example.com/invoices/invoice-${uploadCounter}.pdf`, key: `invoices/invoice-${uploadCounter}.pdf` };
  });
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: true,
      status: 200,
      arrayBuffer: async () => new TextEncoder().encode('fake-logo-bytes').buffer,
    }))
  );
});

const createStaffToken = async (mobile: string, role: 'ADMIN' | 'STAFF' = 'STAFF') => {
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

const seedCategory = () => {
  const category = {
    id: randomUUID(), name: 'Test Category', slug: `test-category-${randomUUID().slice(0, 8)}`,
    description: 'Test', imageUrl: null, sortOrder: 0, isActive: true,
    createdAt: new Date(), updatedAt: new Date(),
  };
  fake.db.category.push(category);
  return category;
};

const seedSubcategory = (categoryId: string, overrides: Partial<Record<string, any>> = {}) => {
  const subcategory = {
    id: randomUUID(), categoryId, name: `Test Subcategory ${randomUUID().slice(0, 6)}`,
    description: 'Test', sortOrder: 0, isActive: true,
    onlinePrice: 4999, storePrice: 2000, mrp: null,
    createdAt: new Date(), updatedAt: new Date(), ...overrides,
  };
  fake.db.subcategory.push(subcategory);
  return subcategory;
};

const seedProduct = (categoryId: string, subcategoryId: string, overrides: Partial<Record<string, any>> = {}) => {
  const product = {
    id: randomUUID(), slug: `test-product-${randomUUID().slice(0, 8)}`, sku: `NH-TEST-${randomUUID().slice(0, 6).toUpperCase()}`,
    name: 'Test Product', categoryId, subcategoryId, technique: null, borderStyle: null, purity: null, zariTier: null,
    blouseType: null, pattern: null, color: null, fabric: null, occasion: [],
    channelVisibility: 'both', trackingMode: 'quantity', stock: 1, isFeatured: false, isActive: true,
    createdAt: new Date(), updatedAt: new Date(), ...overrides,
  };
  fake.db.product.push(product);
  return product;
};

const seedPiece = (productId: string, overrides: Partial<Record<string, any>> = {}) => {
  const piece = {
    id: randomUUID(), productId, barcode: `PIECE-${randomUUID().slice(0, 8)}`,
    status: 'in_stock', soldAt: null,
    createdAt: new Date(), updatedAt: new Date(), ...overrides,
  };
  // Matches how receivePieces actually stores a barcode (canonical uppercase)
  // — see src/utils/barcode.ts.
  piece.barcode = normalizeBarcode(piece.barcode);
  fake.db.piece.push(piece);
  return piece;
};

describe('billing — multi-item in-store sale', () => {
  it('bills several scanned/typed items to one customer as a single order and invoice', async () => {
    const staffToken = await createStaffToken('9300000001');
    const category = seedCategory();
    const subcategory = seedSubcategory(category.id);
    const productA = seedProduct(category.id, subcategory.id, { name: 'Saree A', trackingMode: 'serialized', stock: 0 });
    const pieceA = seedPiece(productA.id);
    const productB = seedProduct(category.id, subcategory.id, { name: 'Saree B', stock: 3 });

    const res = await request(app)
      .post('/api/v1/admin/billing/complete-sale')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        customerName: 'Harish Exhibition',
        customerMobile: '9876543210',
        items: [
          { code: pieceA.barcode },
          { code: productB.sku, quantity: 2 },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.data.invoice.customerName).toBe('Harish Exhibition');
    expect(res.body.data.invoice.customerMobile).toBe('9876543210');
    expect(res.body.data.invoice.channel).toBe('store');
    // 1 x 2000 + 2 x 2000 = 6000, GST-inclusive at 5% -> taxable 5714.29, gst 285.71
    expect(Number(res.body.data.invoice.totalAmount)).toBe(6000);
    expect(Number(res.body.data.invoice.taxableValue)).toBeCloseTo(5714.29, 1);
    expect(Number(res.body.data.invoice.cgstAmount) + Number(res.body.data.invoice.sgstAmount)).toBeCloseTo(285.71, 1);

    const order = fake.db.order.find((o: any) => o.id === res.body.data.orderId);
    expect(order.channel).toBe('store');
    expect(order.shippingAddress.fullName).toBe('Harish Exhibition');
    expect(order.shippingAddress.phone).toBe('9876543210');

    const items = fake.db.orderItem.filter((i: any) => i.orderId === order.id);
    expect(items).toHaveLength(2);
    expect(items.reduce((sum: number, i: any) => sum + i.quantity, 0)).toBe(3);

    const soldPiece = fake.db.piece.find((p: any) => p.id === pieceA.id);
    expect(soldPiece.status).toBe('sold_offline');
    const refreshedProductB = fake.db.product.find((p: any) => p.id === productB.id);
    expect(refreshedProductB.stock).toBe(1);

    const invoices = fake.db.invoice.filter((inv: any) => inv.orderId === order.id);
    expect(invoices).toHaveLength(1);
  });

  it('rejects the whole sale if one line is reserved online, naming the failing code, and creates no order', async () => {
    const staffToken = await createStaffToken('9300000002');
    const category = seedCategory();
    const subcategory = seedSubcategory(category.id);
    const productB = seedProduct(category.id, subcategory.id, { name: 'Saree B', trackingMode: 'serialized', stock: 0 });
    const pieceB = seedPiece(productB.id, { status: 'reserved' });
    const productA = seedProduct(category.id, subcategory.id, { name: 'Saree A', stock: 5 });

    // The reserved piece is the first line, so the sale aborts before the
    // second line's stock is ever touched — a truer test of "no order
    // half-created" than asserting rollback of an already-claimed line.
    const res = await request(app)
      .post('/api/v1/admin/billing/complete-sale')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        customerName: 'Test Customer',
        items: [{ code: pieceB.barcode }, { code: productA.sku }],
      });

    expect(res.status).toBe(409);
    expect(res.body.message).toContain(pieceB.barcode);

    const refreshedProductA = fake.db.product.find((p: any) => p.id === productA.id);
    expect(refreshedProductA.stock).toBe(5);
    expect(fake.db.order.filter((o: any) => o.channel === 'store')).toHaveLength(0);
  });

  it('audit-logs a per-line price override when a staff-entered sale price differs from the store price', async () => {
    const staffToken = await createStaffToken('9300000003');
    const category = seedCategory();
    const subcategory = seedSubcategory(category.id);
    const product = seedProduct(category.id, subcategory.id, { stock: 5 });

    const res = await request(app)
      .post('/api/v1/admin/billing/complete-sale')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ customerName: 'Bargain Buyer', items: [{ code: product.sku, salePrice: 1800 }] });

    expect(res.status).toBe(201);
    const event = fake.db.authEvent.find((e: any) => e.eventType === 'offline_sale_price_override');
    expect(event).toBeTruthy();
    expect(event.metadata.salePrice).toBe(1800);
    expect(event.metadata.categoryStorePrice).toBe(2000);
  });

  it('rejects billing from a customer-web caller (ADMIN/STAFF only)', async () => {
    const res = await request(app).post('/api/v1/admin/billing/complete-sale').send({ customerName: 'X', items: [{ code: 'ANY' }] });
    expect(res.status).toBe(401);
  });
});
