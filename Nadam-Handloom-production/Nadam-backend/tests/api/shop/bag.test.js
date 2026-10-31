// Website W5: the bag (docs/modules/web-03-cart.md). A visitor's bag checked (nothing kept),
// a signed-in customer's bag kept per saree, joining at sign-in, limits, account deletion and
// the 60-day clean-up.
import { describe, it, expect, beforeAll } from 'vitest';
import crypto from 'node:crypto';
import { runCleanup } from '../../../src/jobs/cleanup.job.js';
import { api, prisma, SHOP, signUp, as } from '../../support/shop.js';

const DAY = 86400_000;
const T = String(crypto.randomInt(10_000_000, 99_999_999));
let cat;
const col = {};
const p = {};
let n = 0;

async function saree(key, collection, { pieces = ['in_stock'], channel = 'both', photo = true, isActive = true } = {}) {
  n += 1;
  const row = await prisma.product.create({
    data: {
      slug: `bag-${T}-${key}`, sku: `NH-B${T}-${key}`.toUpperCase(), name: collection.name, categoryId: cat.id, subcategoryId: collection.id,
      channelVisibility: channel, isActive, trackingMode: 'serialized', createdAt: new Date(Date.now() - n * 1000),
      ...(photo ? { images: { create: [{ url: `https://example.test/${T}-${key}.jpg`, sortOrder: 0, altText: `${collection.name} photo` }] } } : {}),
      pieces: { create: pieces.map((status, i) => ({ barcode: `B${T}${key}${i}`.toUpperCase(), status })) },
    },
  });
  p[key] = row;
  return row;
}

const check = (items) => api().post(`${SHOP}/bag/check`).send({ items });
const line = (body, key) => body.items.find((l) => l.slug === p[key].slug);
const item = (key, quantity = 1, priceSeen) => ({ slug: p[key].slug, quantity, ...(priceSeen != null ? { priceSeen } : {}) });

beforeAll(async () => {
  cat = await prisma.category.create({ data: { name: `BAG TEST ${T}`, slug: `bag-test-${T}`, description: 'Bag test sarees', sortOrder: 998 } });
  const sub = (name, price, extra = {}) => prisma.subcategory.create({ data: { categoryId: cat.id, name, description: 'Pure handloom', onlinePrice: price, storePrice: price, mrp: 16999, ...extra } });
  col.pure = await sub(`Pure Pattu Butta ${T}`, 5800);
  col.plain = await sub(`Plain Saree ${T}`, 2700);
  col.cheap = await sub(`Cheap ${T}`, 9);
  col.hidden = await sub(`Hidden ${T}`, 3000, { isActive: false });
  col.many = await sub(`Many ${T}`, 1800);
  await saree('one', col.pure);
  await saree('two', col.pure);
  await saree('set', col.plain, { pieces: ['in_stock', 'in_stock'] });
  await saree('set5', col.plain, { pieces: ['in_stock', 'in_stock', 'in_stock', 'in_stock', 'in_stock'] });
  await saree('sold', col.pure, { pieces: ['sold_offline'] });
  await saree('store', col.pure, { channel: 'store_only' });
  await saree('off', col.pure, { isActive: false });
  await saree('nophoto', col.pure, { photo: false });
  await saree('cheap', col.cheap);
  await saree('hidden', col.hidden);
  for (let i = 0; i < 22; i += 1) await saree(`m${i}`, col.many);
});

