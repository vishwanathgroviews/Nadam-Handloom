import { randomUUID } from 'crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../config/prisma', async () => {
  const { createFakePrisma } = await import('../../test/fakePrisma');
  const fake = createFakePrisma();
  return { prisma: fake.client, __fake: fake };
});

import * as prismaModule from '../../config/prisma';
import { seedCatalogFixture } from '../../test/fakePrisma';
import { listProducts, getProductBySlug, listCategories, listSubcategoriesForCategory } from './catalog.service';
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

  it("shows a subcategory's own photo, and the category photo when it has none", async () => {
    const { category: otherCategory } = pushBudgetCategoryProduct({
      categorySlug: 'handloom-cotton-saree-2', productSlug: 'cotton-with-photo', onlinePrice: 2999,
      subCategoryName: 'Plain Cotton Saree',
    });
    otherCategory.imageUrl = 'https://cdn.example.com/categories/cotton.jpg';

    const ownPhotoSub = fake.db.subcategory.find((x: any) => x.name === 'Plain Cotton Saree');
    ownPhotoSub.imageUrl = 'https://cdn.example.com/subcategories/plain-cotton.jpg';

    // A second subcategory with no photo of its own, to exercise the fallback.
    fake.db.subcategory.push({
      id: randomUUID(), categoryId: otherCategory.id, name: 'Checks Cotton Saree', description: 'Cotton sarees',
      imageUrl: null, sortOrder: 1, isActive: true, onlinePrice: 1999, storePrice: 1499, mrp: 2499,
      createdAt: new Date(), updatedAt: new Date(),
    });

    const result = await listSubcategoriesForCategory(otherCategory.slug);
    expect(result.category.slug).toBe(otherCategory.slug);
    expect(result.subcategories).toHaveLength(2);

    const withPhoto = result.subcategories.find((s: any) => s.name === 'Plain Cotton Saree');
    expect(withPhoto.imageUrl).toBe('https://cdn.example.com/subcategories/plain-cotton.jpg');

    const withoutPhoto = result.subcategories.find((s: any) => s.name === 'Checks Cotton Saree');
    expect(withoutPhoto.imageUrl).toBe('https://cdn.example.com/categories/cotton.jpg');
  });

  // A product's photo belongs to the product. Borrowing it for the
  // subcategory card meant listing, editing or deactivating a product
  // silently changed the subcategory's cover image on the storefront.
  it('never lets a product photo become the subcategory photo', async () => {
    const { category: otherCategory } = pushBudgetCategoryProduct({
      categorySlug: 'handloom-cotton-saree-3', productSlug: 'cotton-no-sub-photo', onlinePrice: 2999,
      subCategoryName: 'Screen Printed Dress Materials',
    });
    otherCategory.imageUrl = 'https://cdn.example.com/categories/cotton.jpg';

    const before = await listSubcategoriesForCategory(otherCategory.slug);
    const imageBefore = before.subcategories[0]!.imageUrl;

    // List a product under it, with a photo — exactly the flow that used to
    // move the subcategory's image.
    const listedProduct = fake.db.product.find((x: any) => x.slug === 'cotton-no-sub-photo');
    fake.db.productImage.push({
      id: randomUUID(), productId: listedProduct.id,
      url: 'https://cdn.example.com/products/just-listed.jpg', sortOrder: 0,
    });

    const after = await listSubcategoriesForCategory(otherCategory.slug);
    expect(after.subcategories[0]!.imageUrl).toBe(imageBefore);
    expect(after.subcategories[0]!.imageUrl).toBe('https://cdn.example.com/categories/cotton.jpg');
    expect(after.subcategories[0]!.imageUrl).not.toBe('https://cdn.example.com/products/just-listed.jpg');
  });

  it('throws NotFoundError listing subcategories for an unknown category', async () => {
    await expect(listSubcategoriesForCategory('does-not-exist')).rejects.toThrow(NotFoundError);
  });
});
