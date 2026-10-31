// Website W2–W4: home, catalogue, lists with filters, saree page, and the one visibility
// rule shared with the admin app (docs/modules/web-02-home-and-shop.md).
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import crypto from 'node:crypto';
import { forgetCatalog } from '../../../src/services/shop/catalog.service.js';
import { signedIn, authed } from '../../support/helpers.js';
import { api, prisma, SHOP } from '../../support/shop.js';

const id = () => String(crypto.randomInt(10_000_000, 99_999_999));
const T = id();
const SPEC = 'Material:Pattu by cotton \nPure handloom sarees\nModel: \nKanchi gap border \nContrast  blouse \nContrast pallu';
let cat;
let soonCat;
const col = {};
const p = {};

async function saree(key, collection, { pieces = ['in_stock'], channel = 'both', photo = true, isActive = true, daysAgo = 0 } = {}) {
  const row = await prisma.product.create({
    data: {
      slug: `test-${T}-${key}`, sku: `NH-T${T}-${key}`.toUpperCase(), name: collection.name, categoryId: cat.id, subcategoryId: collection.id,
      channelVisibility: channel, isActive, trackingMode: 'serialized', createdAt: new Date(Date.now() - daysAgo * 86400_000 - Object.keys(p).length * 1000),
      ...(photo ? { images: { create: [{ url: `https://example.test/${T}-${key}.jpg`, sortOrder: 0 }, { url: `https://example.test/${T}-${key}-2.jpg`, sortOrder: 1 }] } } : {}),
      pieces: { create: pieces.map((status, i) => ({ barcode: `T${T}${key}${i}`.toUpperCase(), status })) },
    },
  });
  p[key] = row;
  return row;
}

beforeAll(async () => {
  cat = await prisma.category.create({ data: { name: `TEST SAREES ${T}`, slug: `test-sarees-${T}`, description: '✨ TEST SAREES ✨\nHandwoven test sarees for the website tests, with borders and colour.', sortOrder: 999 } });
  const sub = (name, price, extra = {}) => prisma.subcategory.create({ data: { categoryId: cat.id, name, description: SPEC, onlinePrice: price, storePrice: price, mrp: 16999, ...extra } });
  col.pure = await sub(`Pure Pattu Butta ${T}`, 5800);
  col.kalam = await sub(`Hand painted Kalamkari ${T}`, 2600);
  col.cheap = await sub(`Plain cheap ${T}`, 9);
  col.hidden = await sub(`Hidden checks ${T}`, 3000, { isActive: false });
  await saree('set', col.pure, { pieces: ['in_stock', 'in_stock'] }); // a set of 2
  await saree('one', col.pure);
  await saree('sold', col.pure, { pieces: ['sold_online'] });
  await saree('store', col.kalam, { channel: 'store_only' });
  await saree('nophoto', col.kalam, { photo: false });
  await saree('kalam', col.kalam, { daysAgo: 30 });
  await saree('cheap', col.cheap);
  await saree('hidden', col.hidden);
  await saree('off', col.kalam, { isActive: false });
  // A category with nothing on the website yet: one collection waiting, one only for trying the app.
  soonCat = await prisma.category.create({ data: { name: `TEST SOON ${T}`, slug: `test-soon-${T}`, description: 'Handloom cotton test pieces coming to the website soon.', imageUrl: `https://example.test/${T}-soon.jpg`, sortOrder: 1000 } });
  const waiting = await prisma.subcategory.create({ data: { categoryId: soonCat.id, name: `TEMPLE BORDER WEAVES ${T}`, description: 'Temple border cotton.', onlinePrice: 2199, storePrice: 2199, mrp: 2199 } });
  await prisma.subcategory.create({ data: { categoryId: soonCat.id, name: 'Test1', description: 'Trial', onlinePrice: 10, storePrice: 10, mrp: 10 } });
  const trial = await prisma.product.create({ data: { slug: `test-${T}-trial`, sku: `NH-T${T}-TRIAL`, name: 'Trial piece', categoryId: soonCat.id, subcategoryId: waiting.id, channelVisibility: 'both', trackingMode: 'serialized', images: { create: [{ url: `https://example.test/${T}-trial.jpg`, sortOrder: 0 }] }, pieces: { create: [{ barcode: `T${T}TRIAL0`, status: 'in_stock' }] } } });
  await prisma.subcategory.update({ where: { id: waiting.id }, data: { onlinePrice: 200 } }); // a trial price: not on the website
  p.trial = trial;
});
beforeEach(() => forgetCatalog());

const list = (q = '') => api().get(`${SHOP}/products?category=${cat.slug}${q}`);