describe('a visitor\'s bag: POST /bag/check (nothing kept)', () => {
  it('checks every line against today\'s stock and price, and adds it up', async () => {
    const r = await check([item('one', 1, 5800), item('set', 2, 2700)]);
    expect(r.status).toBe(200);
    expect(r.headers['cache-control']).toBe('no-store');
    expect(line(r.body, 'one')).toEqual({
      slug: p.one.slug, sku: p.one.sku, name: col.pure.name, collection: { id: col.pure.id, name: col.pure.name },
      category: { slug: cat.slug, name: `Bag Test ${T}` }, craftName: 'Pure Pattu & Plain', photo: { url: `https://example.test/${T}-one.jpg`, alt: `${col.pure.name} photo` },
      price: 5800, priceWas: null, available: 1, asked: 1, quantity: 1, lineTotal: 5800, state: 'ok',
    });
    expect(line(r.body, 'set')).toMatchObject({ available: 2, quantity: 2, lineTotal: 5400, state: 'ok' });
    expect(r.body.totals).toEqual({ lines: 2, buyableLines: 2, pieces: 3, amount: 11200 });
    expect(r.body.changes).toEqual({ soldOut: 0, unavailable: 0, fewer: 0, priceChanged: 0, notFound: 0 });
    expect(r.body.maxLines).toBe(20);
    expect(Number.isNaN(Date.parse(r.body.checkedAt))).toBe(false);
    expect(await prisma.bagItem.count({ where: { product: { categoryId: cat.id } } })).toBe(0);
  });

  it('fewer left than asked: the number is lowered to the stock', async () => {
    const r = await check([item('set', 4)]);
    expect(line(r.body, 'set')).toMatchObject({ state: 'fewer', asked: 4, quantity: 2, available: 2, lineTotal: 5400 });
    expect(r.body.changes.fewer).toBe(1);
  });

  it('sold out: still described, not counted', async () => {
    const r = await check([item('sold'), item('one')]);
    expect(line(r.body, 'sold')).toMatchObject({ state: 'sold_out', name: col.pure.name, sku: p.sold.sku, price: 5800, available: 0, quantity: 0, lineTotal: 0 });
    expect(r.body.totals).toEqual({ lines: 2, buyableLines: 1, pieces: 1, amount: 5800 });
    expect(r.body.changes.soldOut).toBe(1);
  });

  it('no longer on the website (Store only, switched off, no photo, a wrong price, hidden collection): not described to a stranger', async () => {
    const keys = ['store', 'off', 'nophoto', 'cheap', 'hidden'];
    const r = await check(keys.map((k) => item(k)));
    for (const k of keys) expect(line(r.body, k)).toEqual({ slug: p[k].slug, state: 'unavailable', asked: 1, available: 0, quantity: 0, lineTotal: 0, priceWas: null });
    expect(r.body.changes.unavailable).toBe(5);
    expect(r.body.totals.amount).toBe(0);
  });

  it('a link that never existed comes back as not_found (the website drops it)', async () => {
    const r = await check([{ slug: `nothing-${T}`, quantity: 1 }]);
    expect(r.body.items).toEqual([{ slug: `nothing-${T}`, state: 'not_found', asked: 1, quantity: 0, lineTotal: 0, priceWas: null }]);
    expect(r.body.totals.lines).toBe(0);
    expect(r.body.changes.notFound).toBe(1);
  });

  it('a new price shows the old one; the same price or none sent shows nothing', async () => {
    const r = await check([item('one', 1, 5200), item('two', 1, 5800), item('set', 1)]);
    expect(line(r.body, 'one')).toMatchObject({ price: 5800, priceWas: 5200, lineTotal: 5800 });
    expect(line(r.body, 'two').priceWas).toBeNull();
    expect(line(r.body, 'set').priceWas).toBeNull();
    expect(r.body.changes.priceChanged).toBe(1);
  });

  it('the same saree twice: one line with the larger number', async () => {
    const r = await check([item('set5', 2), item('set5', 4), item('set5', 1)]);
    expect(r.body.items).toHaveLength(1);
    expect(line(r.body, 'set5')).toMatchObject({ asked: 4, quantity: 4 });
  });

  it('an empty bag is fine', async () => {
    const r = await check([]);
    expect(r.status).toBe(200);
    expect(r.body.totals).toEqual({ lines: 0, buyableLines: 0, pieces: 0, amount: 0 });
  });

  it('refuses broken or oversized bags', async () => {
    const bad = async (body, field) => {
      const r = await api().post(`${SHOP}/bag/check`).send(body);
      expect(r.status).toBe(400);
      expect(r.body.error.code).toBe('VALIDATION_FAILED');
      if (field) expect(r.body.error.details.issues[0].field).toBe(field);
      return r;
    };
    await bad({}, 'items');
    await bad({ items: 'x' }, 'items');
    expect((await bad({ items: Array.from({ length: 21 }, (_, i) => ({ slug: `s-${i}`, quantity: 1 })) })).body.error.message).toBe('A bag holds at most 20 sarees.');
    await bad({ items: [{ slug: p.one.slug, quantity: 0 }] }, 'items.0.quantity');
    await bad({ items: [{ slug: p.one.slug, quantity: 51 }] }, 'items.0.quantity');
    await bad({ items: [{ slug: p.one.slug, quantity: 1.5 }] }, 'items.0.quantity');
    await bad({ items: [{ slug: p.one.slug, quantity: '2' }] }, 'items.0.quantity');
    await bad({ items: [{ slug: 'drop table;', quantity: 1 }] }, 'items.0.slug');
    await bad({ items: [{ slug: 'x'.repeat(161), quantity: 1 }] }, 'items.0.slug');
  });

  it('a broken price seen is ignored, not an error', async () => {
    const r = await check([{ slug: p.one.slug, quantity: 1, priceSeen: 'abc' }]);
    expect(r.status).toBe(200);
    expect(line(r.body, 'one').priceWas).toBeNull();
  });
});

