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
    isConfigured: vi.fn(() => false),
    upload: vi.fn(),
    deleteObject: vi.fn(() => Promise.resolve()),
  },
}));

import * as prismaModule from '../../config/prisma';
import { storageProvider } from '../../providers/storage';
import { seedRoles, seedCatalogFixture } from '../../test/fakePrisma';
import { hashSecret } from '../../utils/hash';
import { ACTIVE_PRODUCT_CAP } from './catalog.admin.service';
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
      email: `${role.toLowerCase()}@example.com`,
      phone: mobile,
      mpinHash,
      mpinSetAt: new Date(),
      status: 'active',
      phoneVerifiedAt: new Date(),
      adminProfile: { create: { firstName: role, lastName: 'User' } },
    },
  });
  await fake.client.userRole.create({ data: { authAccountId: account.id, roleId: roles[role]!.id } });
  const login = await request(app).post('/api/v1/auth/app/login').send({ mobile, mpin: '284759' });
  return login.body.data.tokens.accessToken as string;
};

describe('catalog admin — categories', () => {
  it('lets ADMIN create a category with just name/description/image/sort (no price)', async () => {
    const adminToken = await createToken('ADMIN', '9000000010');

    const res = await request(app)
      .post('/api/v1/admin/categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Ikat Sarees', description: 'Resist-dyed ikat weaves.' });

    expect(res.status).toBe(201);
    expect(res.body.data.slug).toBe('ikat-sarees');
    expect(res.body.data.onlinePrice).toBeUndefined();
    expect(res.body.data.isActive).toBe(true);
  });

  it('ignores an imageUrl passed directly in the create/update payload — S3 upload is the only way to set it', async () => {
    const adminToken = await createToken('ADMIN', '9000000015');

    const created = await request(app)
      .post('/api/v1/admin/categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Bypass Attempt', description: 'Testing the lockdown.', imageUrl: 'https://evil.example.com/x.jpg' });
    expect(created.status).toBe(201);
    // The fake-prisma double leaves an unset nullable column `undefined`
    // rather than `null` (unlike real Postgres) — either means "not set."
    expect(created.body.data.imageUrl == null).toBe(true);

    const updated = await request(app)
      .patch(`/api/v1/admin/categories/${created.body.data.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ imageUrl: 'https://evil.example.com/y.jpg' });
    expect(updated.status).toBe(200);
    expect(updated.body.data.imageUrl == null).toBe(true);
  });

  it('rejects category creation from STAFF (ADMIN only)', async () => {
    const staffToken = await createToken('STAFF', '9000000011');
    const res = await request(app)
      .post('/api/v1/admin/categories')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ name: 'Ikat Sarees', description: 'x' });
    expect(res.status).toBe(403);
  });

  it('returns 404 when updating an unknown category', async () => {
    const adminToken = await createToken('ADMIN', '9000000014');
    const res = await request(app)
      .patch('/api/v1/admin/categories/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ description: 'Updated' });
    expect(res.status).toBe(404);
  });

  it('lets ADMIN upload a category image, and replacing it deletes the old storage object', async () => {
    const adminToken = await createToken('ADMIN', '9000000015');
    const categoryId = fixture.category.id;

    (storageProvider.isConfigured as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (storageProvider.upload as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      url: 'https://cdn.example.com/categories/first.jpg',
      key: 'categories/first.jpg',
    });

    const firstRes = await request(app)
      .post(`/api/v1/admin/categories/${categoryId}/image`)
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('image', Buffer.from('fake-image-bytes'), { filename: 'photo.jpg', contentType: 'image/jpeg' });
    expect(firstRes.status).toBe(200);
    expect(firstRes.body.data.imageUrl).toBe('https://cdn.example.com/categories/first.jpg');
    expect(storageProvider.deleteObject).not.toHaveBeenCalled();

    (storageProvider.upload as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      url: 'https://cdn.example.com/categories/second.jpg',
      key: 'categories/second.jpg',
    });

    const secondRes = await request(app)
      .post(`/api/v1/admin/categories/${categoryId}/image`)
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('image', Buffer.from('fake-image-bytes-2'), { filename: 'photo2.jpg', contentType: 'image/jpeg' });
    expect(secondRes.status).toBe(200);
    expect(secondRes.body.data.imageUrl).toBe('https://cdn.example.com/categories/second.jpg');
    expect(storageProvider.deleteObject).toHaveBeenCalledWith('categories/first.jpg');

    (storageProvider.isConfigured as ReturnType<typeof vi.fn>).mockReturnValue(false);
  });

  it('rejects category image upload from STAFF', async () => {
    const staffToken = await createToken('STAFF', '9000000016');
    (storageProvider.isConfigured as ReturnType<typeof vi.fn>).mockReturnValue(true);

    const res = await request(app)
      .post(`/api/v1/admin/categories/${fixture.category.id}/image`)
      .set('Authorization', `Bearer ${staffToken}`)
      .attach('image', Buffer.from('fake-image-bytes'), { filename: 'photo.jpg', contentType: 'image/jpeg' });
    expect(res.status).toBe(403);

    (storageProvider.isConfigured as ReturnType<typeof vi.fn>).mockReturnValue(false);
  });
});

describe('catalog admin — subcategories', () => {
  it('lets ADMIN create a subcategory with online/store price + description', async () => {
    const adminToken = await createToken('ADMIN', '9000000017');

    const res = await request(app)
      .post(`/api/v1/admin/categories/${fixture.category.id}/subcategories`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Zute line Saree', description: 'Zute line weave.', onlinePrice: 4999, storePrice: 4599 });

    expect(res.status).toBe(201);
    expect(Number(res.body.data.onlinePrice)).toBe(4999);
    expect(res.body.data.isActive).toBe(true);
  });

  it('rejects subcategory creation from STAFF (price-bearing — ADMIN only)', async () => {
    const staffToken = await createToken('STAFF', '9000000018');
    const res = await request(app)
      .post(`/api/v1/admin/categories/${fixture.category.id}/subcategories`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ name: 'Zute line Saree', description: 'x', onlinePrice: 4999, storePrice: 4599 });
    expect(res.status).toBe(403);
  });

  it('lets STAFF list subcategories (read-only)', async () => {
    const staffToken = await createToken('STAFF', '9000000019');
    const res = await request(app)
      .get(`/api/v1/admin/categories/${fixture.category.id}/subcategories`)
      .set('Authorization', `Bearer ${staffToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.map((s: any) => s.id)).toContain(fixture.subcategory.id);
  });

  it('updating a subcategory price/description changes it for every product listed under it', async () => {
    const adminToken = await createToken('ADMIN', '9000000031');
    const subcategoryId = fixture.subcategory.id;

    const before = await request(app).get(`/api/v1/catalog/products/${fixture.products[0]!.slug}`);
    expect(Number(before.body.data.subcategory.onlinePrice)).toBe(12999);

    const patchRes = await request(app)
      .patch(`/api/v1/admin/subcategories/${subcategoryId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ onlinePrice: 15999, description: 'Updated description' });
    expect(patchRes.status).toBe(200);

    const afterA = await request(app).get(`/api/v1/catalog/products/${fixture.products[0]!.slug}`);
    const afterB = await request(app).get(`/api/v1/catalog/products/${fixture.products[1]!.slug}`);
    expect(Number(afterA.body.data.subcategory.onlinePrice)).toBe(15999);
    expect(Number(afterB.body.data.subcategory.onlinePrice)).toBe(15999);
    expect(afterA.body.data.subcategory.description).toBe('Updated description');
  });

  it('hiding a subcategory removes only its products from the public catalog, category stays visible', async () => {
    const adminToken = await createToken('ADMIN', '9000000032');
    const subcategoryId = fixture.subcategory.id;

    const hideRes = await request(app)
      .patch(`/api/v1/admin/subcategories/${subcategoryId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isActive: false });
    expect(hideRes.status).toBe(200);
    expect(hideRes.body.data.isActive).toBe(false);

    const categories = await request(app).get('/api/v1/catalog/categories');
    expect(categories.body.data.map((c: any) => c.id)).toContain(fixture.category.id);

    const productPage = await request(app).get(`/api/v1/catalog/products/${fixture.products[0]!.slug}`);
    expect(productPage.status).toBe(404);
  });

  it('returns 404 when updating an unknown subcategory', async () => {
    const adminToken = await createToken('ADMIN', '9000000033');
    const res = await request(app)
      .patch('/api/v1/admin/subcategories/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ onlinePrice: 1000 });
    expect(res.status).toBe(404);
  });
});

