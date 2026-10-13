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
    return { url: `https://cdn.example.com/catalogs/catalog-${uploadCounter}.pdf`, key: `catalogs/catalog-${uploadCounter}.pdf` };
  });
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: true,
      status: 200,
      arrayBuffer: async () => new TextEncoder().encode('fake-image-bytes').buffer,
    }))
  );
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

const seedCategory = (overrides: Partial<Record<string, any>> = {}) => {
  const category = {
    id: randomUUID(), name: 'Test Category', slug: `test-category-${randomUUID().slice(0, 8)}`,
    description: 'Test', imageUrl: null, sortOrder: 0, isActive: true,
    createdAt: new Date(), updatedAt: new Date(), ...overrides,
  };
  fake.db.category.push(category);
  return category;
};

const seedSubcategory = (categoryId: string, overrides: Partial<Record<string, any>> = {}) => {
  const subcategory = {
    id: randomUUID(), categoryId, name: 'Test Subcategory', description: 'Test',
    sortOrder: 0, isActive: true, onlinePrice: '1000', storePrice: '1000', mrp: null,
    createdAt: new Date(), updatedAt: new Date(), ...overrides,
  };
  fake.db.subcategory.push(subcategory);
  return subcategory;
};

const seedProductWithImage = (categoryId: string, subcategoryId: string, overrides: Partial<Record<string, any>> = {}) => {
  const product = {
    id: randomUUID(), slug: `test-product-${randomUUID().slice(0, 8)}`, sku: `NH-TEST-${randomUUID().slice(0, 6).toUpperCase()}`,
    name: 'Test Product', categoryId, subcategoryId, technique: null, borderStyle: null, purity: null, zariTier: null,
    blouseType: null, pattern: null, color: null, fabric: null, occasion: [],
    channelVisibility: 'both', trackingMode: 'quantity', stock: 5, isFeatured: false, isActive: true,
    createdAt: new Date(), updatedAt: new Date(), ...overrides,
  };
  fake.db.product.push(product);
  fake.db.productImage.push({
    id: randomUUID(), productId: product.id, url: 'https://cdn.example.com/products/photo.jpg', sortOrder: 0,
  });
  return product;
};