describe('a signed-in customer\'s bag: /me/bag', () => {
  it('needs a sign-in', async () => {
    for (const [m, path] of [['get', '/me/bag'], ['put', `/me/bag/items/${p.one.slug}`], ['delete', `/me/bag/items/${p.one.slug}`], ['post', '/me/bag/merge'], ['delete', '/me/bag']]) {
      const r = await api()[m](`${SHOP}${path}`).send({});
      expect(r.status).toBe(401);
      expect(r.body.error.code).toBe('NOT_SIGNED_IN');
    }
  });

  it('add, change pieces, remove, empty; only this customer sees it', async () => {
    const who = await signUp();
    const other = await signUp();
    const call = as(who);
    expect((await call('get', '/me/bag')).body.items).toEqual([]);

    let r = await call('put', `/me/bag/items/${p.one.slug}`).send({ quantity: 1, priceSeen: 5800 });
    expect(r.status).toBe(200);
    expect(r.headers['cache-control']).toBe('no-store');
    r = await call('put', `/me/bag/items/${p.set5.slug}`).send({ quantity: 2, priceSeen: 2700 });
    expect(r.body.items.map((l) => l.slug)).toEqual([p.one.slug, p.set5.slug]);
    expect(r.body.totals).toEqual({ lines: 2, buyableLines: 2, pieces: 3, amount: 11200 });

    r = await call('put', `/me/bag/items/${p.set5.slug}`).send({ quantity: 4 });
    expect(line(r.body, 'set5')).toMatchObject({ quantity: 4, state: 'ok' });
    expect((await call('get', '/me/bag')).body.totals.pieces).toBe(5);
    expect((await as(other)('get', '/me/bag')).body.items).toEqual([]);

    r = await call('delete', `/me/bag/items/${p.one.slug}`);
    expect(r.body.items.map((l) => l.slug)).toEqual([p.set5.slug]);
    expect((await call('delete', `/me/bag/items/${p.one.slug}`)).status).toBe(200); // already gone: fine

    r = await call('delete', '/me/bag');
    expect(r.body.items).toEqual([]);
    expect(await prisma.bagItem.count({ where: { authAccountId: who.customer.id } })).toBe(0);
  });

  it('more pieces than in stock: saved as the stock, and said so', async () => {
    const who = await signUp();
    const r = await as(who)('put', `/me/bag/items/${p.set.slug}`).send({ quantity: 5 });
    expect(line(r.body, 'set')).toMatchObject({ state: 'fewer', asked: 5, quantity: 2 });
    expect((await prisma.bagItem.findFirst({ where: { authAccountId: who.customer.id } })).quantity).toBe(2);
    expect(line((await as(who)('get', '/me/bag')).body, 'set')).toMatchObject({ state: 'ok', quantity: 2 });
  });

  it('refuses sarees that are sold out or not on the website', async () => {
    const call = as(await signUp());
    let r = await call('put', `/me/bag/items/${p.sold.slug}`).send({ quantity: 1 });
    expect(r.status).toBe(409);
    expect(r.body.error).toMatchObject({ code: 'SOLD_OUT', message: 'This saree has just sold out.' });
    for (const k of ['store', 'off', 'nophoto', 'cheap', 'hidden']) {
      r = await call('put', `/me/bag/items/${p[k].slug}`).send({ quantity: 1 });
      expect(r.status).toBe(404);
      expect(r.body.error).toMatchObject({ code: 'NOT_ON_WEBSITE', message: 'This saree is no longer on the website.' });
    }
    r = await call('put', `/me/bag/items/nothing-${T}`).send({ quantity: 1 });
    expect(r.body.error.code).toBe('NOT_ON_WEBSITE');
    r = await call('put', `/me/bag/items/${p.one.slug}`).send({ quantity: 0 });
    expect(r.body.error.code).toBe('VALIDATION_FAILED');
    r = await call('put', '/me/bag/items/bad%20slug').send({ quantity: 1 });
    expect(r.body.error.code).toBe('VALIDATION_FAILED');
  });

  it('a saree that sells or leaves the website stays in the bag, marked, not counted', async () => {
    const extra = await saree(`late-${crypto.randomInt(1e6)}`, col.pure);
    const who = await signUp();
    const call = as(who);
    await call('put', `/me/bag/items/${extra.slug}`).send({ quantity: 1 });
    await call('put', `/me/bag/items/${p.two.slug}`).send({ quantity: 1 });
    await prisma.piece.updateMany({ where: { productId: extra.id }, data: { status: 'sold_offline' } });
    let r = await call('get', '/me/bag');
    expect(r.body.items.find((l) => l.slug === extra.slug)).toMatchObject({ state: 'sold_out', quantity: 0, name: col.pure.name });
    expect(r.body.totals).toMatchObject({ lines: 2, buyableLines: 1, amount: 5800 });
    await prisma.product.update({ where: { id: extra.id }, data: { channelVisibility: 'store_only' } });
    r = await call('get', '/me/bag');
    // The customer added it while it was on the website, so their bag still names it.
    expect(r.body.items.find((l) => l.slug === extra.slug)).toMatchObject({ state: 'unavailable', name: col.pure.name, sku: extra.sku });
    expect(await prisma.bagItem.count({ where: { authAccountId: who.customer.id } })).toBe(2);
  });

  it('fewer left than saved: lowered once, and never raised again by itself', async () => {
    const extra = await saree(`set-${crypto.randomInt(1e6)}`, col.plain, { pieces: ['in_stock', 'in_stock', 'in_stock', 'in_stock'] });
    const who = await signUp();
    const call = as(who);
    await call('put', `/me/bag/items/${extra.slug}`).send({ quantity: 4 });
    const pieces = await prisma.piece.findMany({ where: { productId: extra.id }, orderBy: { barcode: 'asc' } });
    await prisma.piece.updateMany({ where: { id: { in: pieces.slice(0, 2).map((x) => x.id) } }, data: { status: 'sold_offline' } });
    let r = await call('get', '/me/bag');
    expect(r.body.items[0]).toMatchObject({ state: 'fewer', asked: 4, quantity: 2 });
    r = await call('get', '/me/bag');
    expect(r.body.items[0]).toMatchObject({ state: 'ok', asked: 2, quantity: 2 });
    await prisma.piece.updateMany({ where: { productId: extra.id }, data: { status: 'in_stock' } });
    r = await call('get', '/me/bag');
    expect(r.body.items[0]).toMatchObject({ state: 'ok', quantity: 2, available: 4 });
  });

  it('a new price is shown until the customer changes the bag', async () => {
    const who = await signUp();
    const call = as(who);
    await call('put', `/me/bag/items/${p.one.slug}`).send({ quantity: 1, priceSeen: 5200 });
    let r = await call('get', '/me/bag');
    expect(line(r.body, 'one')).toMatchObject({ price: 5800, priceWas: 5200 });
    expect(r.body.changes.priceChanged).toBe(1);
    r = await call('put', `/me/bag/items/${p.two.slug}`).send({ quantity: 1 });
    expect(line(r.body, 'one').priceWas).toBeNull();
    expect(Number((await prisma.bagItem.findFirst({ where: { authAccountId: who.customer.id, productId: p.one.id } })).priceSeen)).toBe(5800);
  });

  it('at most 20 different sarees, also when 5 are added at the same moment', async () => {
    const who = await signUp();
    const call = as(who);
    for (let i = 0; i < 18; i += 1) expect((await call('put', `/me/bag/items/${p[`m${i}`].slug}`).send({ quantity: 1 })).status).toBe(200);
    const rs = await Promise.all([18, 19, 20, 21].map((i) => call('put', `/me/bag/items/${p[`m${i}`].slug}`).send({ quantity: 1 })).concat([call('put', `/me/bag/items/${p.one.slug}`).send({ quantity: 1 })]));
    expect(rs.filter((x) => x.status === 200)).toHaveLength(2);
    const full = rs.filter((x) => x.status === 409);
    expect(full).toHaveLength(3);
    expect(full[0].body.error).toMatchObject({ code: 'BAG_FULL', message: 'Your bag is full (20 sarees). Remove one to add another.', details: { maxLines: 20 } });
    expect(await prisma.bagItem.count({ where: { authAccountId: who.customer.id } })).toBe(20);
    // Changing the pieces of a saree already in a full bag still works.
    expect((await call('put', `/me/bag/items/${p.m0.slug}`).send({ quantity: 1 })).status).toBe(200);
  });

  it('the database itself refuses 0 or more than 50 pieces', async () => {
    const who = await signUp();
    await expect(prisma.bagItem.create({ data: { authAccountId: who.customer.id, productId: p.one.id, quantity: 0, priceSeen: 5800 } })).rejects.toThrow();
    await expect(prisma.bagItem.create({ data: { authAccountId: who.customer.id, productId: p.one.id, quantity: 51, priceSeen: 5800 } })).rejects.toThrow();
  });
});