describe('catalog admin — products', () => {
  it('lets STAFF create a product with an auto-generated slug and SKU', async () => {
    const staffToken = await createToken('STAFF', '9000000020');

    const res = await request(app)
      .post('/api/v1/admin/products')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ name: 'Emerald Test Saree', categoryId: fixture.category.id, subcategoryId: fixture.subcategory.id, color: 'Emerald' });

    expect(res.status).toBe(201);
    expect(res.body.data.slug).toBe('emerald-test-saree');
    expect(res.body.data.sku).toMatch(/^NH-KS-\d{3}$/);
    expect(res.body.data.channelVisibility).toBe('both');
    expect(res.body.data.trackingMode).toBe('quantity');
  });

  // Assigning the scanned units in the same transaction is what stops a
  // product being listed at "0 in stock" when a follow-up call fails.
  it('assigns the barcodes sent with the create call, canonically, in one go', async () => {
    const staffToken = await createToken('STAFF', '9000000020');

    const res = await request(app)
      .post('/api/v1/admin/products')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        categoryId: fixture.category.id,
        subcategoryId: fixture.subcategory.id,
        trackingMode: 'serialized',
        barcodes: ['nandam-create-1', 'NANDAM-CREATE-2'],
      });

    expect(res.status).toBe(201);
    expect(res.body.data.availableCount).toBe(2);

    const stored = fake.db.piece
      .filter((p: any) => p.productId === res.body.data.id)
      .map((p: any) => p.barcode)
      .sort();
    expect(stored).toEqual(['NANDAM-CREATE-1', 'NANDAM-CREATE-2']);

    // ...and the tag resolves back to this product however it is scanned.
    const lookup = await request(app)
      .post('/api/v1/admin/inventory/scan-lookup')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ code: 'Nandam-Create-1' });
    expect(lookup.status).toBe(200);
    expect(lookup.body.data.productId).toBe(res.body.data.id);
  });

  it('creates no product at all when one of its barcodes is already taken', async () => {
    const staffToken = await createToken('STAFF', '9000000020');
    const taken = 'ALREADY-TAKEN-01';

    const first = await request(app)
      .post('/api/v1/admin/products')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ categoryId: fixture.category.id, subcategoryId: fixture.subcategory.id, barcodes: [taken] });
    expect(first.status).toBe(201);

    const productsBefore = fake.db.product.length;
    const second = await request(app)
      .post('/api/v1/admin/products')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ categoryId: fixture.category.id, subcategoryId: fixture.subcategory.id, barcodes: [taken.toLowerCase()] });

    expect(second.status).toBe(409);
    expect(second.body.code).toBe('BARCODE_ALREADY_ASSIGNED');
    // The exact wording staff see when a tag is reused for a new listing,
    // plus which product already holds it so they can go find that unit.
    expect(second.body.message).toBe('Barcode already used');
    expect(second.body.details).toEqual([
      expect.objectContaining({ barcode: taken, productName: expect.any(String) }),
    ]);
    // No half-created product left listed with no stock.
    expect(fake.db.product.length).toBe(productsBefore);
    expect(fake.db.piece.filter((p: any) => p.barcode === taken)).toHaveLength(1);
  });

  it('still creates a product when no barcodes are sent', async () => {
    const staffToken = await createToken('STAFF', '9000000020');

    const res = await request(app)
      .post('/api/v1/admin/products')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ categoryId: fixture.category.id, subcategoryId: fixture.subcategory.id });

    expect(res.status).toBe(201);
    expect(res.body.data.availableCount).toBe(0);
  });

  it('defaults an unnamed product to its subcategory name', async () => {
    const staffToken = await createToken('STAFF', '9000000035');

    const res = await request(app)
      .post('/api/v1/admin/products')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ categoryId: fixture.category.id, subcategoryId: fixture.subcategory.id, color: 'Emerald' });

    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe(fixture.subcategory.name);
    expect(res.body.data.slug).toBe('kanchi-border');
  });

  it('rejects creating a product without a subcategory', async () => {
    const staffToken = await createToken('STAFF', '9000000034');
    const res = await request(app)
      .post('/api/v1/admin/products')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ name: 'No Subcategory Product', categoryId: fixture.category.id, color: 'Emerald' });
    expect(res.status).toBe(400);
  });

  it('rejects creating a product against a nonexistent category', async () => {
    const staffToken = await createToken('STAFF', '9000000021');
    const res = await request(app)
      .post('/api/v1/admin/products')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ name: 'Orphan Product', categoryId: randomUUID(), subcategoryId: fixture.subcategory.id, color: 'Emerald' });
    expect(res.status).toBe(400);
  });

  it('rejects a subcategory that does not belong to the selected category', async () => {
    const adminToken = await createToken('ADMIN', '9000000035');
    const otherCategory = await request(app)
      .post('/api/v1/admin/categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Other Category', description: 'x' });
    const res = await request(app)
      .post('/api/v1/admin/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Mismatched Product', categoryId: otherCategory.body.data.id, subcategoryId: fixture.subcategory.id, color: 'Emerald' });
    expect(res.status).toBe(400);
  });

  it('updates a product (channel visibility) without touching price/description or stock', async () => {
    const staffToken = await createToken('STAFF', '9000000022');
    const productId = fixture.products[0]!.id;

    // `stock` is never client-settable — new stock only ever arrives via
    // scanned pieces (receivePieces), so a stray `stock` in the body is
    // silently ignored rather than applied.
    const res = await request(app)
      .patch(`/api/v1/admin/products/${productId}`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ channelVisibility: 'store_only', stock: 2 });

    expect(res.status).toBe(200);
    expect(res.body.data.channelVisibility).toBe('store_only');
    expect(res.body.data.stock).toBe(fixture.products[0]!.stock);

    // store_only products drop out of the public (online) catalog immediately.
    const publicLookup = await request(app).get(`/api/v1/catalog/products/${fixture.products[0]!.slug}`);
    expect(publicLookup.status).toBe(404);
  });

  it('blocks activating a product once the 5,000-active-listing cap is reached', async () => {
    for (let i = 0; i < ACTIVE_PRODUCT_CAP; i++) {
      fake.db.product.push({
        id: randomUUID(), slug: `cap-filler-${i}`, sku: `NH-CAP-${i}`, name: `Cap Filler ${i}`,
        categoryId: fixture.category.id, subcategoryId: fixture.subcategory.id, occasion: [], stock: 1,
        channelVisibility: 'both', trackingMode: 'quantity', isFeatured: false, isActive: true,
        createdAt: new Date(), updatedAt: new Date(),
      });
    }
    const adminToken = await createToken('ADMIN', '9000000023');

    const res = await request(app)
      .post('/api/v1/admin/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'One Too Many', categoryId: fixture.category.id, subcategoryId: fixture.subcategory.id, color: 'Emerald', isActive: true });

    expect(res.status).toBe(400);
    expect(res.body.details?.activeCount ?? res.body.details).toBeTruthy();
  });

  it('reports the current active-listing count and cap', async () => {
    const staffToken = await createToken('STAFF', '9000000024');
    const res = await request(app).get('/api/v1/admin/products/stats').set('Authorization', `Bearer ${staffToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.cap).toBe(ACTIVE_PRODUCT_CAP);
    expect(res.body.data.activeCount).toBe(fixture.products.length);
  });

  it('returns a clean 503 when uploading an image without storage configured', async () => {
    const staffToken = await createToken('STAFF', '9000000025');
    const res = await request(app)
      .post(`/api/v1/admin/products/${fixture.products[0]!.id}/image`)
      .set('Authorization', `Bearer ${staffToken}`)
      .attach('image', Buffer.from('fake-image-bytes'), { filename: 'photo.jpg', contentType: 'image/jpeg' });

    expect(res.status).toBe(503);
    expect(res.body.code).toBe('STORAGE_NOT_CONFIGURED');
  });
});