describe('which sarees are on the website', () => {
  it('in stock, switched on, online, active category and collection, a photo and a believable price', async () => {
    const r = await list();
    expect(r.status).toBe(200);
    expect(r.body.items.map((x) => x.slug).sort()).toEqual([p.kalam.slug, p.one.slug, p.set.slug].sort());
    expect(r.body.total).toBe(3);
  });

  it('a card has what the website shows', async () => {
    const r = await list('&sort=price-desc');
    const card = r.body.items.find((x) => x.slug === p.set.slug);
    expect(card).toMatchObject({
      sku: p.set.sku, name: col.pure.name, collection: { id: col.pure.id, name: col.pure.name }, category: cat.slug,
      craft: 'pure', price: 5800, available: 2, isNew: true, photo: { url: `https://example.test/${T}-set.jpg` },
    });
    expect(r.body.items.find((x) => x.slug === p.kalam.slug).isNew).toBe(false);
  });

  it('the admin app says why a saree is not on the website, with the same rule', async () => {
    const { session, device } = await signedIn({ role: 'ADMIN' });
    const why = async (key) => (await authed('get', `/api/v2/products/${p[key].id}`, session, device)).body.product?.website?.text
      ?? (await authed('get', `/api/v2/products/${p[key].id}`, session, device)).body.website?.text;
    expect(await why('nophoto')).toBe('Not on the website: it needs a photo.');
    expect(await why('cheap')).toBe('Not on the website: its website price (₹9) looks wrong. Fix the subcategory\'s price.');
    expect(await why('store')).toBe('Not on the website: set to Store only.');
    expect(await why('one')).toBe('On the website and at the counter now.');
  });
});

describe('lists', () => {
  it('sets only: designs with more than one piece in stock', async () => {
    const r = await list('&sets=1');
    expect(r.body.items.map((x) => x.slug)).toEqual([p.set.slug]);
  });

  it('craft, price band and collection filters, with counts beside each option', async () => {
    const r = await list('&craft=kalamkari');
    expect(r.body.items.map((x) => x.slug)).toEqual([p.kalam.slug]);
    const craft = Object.fromEntries(r.body.facets.craft.map((f) => [f.key, f.count]));
    expect(craft.kalamkari).toBe(1);
    expect(craft.pure).toBe(2);
    const price = Object.fromEntries(r.body.facets.price.map((f) => [f.key, f.count]));
    expect(price).toMatchObject({ '25-35': 1 });
    const o50 = await list('&price=o50');
    expect(o50.body.total).toBe(2);
    const byCol = await list(`&collection=${col.kalam.id}`);
    expect(byCol.body.total).toBe(1);
    expect(byCol.body.facets.collection.map((f) => f.key).sort()).toEqual([col.kalam.id, col.pure.id].sort());
  });

  it('several crafts at once (an edit)', async () => {
    const r = await list('&craft=kalamkari,pure');
    expect(r.body.total).toBe(3);
  });

  it('sorting by price both ways, newest by default', async () => {
    expect((await list('&sort=price-asc')).body.items[0].slug).toBe(p.kalam.slug);
    expect((await list('&sort=price-desc')).body.items.at(-1).slug).toBe(p.kalam.slug);
    expect((await list()).body.items.at(-1).slug).toBe(p.kalam.slug);
  });

  it('pages of results with the next page\'s start', async () => {
    const a = await list('&limit=2');
    expect(a.body).toMatchObject({ total: 3, offset: 0, limit: 2, nextOffset: 2 });
    const b = await list('&limit=2&offset=2');
    expect(b.body.items).toHaveLength(1);
    expect(b.body.nextOffset).toBeNull();
  });

  it('search by name, collection, SKU or craft', async () => {
    const r = await api().get(`${SHOP}/products?q=${encodeURIComponent(p.one.sku)}`);
    expect(r.body.items.map((x) => x.slug)).toEqual([p.one.slug]);
    const words = await api().get(`${SHOP}/products?q=${encodeURIComponent(`kalamkari ${T}`)}`);
    expect(words.body.items.map((x) => x.slug)).toEqual([p.kalam.slug]);
    // "kalankari" is nowhere in the saree's name, but it is the kalamkari craft.
    const craft = await api().get(`${SHOP}/products?q=${encodeURIComponent(`kalankari ${T}`)}`);
    expect(craft.body.items.map((x) => x.slug)).toEqual([p.kalam.slug]);
    const none = await api().get(`${SHOP}/products?q=${encodeURIComponent(`embroidered ${T}`)}`);
    expect(none.body.total).toBe(0);
  });

  it('unknown or old values in a link are ignored, never an error', async () => {
    const r = await api().get(`${SHOP}/products?category=${cat.slug}&craft=nonsense&price=zzz&sort=odd&offset=-4&limit=5000&sets=maybe`);
    expect(r.status).toBe(200);
    expect(r.body.total).toBe(3);
    expect(r.body.limit).toBe(24);
  });

  it('can be cached for a minute and is never personal', async () => {
    const r = await list();
    expect(r.headers['cache-control']).toBe('public, max-age=60');
  });
});