describe('signing in joins the bags: POST /me/bag/merge', () => {
  it('adds new sarees, keeps the larger number (never the sum), skips what can\'t be bought', async () => {
    const who = await signUp();
    const call = as(who);
    await call('put', `/me/bag/items/${p.set5.slug}`).send({ quantity: 2 });
    await call('put', `/me/bag/items/${p.two.slug}`).send({ quantity: 1 });
    const browser = [item('one', 1, 5800), item('set5', 3, 2700), item('two', 1), item('sold'), item('store'), { slug: `nothing-${T}`, quantity: 1 }];
    let r = await call('post', '/me/bag/merge').send({ items: browser });
    expect(r.status).toBe(200);
    expect(r.body.joined).toEqual({ added: 1, raised: 1, skipped: 3 });
    expect(r.body.items.map((l) => [l.slug, l.quantity])).toEqual([[p.set5.slug, 3], [p.two.slug, 1], [p.one.slug, 1]]);
    // The same browser bag again (a second tab signing in): nothing doubles.
    r = await call('post', '/me/bag/merge').send({ items: browser });
    expect(r.body.joined).toEqual({ added: 0, raised: 0, skipped: 3 });
    expect(r.body.totals.pieces).toBe(5);
  });

  it('a set larger than the stock is capped; a full bag skips the rest', async () => {
    const who = await signUp();
    const call = as(who);
    for (let i = 0; i < 19; i += 1) await call('put', `/me/bag/items/${p[`m${i}`].slug}`).send({ quantity: 1 });
    const r = await call('post', '/me/bag/merge').send({ items: [item('set', 9), item('one'), item('two')] });
    expect(r.body.joined).toEqual({ added: 1, raised: 0, skipped: 2 });
    expect(line(r.body, 'set')).toMatchObject({ quantity: 2 });
    expect(r.body.items).toHaveLength(20);
  });
});

