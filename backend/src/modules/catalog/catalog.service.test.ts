import { randomUUID } from 'crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../config/prisma', async () => {
  const { createFakePrisma } = await import('../../test/fakePrisma');
  const fake = createFakePrisma();
  return { prisma: fake.client, __fake: fake };
});

import * as prismaModule from '../../config/prisma';
import { seedCatalogFixture } from '../../test/fakePrisma';
import {
  listProducts,
  getProductBySlug,
  listCategories,
  listSubcategoriesForCategory,
  getAvailabilityForProducts,
} from './catalog.service';
import { listProductsQuerySchema } from './catalog.schema';
import { NotFoundError } from '../../utils/errors';

const fake = (prismaModule as any).__fake;

beforeEach(() => {
  for (const key of Object.keys(fake.db)) fake.db[key] = [];
  seedCatalogFixture(fake.db);
});

const parseQuery = (raw: Record<string, string>) => listProductsQuerySchema.parse(raw);

// Price is subcategory-level now — pushes a second category with its own
// subcategory + product so price filter/sort tests have two distinct price
// points to distinguish.
const pushBudgetCategoryProduct = (opts: {
  categorySlug: string;
  productSlug: string;
  onlinePrice: number;
  subCategoryName?: string;
}) => {
  const category = {
    id: randomUUID(), name: 'Budget Cotton', slug: opts.categorySlug, description: 'Cotton sarees',
    imageUrl: null, sortOrder: 2, isActive: true,
    createdAt: new Date(), updatedAt: new Date(),
  };
  fake.db.category.push(category);
  const subcategory = {
    id: randomUUID(), categoryId: category.id, name: opts.subCategoryName ?? 'Plain Cotton Saree',
    description: 'Cotton sarees', sortOrder: 0, isActive: true,
    onlinePrice: opts.onlinePrice, storePrice: opts.onlinePrice - 500, mrp: opts.onlinePrice + 1000,
    createdAt: new Date(), updatedAt: new Date(),
  };
  fake.db.subcategory.push(subcategory);
  fake.db.product.push({
    id: randomUUID(), slug: opts.productSlug, sku: `NH-TEST-${opts.productSlug}`, name: 'Budget Cotton Saree',
    categoryId: category.id, subcategoryId: subcategory.id, technique: null, borderStyle: null, purity: null, zariTier: null, blouseType: null,
    pattern: null, color: 'Ivory', fabric: 'Cotton', occasion: [], stock: 5,
    channelVisibility: 'both', trackingMode: 'quantity',
    isFeatured: false, isActive: true, createdAt: new Date(), updatedAt: new Date(),
  });
  return { category, subcategory };
};