describe('subcategory catalog PDF', () => {
  it('generates a PDF for a subcategory with active photographed products, and records a SubcategoryCatalogPdf row', async () => {
    const staffToken = await createToken('STAFF', '9100000001');
    const category = seedCategory();
    const subcategory = seedSubcategory(category.id);
    seedProductWithImage(category.id, subcategory.id, { name: 'Alpha Saree' });
    seedProductWithImage(category.id, subcategory.id, { name: 'Beta Saree' });

    const statusBefore = await request(app)
      .get(`/api/v1/admin/subcategories/${subcategory.id}/catalog-pdf`)
      .set('Authorization', `Bearer ${staffToken}`);
    expect(statusBefore.status).toBe(200);
    expect(statusBefore.body.data).toBeNull();

    const genRes = await request(app)
      .post(`/api/v1/admin/subcategories/${subcategory.id}/catalog-pdf`)
      .set('Authorization', `Bearer ${staffToken}`);
    expect(genRes.status).toBe(200);
    expect(genRes.headers['content-type']).toBe('application/pdf');
    expect(genRes.headers['x-product-count']).toBe('2');
    expect(Buffer.isBuffer(genRes.body) || genRes.body instanceof Uint8Array).toBe(true);

    const rows = fake.db.subcategoryCatalogPdf.filter((r: any) => r.subcategoryId === subcategory.id);
    expect(rows).toHaveLength(1);
    expect(rows[0].productCount).toBe(2);

    const statusAfter = await request(app)
      .get(`/api/v1/admin/subcategories/${subcategory.id}/catalog-pdf`)
      .set('Authorization', `Bearer ${staffToken}`);
    expect(statusAfter.body.data.productCount).toBe(2);
  });

  it('resolves a relative product image URL against FRONTEND_URL before fetching', async () => {
    const staffToken = await createToken('STAFF', '9100000005');
    const category = seedCategory();
    const subcategory = seedSubcategory(category.id);
    const product = {
      id: randomUUID(), slug: 'relative-photo', sku: 'NH-RELATIVE-001', name: 'Relative Photo Product',
      categoryId: category.id, subcategoryId: subcategory.id,
      technique: null, borderStyle: null, purity: null, zariTier: null, blouseType: null, pattern: null,
      color: null, fabric: null, occasion: [], channelVisibility: 'both', trackingMode: 'quantity',
      stock: 5, isFeatured: false, isActive: true, createdAt: new Date(), updatedAt: new Date(),
    };
    fake.db.product.push(product);
    fake.db.productImage.push({
      id: randomUUID(), productId: product.id, url: '/images/products/relative-photo.jpg', sortOrder: 0,
    });

    const res = await request(app)
      .post(`/api/v1/admin/subcategories/${subcategory.id}/catalog-pdf`)
      .set('Authorization', `Bearer ${staffToken}`);
    expect(res.status).toBe(200);
    expect(res.headers['x-product-count']).toBe('1');
    expect(global.fetch).toHaveBeenCalledWith('http://localhost:5173/images/products/relative-photo.jpg');
  });

  it('regenerating deletes the old storage object and keeps exactly one row per subcategory', async () => {
    const adminToken = await createToken('ADMIN', '9100000002');
    const category = seedCategory();
    const subcategory = seedSubcategory(category.id);
    seedProductWithImage(category.id, subcategory.id);

    const firstRes = await request(app)
      .post(`/api/v1/admin/subcategories/${subcategory.id}/catalog-pdf`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(firstRes.status).toBe(200);
    const firstKey = fake.db.subcategoryCatalogPdf.find((r: any) => r.subcategoryId === subcategory.id).storageKey;

    seedProductWithImage(category.id, subcategory.id);
    const secondRes = await request(app)
      .post(`/api/v1/admin/subcategories/${subcategory.id}/catalog-pdf`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(secondRes.status).toBe(200);
    expect(secondRes.headers['x-product-count']).toBe('2');

    expect(storageProvider.deleteObject).toHaveBeenCalledWith(firstKey);
    const rows = fake.db.subcategoryCatalogPdf.filter((r: any) => r.subcategoryId === subcategory.id);
    expect(rows).toHaveLength(1);
    expect(rows[0].storageKey).not.toBe(firstKey);
  });

  it('excludes an out-of-stock photographed product from the PDF, even though it is active', async () => {
    const staffToken = await createToken('STAFF', '9100000006');
    const category = seedCategory();
    const subcategory = seedSubcategory(category.id);
    seedProductWithImage(category.id, subcategory.id, { name: 'In Stock Saree', stock: 3 });
    seedProductWithImage(category.id, subcategory.id, { name: 'Sold Out Saree', stock: 0 });

    const res = await request(app)
      .post(`/api/v1/admin/subcategories/${subcategory.id}/catalog-pdf`)
      .set('Authorization', `Bearer ${staffToken}`);
    expect(res.status).toBe(200);
    expect(res.headers['x-product-count']).toBe('1');
  });

  it('includes an out-of-stock product that still has in-stock barcoded pieces', async () => {
    const staffToken = await createToken('STAFF', '9100000007');
    const category = seedCategory();
    const subcategory = seedSubcategory(category.id);
    const product = seedProductWithImage(category.id, subcategory.id, { name: 'Serialized Saree', stock: 0 });
    fake.db.piece.push({ id: randomUUID(), productId: product.id, barcode: 'BC-STOCK-1', status: 'in_stock', createdAt: new Date(), updatedAt: new Date() });

    const res = await request(app)
      .post(`/api/v1/admin/subcategories/${subcategory.id}/catalog-pdf`)
      .set('Authorization', `Bearer ${staffToken}`);
    expect(res.status).toBe(200);
    expect(res.headers['x-product-count']).toBe('1');
  });

  it('returns 400 for a subcategory with no active products that have photos', async () => {
    const adminToken = await createToken('ADMIN', '9100000003');
    const category = seedCategory();
    const subcategory = seedSubcategory(category.id);
    // Active product, no image.
    fake.db.product.push({
      id: randomUUID(), slug: 'no-photo', sku: 'NH-NOPHOTO-001', name: 'No Photo Product',
      categoryId: category.id, subcategoryId: subcategory.id,
      technique: null, borderStyle: null, purity: null, zariTier: null, blouseType: null, pattern: null,
      color: null, fabric: null, occasion: [], channelVisibility: 'both', trackingMode: 'quantity',
      stock: 5, isFeatured: false, isActive: true, createdAt: new Date(), updatedAt: new Date(),
    });

    const res = await request(app)
      .post(`/api/v1/admin/subcategories/${subcategory.id}/catalog-pdf`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(400);
  });

  it('lets STAFF generate a catalog PDF (matches product-editing permissions, not price permissions)', async () => {
    const staffToken = await createToken('STAFF', '9100000004');
    const category = seedCategory();
    const subcategory = seedSubcategory(category.id);
    seedProductWithImage(category.id, subcategory.id);

    const res = await request(app)
      .post(`/api/v1/admin/subcategories/${subcategory.id}/catalog-pdf`)
      .set('Authorization', `Bearer ${staffToken}`);
    expect(res.status).toBe(200);
  });

  it('fetches eligible catalog products for preview', async () => {
    const staffToken = await createToken('STAFF', '9100000010');
    const category = seedCategory();
    const subcategory = seedSubcategory(category.id, { storePrice: '1499.00' });
    const p1 = seedProductWithImage(category.id, subcategory.id, { name: 'Pattu Saree 1', stock: 3 });
    const p2 = seedProductWithImage(category.id, subcategory.id, { name: 'Pattu Saree 2', stock: 0 });
    // p2 has an in-stock piece
    fake.db.piece.push({ id: randomUUID(), productId: p2.id, barcode: 'NANDAM5001', status: 'in_stock', createdAt: new Date(), updatedAt: new Date() });
    // p3 is out of stock and has no pieces
    seedProductWithImage(category.id, subcategory.id, { name: 'Out of stock Saree', stock: 0 });

    const res = await request(app)
      .get(`/api/v1/admin/subcategories/${subcategory.id}/catalog-pdf/preview`)
      .set('Authorization', `Bearer ${staffToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.subcategory.name).toBe(subcategory.name);
    expect(res.body.data.subcategory.storePrice).toBe('1499.00');
    expect(res.body.data.products).toHaveLength(2);
    expect(res.body.data.products[0].id).toBe(p1.id);
    expect(res.body.data.products[0].name).toBe('Pattu Saree 1');
    expect(res.body.data.products[0].price).toBe('1499.00');
    expect(res.body.data.products[1].id).toBe(p2.id);
    expect(res.body.data.products[1].catalogId).toBe('5001');
  });

  it('generates a PDF containing only the selected product IDs and excludes unselected ones', async () => {
    const staffToken = await createToken('STAFF', '9100000011');
    const category = seedCategory();
    const subcategory = seedSubcategory(category.id);
    const p1 = seedProductWithImage(category.id, subcategory.id, { name: 'Saree 1', stock: 2 });
    const p2 = seedProductWithImage(category.id, subcategory.id, { name: 'Saree 2', stock: 2 });
    const p3 = seedProductWithImage(category.id, subcategory.id, { name: 'Saree 3', stock: 2 });

    // Generate with only p1 and p3 selected
    const res = await request(app)
      .post(`/api/v1/admin/subcategories/${subcategory.id}/catalog-pdf`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ productIds: [p1.id, p3.id] });

    expect(res.status).toBe(200);
    expect(res.headers['x-product-count']).toBe('2');
  });

  it('rejects generation if a selected product ID does not belong to the subcategory', async () => {
    const staffToken = await createToken('STAFF', '9100000012');
    const category = seedCategory();
    const subcategory1 = seedSubcategory(category.id);
    const subcategory2 = seedSubcategory(category.id);
    const p1 = seedProductWithImage(category.id, subcategory1.id);
    const otherSubcategoryProduct = seedProductWithImage(category.id, subcategory2.id);

    const res = await request(app)
      .post(`/api/v1/admin/subcategories/${subcategory1.id}/catalog-pdf`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ productIds: [p1.id, otherSubcategoryProduct.id] });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('invalid or do not belong');
  });

  it('rejects generation if selectedProductIds is an empty array', async () => {
    const staffToken = await createToken('STAFF', '9100000013');
    const category = seedCategory();
    const subcategory = seedSubcategory(category.id);
    seedProductWithImage(category.id, subcategory.id);

    const res = await request(app)
      .post(`/api/v1/admin/subcategories/${subcategory.id}/catalog-pdf`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ productIds: [] });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('At least one product must be selected');
  });

  it('rejects generation if a selected product is out of stock', async () => {
    const staffToken = await createToken('STAFF', '9100000014');
    const category = seedCategory();
    const subcategory = seedSubcategory(category.id);
    const pOut = seedProductWithImage(category.id, subcategory.id, { stock: 0 });

    const res = await request(app)
      .post(`/api/v1/admin/subcategories/${subcategory.id}/catalog-pdf`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ productIds: [pOut.id] });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('out of stock');
  });
});