describe('the bag is forgotten', () => {
  it('when the account is deleted', async () => {
    const who = await signUp();
    await as(who)('put', `/me/bag/items/${p.one.slug}`).send({ quantity: 1 });
    expect((await as(who)('post', '/me/delete-request').send({})).status).toBe(200);
    await prisma.userProfile.update({ where: { authAccountId: who.customer.id }, data: { deleteRequestedAt: new Date(Date.now() - 8 * DAY) } });
    await runCleanup();
    expect((await prisma.authAccount.findUnique({ where: { id: who.customer.id } })).status).toBe('deleted');
    expect(await prisma.bagItem.count({ where: { authAccountId: who.customer.id } })).toBe(0);
  });

  it('a saree left unchanged for 60 days goes; recent ones stay', async () => {
    const who = await signUp();
    await as(who)('put', `/me/bag/items/${p.one.slug}`).send({ quantity: 1 });
    await as(who)('put', `/me/bag/items/${p.two.slug}`).send({ quantity: 1 });
    await prisma.$executeRaw`UPDATE "BagItem" SET "updatedAt" = now() - interval '61 days' WHERE "authAccountId" = ${who.customer.id} AND "productId" = ${p.one.id}`;
    const out = await runCleanup();
    expect(out.bagItems).toBeGreaterThanOrEqual(1);
    const left = await prisma.bagItem.findMany({ where: { authAccountId: who.customer.id } });
    expect(left.map((x) => x.productId)).toEqual([p.two.id]);
  });
});

describe('the website reads the limits', () => {
  it('/config has the bag limits', async () => {
    const r = await api().get(`${SHOP}/config`);
    expect(r.body.limits.bag).toEqual({ maxLines: 20, maxQuantity: 50, keepDays: 60 });
  });
});