describe('catalog.service', () => {
  it('lists active categories', async () => {
    const categories = await listCategories();
    expect(categories).toHaveLength(1);
    expect(categories[0]!.slug).toBe('kanjivaram-silk');
  });

  it('lists all products with default pagination', async () => {
    const result = await listProducts(parseQuery({}));
    expect(result.total).toBe(2);
    expect(result.items).toHaveLength(2);
    expect(result.items[0]!.images).toHaveLength(1);
  });

  it('filters by category slug', async () => {
    const result = await listProducts(parseQuery({ category: 'kanjivaram-silk' }));
    expect(result.total).toBe(2);

    const empty = await listProducts(parseQuery({ category: 'does-not-exist' }));
    expect(empty.total).toBe(0);
  });

  it('filters by attribute (technique)', async () => {
    const result = await listProducts(parseQuery({ technique: 'Plain' }));
    expect(result.total).toBe(1);
    expect(result.items[0]!.slug).toBe('magenta-plain-gold');
  });

  it('filters by price range (subcategory-level price)', async () => {
    pushBudgetCategoryProduct({ categorySlug: 'budget-cotton-range', productSlug: 'budget-cotton-range', onlinePrice: 2999 });

    const result = await listProducts(parseQuery({ minPrice: '2000', maxPrice: '5000' }));
    expect(result.total).toBe(1);
    expect(result.items[0]!.slug).toBe('budget-cotton-range');
  });

  it('excludes products whose subcategory is hidden and non-online products', async () => {
    const hidden = pushBudgetCategoryProduct({ categorySlug: 'hidden-subcategory', productSlug: 'hidden-subcategory-product', onlinePrice: 999 });
    hidden.subcategory.isActive = false;

    const storeOnly = pushBudgetCategoryProduct({ categorySlug: 'store-only-category', productSlug: 'store-only-product', onlinePrice: 999 });
    const storeOnlyProduct = fake.db.product.find((p: any) => p.slug === 'store-only-product');
    storeOnlyProduct.channelVisibility = 'store_only';
    void storeOnly;

    const result = await listProducts(parseQuery({}));
    expect(result.items.map((i: any) => i.slug)).not.toContain('hidden-subcategory-product');
    expect(result.items.map((i: any) => i.slug)).not.toContain('store-only-product');

    await expect(getProductBySlug('hidden-subcategory-product')).rejects.toThrow(NotFoundError);
    await expect(getProductBySlug('store-only-product')).rejects.toThrow(NotFoundError);
  });

  it('searches by free-text query', async () => {
    const result = await listProducts(parseQuery({ q: 'magenta' }));
    expect(result.total).toBe(1);
    expect(result.items[0]!.slug).toBe('magenta-plain-gold');
  });

  it('sorts by price ascending and descending', async () => {
    pushBudgetCategoryProduct({ categorySlug: 'budget-cotton-sort', productSlug: 'budget-cotton-sort', onlinePrice: 2999 });

    const asc = await listProducts(parseQuery({ sort: 'price_asc' }));
    expect(asc.items[0]!.slug).toBe('budget-cotton-sort');

    const desc = await listProducts(parseQuery({ sort: 'price_desc' }));
    expect(desc.items[0]!.slug).not.toBe('budget-cotton-sort');
  });

  it('fetches a single product by slug with images and subcategory pricing', async () => {
    const product = await getProductBySlug('rani-pink-kanjivaram');
    expect(product.name).toBe('Rani Pink Kanjivaram Silk Saree');
    expect(product.images).toHaveLength(1);
    expect(product.category.slug).toBe('kanjivaram-silk');
    expect(product.subcategory.name).toBe('Kanchi Border');
    expect(Number(product.subcategory.onlinePrice)).toBe(12999);
  });

  it('throws NotFoundError for an unknown or inactive product slug', async () => {
    await expect(getProductBySlug('nope')).rejects.toThrow(NotFoundError);
  });

  it('filters by subCategory name, scoped per category', async () => {
    pushBudgetCategoryProduct({
      categorySlug: 'handloom-cotton-saree',
      productSlug: 'test-cotton-saree',
      onlinePrice: 2999,
      subCategoryName: 'Plain Cotton Saree',
    });

    const result = await listProducts(parseQuery({ category: 'handloom-cotton-saree', subCategory: 'Plain Cotton Saree' }));
    expect(result.total).toBe(1);
    expect(result.items[0]!.slug).toBe('test-cotton-saree');

    const noMatch = await listProducts(parseQuery({ category: 'handloom-cotton-saree', subCategory: 'Cotton checks saree' }));
    expect(noMatch.total).toBe(0);
  });

  it('filters by subcategoryId', async () => {
    const { subcategory } = pushBudgetCategoryProduct({
      categorySlug: 'budget-cotton-by-id', productSlug: 'budget-cotton-by-id', onlinePrice: 2999,
    });

    const result = await listProducts(parseQuery({ subcategoryId: subcategory.id }));
    expect(result.total).toBe(1);
    expect(result.items[0]!.slug).toBe('budget-cotton-by-id');
  });

  it("shows a subcategory's own photo, and nothing when it has none", async () => {
    const { category: otherCategory } = pushBudgetCategoryProduct({
      categorySlug: 'handloom-cotton-saree-2', productSlug: 'cotton-with-photo', onlinePrice: 2999,
      subCategoryName: 'Plain Cotton Saree',
    });
    otherCategory.imageUrl = 'https://cdn.example.com/categories/cotton.jpg';

    const ownPhotoSub = fake.db.subcategory.find((x: any) => x.name === 'Plain Cotton Saree');
    ownPhotoSub.imageUrl = 'https://cdn.example.com/subcategories/plain-cotton.jpg';

    fake.db.subcategory.push({
      id: randomUUID(), categoryId: otherCategory.id, name: 'Checks Cotton Saree', description: 'Cotton sarees',
      imageUrl: null, sortOrder: 1, isActive: true, onlinePrice: 1999, storePrice: 1499, mrp: 2499,
      createdAt: new Date(), updatedAt: new Date(),
    });

    const result = await listSubcategoriesForCategory(otherCategory.slug);
    expect(result.subcategories).toHaveLength(2);

    const withPhoto = result.subcategories.find((s: any) => s.name === 'Plain Cotton Saree');
    expect(withPhoto.imageUrl).toBe('https://cdn.example.com/subcategories/plain-cotton.jpg');

    // Deliberately null, not the category's photo — see catalog.service.ts.
    const withoutPhoto = result.subcategories.find((s: any) => s.name === 'Checks Cotton Saree');
    expect(withoutPhoto.imageUrl).toBeNull();
  });

  // Changing a category's photo used to change the picture shown on every
  // subcategory under it that had none of its own.
  it("never lets the category photo become a subcategory's photo", async () => {
    const { category: otherCategory } = pushBudgetCategoryProduct({
      categorySlug: 'handloom-cotton-saree-4', productSlug: 'cotton-cat-photo', onlinePrice: 2999,
      subCategoryName: 'No Photo Subcategory',
    });
    const sub = fake.db.subcategory.find((x: any) => x.name === 'No Photo Subcategory');
    sub.imageUrl = null;

    otherCategory.imageUrl = 'https://cdn.example.com/categories/first.jpg';
    const before = await listSubcategoriesForCategory(otherCategory.slug);
    expect(before.subcategories[0]!.imageUrl).toBeNull();

    // Admin replaces the category photo — the subcategory must not move.
    otherCategory.imageUrl = 'https://cdn.example.com/categories/second.jpg';
    const after = await listSubcategoriesForCategory(otherCategory.slug);
    expect(after.subcategories[0]!.imageUrl).toBeNull();
    expect(after.category.imageUrl).toBe('https://cdn.example.com/categories/second.jpg');
  });

  // A product's photo belongs to the product. Borrowing it for the
  // subcategory card meant listing or editing a product silently changed
  // the subcategory's cover image on the storefront.
  it('never lets a product photo become the subcategory photo', async () => {
    const { category: otherCategory } = pushBudgetCategoryProduct({
      categorySlug: 'handloom-cotton-saree-3', productSlug: 'cotton-no-sub-photo', onlinePrice: 2999,
      subCategoryName: 'Screen Printed Dress Materials',
    });
    otherCategory.imageUrl = 'https://cdn.example.com/categories/cotton.jpg';
    const sub = fake.db.subcategory.find((x: any) => x.name === 'Screen Printed Dress Materials');
    sub.imageUrl = 'https://cdn.example.com/subcategories/screen-printed.jpg';

    const before = await listSubcategoriesForCategory(otherCategory.slug);
    const imageBefore = before.subcategories[0]!.imageUrl;

    const listedProduct = fake.db.product.find((x: any) => x.slug === 'cotton-no-sub-photo');
    fake.db.productImage.push({
      id: randomUUID(), productId: listedProduct.id,
      url: 'https://cdn.example.com/products/just-listed.jpg', sortOrder: 0,
    });

    const after = await listSubcategoriesForCategory(otherCategory.slug);
    expect(after.subcategories[0]!.imageUrl).toBe(imageBefore);
    expect(after.subcategories[0]!.imageUrl).toBe('https://cdn.example.com/subcategories/screen-printed.jpg');
  });

  // Checkout calls this before taking money. The atomic claim in
  // reserveItemsForOrder is still the real guard, but finding out an item
  // sold out at the Razorpay step is a bad way to learn it.
  it('reports live availability for the products in a cart', async () => {
    const product = fake.db.product[0];
    product.stock = 3;

    const [row] = await getAvailabilityForProducts([product.id]);
    expect(row.productId).toBe(product.id);
    expect(row.name).toBe(product.name);
    expect(row.availableCount).toBe(3);
    expect(row.isPurchasable).toBe(true);
  });

  it('counts in-stock pieces alongside the legacy stock counter', async () => {
    const product = fake.db.product[0];
    product.stock = 1;
    fake.db.piece.push(
      { id: randomUUID(), productId: product.id, barcode: 'PC-A', status: 'in_stock' },
      { id: randomUUID(), productId: product.id, barcode: 'PC-B', status: 'in_stock' },
      { id: randomUUID(), productId: product.id, barcode: 'PC-C', status: 'sold' },
    );

    const [row] = await getAvailabilityForProducts([product.id]);
    expect(row.availableCount).toBe(3);
  });

  it('marks a sold-out product unpurchasable', async () => {
    const product = fake.db.product[0];
    product.stock = 0;

    const [row] = await getAvailabilityForProducts([product.id]);
    expect(row.availableCount).toBe(0);
    expect(row.isPurchasable).toBe(false);
  });

  it('marks a deactivated or store-only product unpurchasable even with stock on hand', async () => {
    const [inactive, storeOnly] = fake.db.product;
    inactive.stock = 5;
    inactive.isActive = false;
    storeOnly.stock = 5;
    storeOnly.isActive = true;
    storeOnly.channelVisibility = 'store_only';

    const rows = await getAvailabilityForProducts([inactive.id, storeOnly.id]);
    expect(rows.every((r) => r.isPurchasable === false)).toBe(true);
    expect(rows.every((r) => r.availableCount === 0)).toBe(true);
  });

  // A product deleted since it went into the cart must still be reported
  // on, or the cart would quietly show one fewer line than it holds.
  it('reports an unknown product id as unavailable rather than dropping it', async () => {
    const missingId = randomUUID();
    const rows = await getAvailabilityForProducts([missingId]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({ productId: missingId, name: null, availableCount: 0, isPurchasable: false });
  });

  it('deduplicates ids and returns nothing for an empty cart', async () => {
    const product = fake.db.product[0];
    const rows = await getAvailabilityForProducts([product.id, product.id]);
    expect(rows).toHaveLength(1);
    expect(await getAvailabilityForProducts([])).toEqual([]);
  });

  it('throws NotFoundError listing subcategories for an unknown category', async () => {
    await expect(listSubcategoriesForCategory('does-not-exist')).rejects.toThrow(NotFoundError);
  });
});