describe('catalogue and home', () => {
  it('the catalogue lists the category with its two visible collections', async () => {
    const r = await api().get(`${SHOP}/catalog`);
    expect(r.status).toBe(200);
    const c = r.body.categories.find((x) => x.slug === cat.slug);
    expect(c).toMatchObject({ name: `Test Sarees ${T}`, count: 3, collections: 2 });
    expect(c.description).toBe('Handwoven test sarees for the website tests, with borders and colour.');
    const mine = r.body.collections.filter((x) => x.category === cat.slug);
    expect(mine.map((x) => x.id).sort()).toEqual([col.kalam.id, col.pure.id].sort());
    expect(mine.find((x) => x.id === col.pure.id)).toMatchObject({ price: 5800, band: 'o50', craft: 'pure', count: 2, sets: 1 });
    expect(r.body.priceBands.map((b) => b.key)).toEqual(['u25', '25-35', '35-50', 'o50']);
  });

  it('each collection says when its newest saree came in (Latest collections)', async () => {
    const r = await api().get(`${SHOP}/catalog`);
    const pure = r.body.collections.find((x) => x.id === col.pure.id);
    const kalam = r.body.collections.find((x) => x.id === col.kalam.id);
    expect(pure.hasNew).toBe(true);
    expect(kalam.hasNew).toBe(false); // its only saree on the website came 30 days ago
    expect(Date.now() - new Date(kalam.newest).getTime()).toBeGreaterThan(29 * 86400_000);
    expect(new Date(pure.newest).getTime()).toBeGreaterThan(new Date(kalam.newest).getTime());
    expect(r.body.totals.newSarees).toBeGreaterThanOrEqual(2);
    expect(r.body.totals.newSarees).toBeLessThanOrEqual(r.body.totals.sarees);
  });

  it('a category with nothing on the website yet is "coming soon", with its collections but never a trial one', async () => {
    const r = await api().get(`${SHOP}/catalog`);
    expect(r.body.categories.some((x) => x.slug === soonCat.slug)).toBe(false);
    const soon = r.body.soon.find((x) => x.slug === soonCat.slug);
    expect(soon).toEqual({
      slug: soonCat.slug, name: `Test Soon ${T}`, description: 'Handloom cotton test pieces coming to the website soon.',
      image: `https://example.test/${T}-soon.jpg`, upcoming: [`Temple Border Weaves ${T}`],
    });
    expect(r.body.soon.some((x) => x.slug === cat.slug)).toBe(false);
    // Its trial piece stays off the website.
    expect((await api().get(`${SHOP}/products/${p.trial.slug}`)).status).toBe(404);
  });

  it('home: newest sarees, a pure pattu spotlight, sets, edits and the store', async () => {
    const r = await api().get(`${SHOP}/home`);
    expect(r.status).toBe(200);
    expect(r.body.newest.length).toBeGreaterThan(0);
    expect(r.body.newest.some((x) => x.slug === p.one.slug || x.slug === p.set.slug)).toBe(true);
    expect(r.body.sets.every((x) => x.available > 1)).toBe(true);
    expect(r.body.edits.map((e) => e.key)).toEqual(expect.arrayContaining(['wedding', 'family']));
    expect(r.body.store).toMatchObject({ hours: 'Monday to Sunday, 9:30 am to 8:30 pm', whatsapp: '917382388565', mapUrl: expect.stringContaining('maps') });
    expect(r.body.spotlight.collection.name).toMatch(/pure pattu/i);
  });
});

describe('saree page', () => {
  it('a saree on sale: photos, highlights from the collection\'s notes, more from the collection', async () => {
    const r = await api().get(`${SHOP}/products/${p.set.slug}`);
    expect(r.status).toBe(200);
    expect(r.body.product).toMatchObject({ slug: p.set.slug, price: 5800, available: 2, soldOut: false, craftName: 'Pure Pattu & Plain', category: { slug: cat.slug } });
    expect(r.body.product.photos).toHaveLength(2);
    expect(r.body.product.highlights).toEqual(['Material: Pattu by cotton', 'Pure handloom sarees', 'Kanchi gap border', 'Contrast blouse', 'Contrast pallu']);
    expect(r.body.more.map((x) => x.slug)).toEqual([p.one.slug]);
  });

  it('a sold-out saree still opens, marked sold out', async () => {
    const r = await api().get(`${SHOP}/products/${p.sold.slug}`);
    expect(r.status).toBe(200);
    expect(r.body.product).toMatchObject({ soldOut: true, available: 0 });
  });

  it('hidden, store-only, switched-off, no photo or a wrong price: not found', async () => {
    for (const key of ['store', 'nophoto', 'cheap', 'hidden', 'off']) {
      const r = await api().get(`${SHOP}/products/${p[key].slug}`);
      expect(r.status, key).toBe(404);
      expect(r.body.error.code).toBe('PRODUCT_NOT_FOUND');
    }
    expect((await api().get(`${SHOP}/products/no-such-saree-${T}`)).status).toBe(404);
    expect((await api().get(`${SHOP}/products/bad%20slug!`)).status).toBe(400);
  });
});
