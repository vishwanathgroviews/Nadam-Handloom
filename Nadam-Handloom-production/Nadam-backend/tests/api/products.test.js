// Module 4 (Products and barcodes): the rules in plan sections 6, 6A, 8 and 13.
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import sharp from 'sharp';
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { api, prisma, signedIn, authed } from '../support/helpers.js';
import { LIMITS } from '../../src/services/product.service.js';

const C = '/api/v2/catalog';
const PR = '/api/v2/products';
const uid = () => crypto.randomUUID().slice(0, 8);
// Tag numbers far above the shop's real ones (they stop near 12,000).
let seq = Math.floor(Math.random() * 400000) + 9100000;
const newTag = (prefix = 'NH') => `${prefix}${seq++}`;
let owner;
let staff;
let jpeg;
beforeAll(async () => {
  owner = await signedIn({ role: 'ADMIN', name: 'Prod' });
  staff = await signedIn({ role: 'STAFF', name: 'Lakshmi' });
  jpeg = await sharp(crypto.randomBytes(900 * 1200 * 3), { raw: { width: 900, height: 1200, channels: 3 } }).jpeg({ quality: 95 }).toBuffer();
});
afterEach(() => { LIMITS.inStock = 5000; });
const as = (who) => (method, url) => authed(method, url, who.session, who.device);
const O = (m, u) => as(owner)(m, u);
const S = (m, u) => as(staff)(m, u);

async function newSub({ name = `Sub ${uid()}`, categoryName = `Cat ${uid()}` } = {}) {
  const c = await O('post', `${C}/categories`).send({ name: categoryName, description: 'Test category' });
  expect(c.status, JSON.stringify(c.body)).toBe(201);
  const s = await O('post', `${C}/categories/${c.body.category.id}/subcategories`).send({ name, description: 'Test', storePrice: 3400, websitePrice: 2800, mrp: 16999 });
  expect(s.status, JSON.stringify(s.body)).toBe(201);
  return { ...s.body.subcategory, category: c.body.category };
}
// Adds one saree the way the phone does: multipart form with the photo.
function addSaree(who, { sub, tag = newTag(), tags, clientRef, batchId, channel, photo = jpeg } = {}) {
  let req = as(who)('post', PR).field('subcategoryId', sub.id);
  req = tags ? req.field('tags', tags.join(',')) : req.field('tag', tag);
  if (clientRef) req = req.field('clientRef', clientRef);
  if (batchId) req = req.field('batchId', batchId);
  if (channel) req = req.field('channel', channel);
  if (photo) req = req.attach('photo', photo, { filename: 'saree.jpg', contentType: 'image/jpeg' });
  return req;
}
async function saree(sub, opts = {}) {
  const r = await addSaree(owner, { sub, ...opts });
  expect(r.status, JSON.stringify(r.body)).toBe(201);
  return r.body.product;
}
const tagOf = (p, code) => p.tags.find((t) => t.code === code);
async function holdWithOrder(productId, pieceId) {
  const order = await prisma.order.create({ data: { orderNumber: `T-${uid()}`, subtotal: 2800, total: 2800, shippingAddress: {} } });
  await prisma.reservation.create({ data: { productId, pieceId, orderId: order.id, expiresAt: new Date(Date.now() + 15 * 60000), status: 'active' } });
  await prisma.piece.update({ where: { id: pieceId }, data: { status: 'reserved' } });
  return order;
}

describe('who can add and change sarees (6.12)', () => {
  it('Owners and Staff both can; signed-out people can\'t', async () => {
    const sub = await newSub();
    const r = await addSaree(staff, { sub });
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    expect((await S('get', PR)).status).toBe(200);
    expect((await S('get', `${PR}/${r.body.product.id}`)).status).toBe(200);
    expect((await S('patch', `${PR}/${r.body.product.id}`).send({ bestSeller: true })).status).toBe(200);
    expect((await api().get(PR)).status).toBe(401);
    expect((await api().post('/api/v2/tags/check').send({ codes: ['NH1'] })).status).toBe(401);
  });
});

describe('adding a saree (5.1, 8)', () => {
  it('needs a photo and a tag; the server checks, not only the app', async () => {
    const sub = await newSub();
    const noPhoto = await addSaree(owner, { sub, photo: null });
    expect(noPhoto.status).toBe(400);
    expect(noPhoto.body.error.code).toBe('PHOTO_MISSING');
    const noTag = await O('post', PR).field('subcategoryId', sub.id).attach('photo', jpeg, { filename: 's.jpg', contentType: 'image/jpeg' });
    expect(noTag.status).toBe(400);
    expect(noTag.body.error.details.issues[0].field).toBe('tag');
    const badTag = await addSaree(owner, { sub, tag: 'NH~1' });
    expect(badTag.status).toBe(400);
  });

  it('makes one listing: subcategory name, one tag in stock, small photo, SKU, ledger, audit', async () => {
    const sub = await newSub({ categoryName: `Mangalagiri Test Pattu ${uid()}` });
    const tag = newTag();
    const r = await addSaree(staff, { sub, tag: tag.toLowerCase().replace('nh', 'nh '), channel: 'online_only', batchId: `batch-${uid()}` });
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    const p = r.body.product;
    expect(p.name).toBe(sub.name);
    expect(p.sku).toMatch(/^NH-MTP\w?-\d{3,}$/);
    expect(p.tags).toHaveLength(1);
    expect(p.tags[0]).toMatchObject({ code: tag, status: 'in_stock', number: tag.slice(2) });
    expect(p.channel).toBe('online_only');
    expect(p.subcategory).toMatchObject({ storePrice: 3400, websitePrice: 2800, mrp: 16999, discountPercent: 84 });
    expect(p.addedBy.name).toMatch(/Lakshmi/);
    expect(p.website.visible).toBe(true);
    expect(p.images).toHaveLength(1);
    const row = await prisma.product.findUnique({ where: { id: p.id }, include: { images: true, pieces: true } });
    expect(row).toMatchObject({ trackingMode: 'serialized', isActive: true, name: sub.name });
    const file = path.join('tmp/test-uploads', row.images[0].storageKey);
    expect(fs.statSync(file).size).toBeLessThanOrEqual(80 * 1024);
    const meta = await sharp(file).metadata();
    expect(Math.max(meta.width, meta.height)).toBeLessThanOrEqual(960);
    const led = await prisma.stockLedger.findFirst({ where: { productId: p.id } });
    expect(led).toMatchObject({ reason: 'restock', delta: 1, actorId: staff.account.id, ref: tag });
    const ev = await prisma.authEvent.findFirst({ where: { eventType: 'product_created', metadata: { path: ['productId'], equals: p.id } } });
    expect(ev.metadata.summary).toBe(`Added with tag ${tag}`);
  });

  it('is safe to repeat: the same clientRef gives one saree, even when sent twice at once', async () => {
    const sub = await newSub();
    const clientRef = `ref-${uid()}-${uid()}`;
    const first = await addSaree(owner, { sub, clientRef });
    expect(first.status).toBe(201);
    const again = await addSaree(owner, { sub, clientRef, tag: newTag() });
    expect(again.status).toBe(200);
    expect(again.body.repeated).toBe(true);
    expect(again.body.product.id).toBe(first.body.product.id);
    const ref2 = `ref-${uid()}-${uid()}`;
    const tag = newTag();
    const both = await Promise.all([addSaree(owner, { sub, clientRef: ref2, tag }), addSaree(owner, { sub, clientRef: ref2, tag })]);
    expect(both.map((x) => x.status).sort()).toEqual([200, 201]);
    expect(await prisma.product.count({ where: { clientRef: ref2 } })).toBe(1);
  });

  it('two phones adding at once get different SKUs and web addresses', async () => {
    const sub = await newSub();
    const rs = await Promise.all(Array.from({ length: 5 }, () => addSaree(owner, { sub })));
    for (const r of rs) expect(r.status, JSON.stringify(r.body)).toBe(201);
    expect(new Set(rs.map((r) => r.body.product.sku)).size).toBe(5);
    expect(new Set(rs.map((r) => r.body.product.slug)).size).toBe(5);
  });

  it('a deleted subcategory can\'t take new sarees', async () => {
    const sub = await newSub();
    await O('delete', `${C}/subcategories/${sub.id}`);
    const r = await addSaree(owner, { sub });
    expect(r.status).toBe(404);
    expect(r.body.error.code).toBe('SUBCATEGORY_GONE');
  });
});

describe('one tag, one saree (6A: T1, T2)', () => {
  it('refuses a tag already on another saree, in any form, and says where it is', async () => {
    const sub = await newSub();
    const tag = newTag();
    const p = await saree(sub, { tag });
    for (const form of [tag, tag.toLowerCase(), `${tag.slice(0, 2)} ${tag.slice(2)}`]) {
      const r = await addSaree(owner, { sub, tag: form });
      expect(r.status).toBe(409);
      expect(r.body.error.code).toBe('TAG_TAKEN');
      expect(r.body.error.details.product).toMatchObject({ productId: p.id, sku: p.sku, name: sub.name });
    }
    const upc = `0${String(seq++).padStart(10, '0')}`;
    await saree(sub, { tag: `${upc}5` }); // a 12-digit retail code
    const ean = await addSaree(owner, { sub, tag: `0${upc}5` }); // the same label read as EAN-13
    expect(ean.body.error.code).toBe('TAG_TAKEN');
  });

  it('a sold tag can never be used again', async () => {
    const sub = await newSub();
    const p = await saree(sub);
    await prisma.piece.update({ where: { id: p.tags[0].id }, data: { status: 'sold_offline', soldAt: new Date('2026-10-09T10:00:00Z') } });
    const r = await addSaree(owner, { sub, tag: p.tags[0].code });
    expect(r.body.error.code).toBe('TAG_SOLD');
    expect(r.body.error.message).toMatch(/was sold on 9 Oct/);
  });

  it('checks tags the moment they are scanned: free, taken, sold, retired, invalid', async () => {
    const sub = await newSub();
    const a = await saree(sub);
    const b = await saree(sub);
    await prisma.piece.update({ where: { id: b.tags[0].id }, data: { status: 'sold_online', soldAt: new Date() } });
    const c = await saree(sub);
    await O('post', `${PR}/${c.id}/tags/${c.tags[0].id}/replace`).send({ code: newTag() });
    const free = newTag();
    const r = await S('post', '/api/v2/tags/check').send({ codes: [free, a.tags[0].code, b.tags[0].code, c.tags[0].code, 'x'] });
    expect(r.body.tags.map((t) => t.status)).toEqual(['free', 'taken', 'sold', 'retired', 'invalid']);
    expect(r.body.tags[1].product).toMatchObject({ productId: a.id, sku: a.sku });
  });

  it('finds a saree by its whole tag, by the number on it, or says it is unknown', async () => {
    const sub = await newSub();
    const tag = newTag();
    const p = await saree(sub, { tag });
    expect((await S('get', `/api/v2/tags/${tag.toLowerCase()}`)).body).toMatchObject({ productId: p.id, code: tag });
    expect((await S('get', `/api/v2/tags/${tag.slice(2)}`)).body.productId).toBe(p.id);
    const unknown = await S('get', `/api/v2/tags/${newTag()}`);
    expect(unknown.status).toBe(404);
    expect(unknown.body.error.code).toBe('TAG_UNKNOWN');
    const n = seq++;
    await saree(sub, { tag: `NH${n}` });
    await saree(sub, { tag: `NANDAM${n}` });
    const two = await S('get', `/api/v2/tags/${n}`);
    expect(two.status).toBe(409);
    expect(two.body.error.code).toBe('AMBIGUOUS_CODE');
  });
});

describe('a set: one photo, several tags (client\'s request, 15 Oct 2026)', () => {
  it('saves one listing with every tag in stock, in one step', async () => {
    const sub = await newSub();
    const tags = [newTag(), newTag(), newTag(), newTag(), newTag()];
    const r = await addSaree(staff, { sub, tags: [tags[0].toLowerCase(), ...tags.slice(1)] });
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    const p = r.body.product;
    expect(p.tags.map((t) => t.code)).toEqual(tags);
    expect(p.tags.every((t) => t.status === 'in_stock' && t.actions.remove)).toBe(true);
    expect(p.images).toHaveLength(1);
    const led = await prisma.stockLedger.findMany({ where: { productId: p.id } });
    expect(led).toHaveLength(5);
    expect(led.every((l) => l.reason === 'restock' && l.delta === 1)).toBe(true);
    const ev = await prisma.authEvent.findFirst({ where: { eventType: 'product_created', metadata: { path: ['productId'], equals: p.id } } });
    expect(ev.metadata).toMatchObject({ barcodeCount: 5, barcodes: tags, summary: `Added as a set of 5: ${tags.join(', ')}` });
    // selling one sells that tag only: the listing stays in stock
    await prisma.piece.update({ where: { id: p.tags[0].id }, data: { status: 'sold_offline', soldAt: new Date() } });
    const after = (await O('get', `${PR}/${p.id}`)).body.product;
    expect(after.stock).toBe('in_stock');
    expect(after.tags.filter((t) => t.status === 'in_stock')).toHaveLength(4);
  });

  it('all or nothing: one used tag stops the whole set, and nothing is saved', async () => {
    const sub = await newSub();
    const used = (await saree(sub)).tags[0].code;
    const fresh = [newTag(), newTag()];
    const r = await addSaree(owner, { sub, tags: [fresh[0], used, fresh[1]] });
    expect(r.status).toBe(409);
    expect(r.body.error.code).toBe('TAG_TAKEN');
    expect(r.body.error.message).toContain(used);
    expect(await prisma.piece.count({ where: { barcode: { in: fresh } } })).toBe(0);
    expect((await addSaree(owner, { sub, tags: fresh })).status).toBe(201); // the free ones are still free
  });

  it('refuses the same tag twice in one set, an empty list and more than 50', async () => {
    const sub = await newSub();
    const t = newTag();
    const twice = await addSaree(owner, { sub, tags: [t, t.toLowerCase()] });
    expect(twice.status).toBe(400);
    expect(twice.body.error.message).toBe('The same tag is in the list twice.');
    const none = await as(owner)('post', PR).field('subcategoryId', sub.id).field('tags', ' , ').attach('photo', jpeg, { filename: 's.jpg', contentType: 'image/jpeg' });
    expect(none.status).toBe(400);
    const many = Array.from({ length: LIMITS.tagsPerSaree + 1 }, () => newTag());
    const tooMany = await addSaree(owner, { sub, tags: many });
    expect(tooMany.status).toBe(400);
    expect(tooMany.body.error.message).toBe('Up to 50 tags on one saree.');
  });

  it('Add more tags: more of the same design join the listing; checked like any tag', async () => {
    const sub = await newSub();
    const p = await saree(sub);
    const more = [newTag(), newTag()];
    const r = await S('post', `${PR}/${p.id}/tags`).send({ codes: more.map((c) => c.toLowerCase()) });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body.product.tags.map((t) => t.code)).toEqual([p.tags[0].code, ...more]);
    const ev = await prisma.authEvent.findFirst({ where: { eventType: 'product_tags_added', metadata: { path: ['productId'], equals: p.id } } });
    expect(ev.metadata.summary).toBe(`2 tags added: ${more.join(', ')}. Now a set of 3.`);
    const own = await O('post', `${PR}/${p.id}/tags`).send({ codes: [more[0]] });
    expect(own.body.error.code).toBe('TAG_ON_THIS_SAREE');
    const other = (await saree(sub)).tags[0].code;
    const taken = await O('post', `${PR}/${p.id}/tags`).send({ codes: [newTag(), other] });
    expect(taken.body.error.code).toBe('TAG_TAKEN');
    expect((await O('get', `${PR}/${p.id}`)).body.product.tags).toHaveLength(3); // nothing added
    const full = Array.from({ length: LIMITS.tagsPerSaree - 2 }, () => newTag());
    const over = await O('post', `${PR}/${p.id}/tags`).send({ codes: full });
    expect(over.status).toBe(409);
    expect(over.body.error.code).toBe('TOO_MANY_TAGS');
  });

  it('older app builds still send one tag', async () => {
    const sub = await newSub();
    const r = await addSaree(owner, { sub, tag: newTag() });
    expect(r.status).toBe(201);
    expect(r.body.product.tags).toHaveLength(1);
  });
});

describe('the list (7.1)', () => {
  it('counts and filters; search by tag number finds that tag, not longer numbers ending the same', async () => {
    const sub = await newSub();
    const n = seq++;
    const exact = await saree(sub, { tag: `NH${n}` });
    await saree(sub, { tag: `NH1${n}` }); // ends with the same digits
    const sold = await saree(sub);
    await prisma.piece.update({ where: { id: sold.tags[0].id }, data: { status: 'sold_offline', soldAt: new Date() } });
    await saree(sub, { channel: 'store_only' });
    const r = await S('get', `${PR}?subcategoryId=${sub.id}`);
    expect(r.body.counts).toMatchObject({ all: 4, instock: 3, soldout: 1, nophoto: 0, online: 0, store: 1 });
    expect(r.body.products).toHaveLength(4);
    expect(r.body.totals.limit).toBe(5000);
    expect(r.body.totals.inStock).toBeGreaterThan(1000);
    const f = await S('get', `${PR}?subcategoryId=${sub.id}&filter=soldout`);
    expect(f.body.products.map((p) => p.id)).toEqual([sold.id]);
    const s = await S('get', `${PR}?q=${n}`);
    expect(s.body.products.map((p) => p.id)).toEqual([exact.id]);
    const page = await S('get', `${PR}?subcategoryId=${sub.id}&limit=3`);
    expect(page.body.products).toHaveLength(3);
    expect(page.body.nextOffset).toBe(3);
  });

  it('the 5,000 limit counts sarees in stock only (6.8)', async () => {
    const sub = await newSub();
    const before = (await S('get', `${PR}?limit=1`)).body.totals.inStock;
    const p = await saree(sub);
    expect((await S('get', `${PR}?limit=1`)).body.totals.inStock).toBe(before + 1);
    await prisma.piece.update({ where: { id: p.tags[0].id }, data: { status: 'sold_offline', soldAt: new Date() } });
    expect((await S('get', `${PR}?limit=1`)).body.totals.inStock).toBe(before); // sold out: doesn't count
    LIMITS.inStock = before;
    const r = await addSaree(owner, { sub });
    expect(r.status).toBe(409);
    expect(r.body.error.code).toBe('LIMIT_REACHED');
  });
});

describe('name, price and moving (6.2, 6.11)', () => {
  it('the name follows the subcategory, also after a rename in the catalogue', async () => {
    const sub = await newSub();
    const p = await saree(sub);
    const renamed = `Renamed ${uid()}`;
    expect((await O('patch', `${C}/subcategories/${sub.id}`).send({ name: renamed })).status).toBe(200);
    expect((await O('get', `${PR}/${p.id}`)).body.product.name).toBe(renamed);
    expect((await prisma.product.findUnique({ where: { id: p.id } })).name).toBe(renamed); // the old website reads this
  });

  it('moving takes the new subcategory\'s name, category and price; SKU and web address stay', async () => {
    const a = await newSub();
    const b = await newSub();
    await O('patch', `${C}/subcategories/${b.id}`).send({ storePrice: 2999, websitePrice: 2499 });
    const p = await saree(a);
    const r = await S('patch', `${PR}/${p.id}`).send({ subcategoryId: b.id });
    expect(r.body.product).toMatchObject({ name: b.name, sku: p.sku, slug: p.slug, category: { id: b.categoryId } });
    expect(r.body.product.subcategory).toMatchObject({ id: b.id, storePrice: 2999, websitePrice: 2499 });
    expect(r.body.product.history[0].text).toBe(`Moved from ${a.name} to ${b.name}`);
  });

  it('where it sells, Best Seller and optional details', async () => {
    const sub = await newSub();
    const p = await saree(sub);
    const r = await O('patch', `${PR}/${p.id}`).send({ channel: 'store_only', bestSeller: true, details: { color: '  Maroon ', occasion: ['Wedding', 'Wedding', 'Festive'] } });
    expect(r.body.product).toMatchObject({ channel: 'store_only', bestSeller: true });
    expect(r.body.product.details).toMatchObject({ color: 'Maroon', occasion: ['Wedding', 'Festive'], fabric: null });
    expect(r.body.product.website).toMatchObject({ visible: false, text: 'Not on the website: set to Store only.' });
    expect((await O('patch', `${PR}/${p.id}`).send({ details: { size: 'x' } })).status).toBe(400);
    expect((await O('patch', `${PR}/${p.id}`).send({ channel: 'hidden' })).status).toBe(400);
  });
});

describe('photos (6.3)', () => {
  it('up to 5; the first is the main one; the last can\'t be removed', async () => {
    const sub = await newSub();
    const p = await saree(sub);
    let r;
    for (let i = 0; i < 4; i++) r = await O('post', `${PR}/${p.id}/photos`).attach('photo', jpeg, { filename: 'x.jpg', contentType: 'image/jpeg' });
    expect(r.body.product.images).toHaveLength(5);
    const sixth = await O('post', `${PR}/${p.id}/photos`).attach('photo', jpeg, { filename: 'x.jpg', contentType: 'image/jpeg' });
    expect(sixth.body.error.code).toBe('TOO_MANY_PHOTOS');
    const ids = r.body.product.images.map((i) => i.id);
    const reordered = await O('put', `${PR}/${p.id}/photos/order`).send({ ids: [ids[3], ...ids.filter((x) => x !== ids[3])] });
    expect(reordered.body.product.images[0].id).toBe(ids[3]);
    expect((await O('put', `${PR}/${p.id}/photos/order`).send({ ids: ids.slice(1) })).body.error.code).toBe('ORDER_OUT_OF_DATE');
    const key = (await prisma.productImage.findUnique({ where: { id: ids[1] } })).storageKey;
    await O('delete', `${PR}/${p.id}/photos/${ids[1]}`);
    expect(fs.existsSync(path.join('tmp/test-uploads', key))).toBe(false);
    let left = (await O('get', `${PR}/${p.id}`)).body.product.images;
    for (const img of left.slice(1)) await O('delete', `${PR}/${p.id}/photos/${img.id}`);
    left = (await O('get', `${PR}/${p.id}`)).body.product.images;
    expect(left).toHaveLength(1);
    expect((await O('delete', `${PR}/${p.id}/photos/${left[0].id}`)).body.error.code).toBe('LAST_PHOTO');
  });
});

describe('fixing tags after saving (6A: T3, T4, T5)', () => {
  it('Change tag: the wrong number becomes free for its real saree', async () => {
    const sub = await newSub();
    const p = await saree(sub);
    const other = await saree(sub);
    const wrong = p.tags[0].code;
    const right = newTag();
    expect((await O('post', `${PR}/${p.id}/tags/${p.tags[0].id}/change`).send({ code: other.tags[0].code })).body.error.code).toBe('TAG_TAKEN');
    expect((await O('post', `${PR}/${p.id}/tags/${p.tags[0].id}/change`).send({ code: wrong })).body.error.code).toBe('SAME_TAG');
    const r = await S('post', `${PR}/${p.id}/tags/${p.tags[0].id}/change`).send({ code: right.toLowerCase() });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body.product.tags).toHaveLength(1);
    expect(r.body.product.tags[0]).toMatchObject({ id: p.tags[0].id, code: right, status: 'in_stock' });
    expect(r.body.product.history[0].text).toBe(`Tag changed ${wrong} → ${right} (wrong tag)`);
    await saree(sub, { tag: wrong }); // free again
    expect(await prisma.stockLedger.count({ where: { productId: p.id, reason: 'tag_changed' } })).toBe(1);
  });

  it('Tag damaged: the old number is retired for good; the saree stays in stock with the new tag', async () => {
    const sub = await newSub();
    const p = await saree(sub);
    const old = p.tags[0].code;
    const fresh = newTag();
    const r = await O('post', `${PR}/${p.id}/tags/${p.tags[0].id}/replace`).send({ code: fresh });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body.product.tags.map((t) => [t.code, t.status])).toEqual([[old, 'retired'], [fresh, 'in_stock']]);
    expect(r.body.product.tags[0].retiredAt).toBeTruthy();
    expect(r.body.product.tags[0].actions).toMatchObject({ change: false, replace: false });
    expect(r.body.product.stock).toBe('in_stock');
    expect((await addSaree(owner, { sub, tag: old })).body.error.code).toBe('TAG_RETIRED');
    const list = await O('get', `${PR}?q=${fresh.slice(2)}`);
    expect(list.body.products[0].tags.map((t) => t.code)).toEqual([fresh]);
  });

  it('Saree damaged: not for sale and off the website; Back in stock undoes it', async () => {
    const sub = await newSub();
    const p = await saree(sub);
    const d = await O('post', `${PR}/${p.id}/tags/${p.tags[0].id}/damaged`);
    expect(d.body.product).toMatchObject({ stock: 'damaged', website: { visible: false } });
    expect(d.body.product.tags[0].actions).toMatchObject({ backInStock: true, damaged: false });
    const back = await O('post', `${PR}/${p.id}/tags/${p.tags[0].id}/back-in-stock`);
    expect(back.body.product).toMatchObject({ stock: 'in_stock', website: { visible: true } });
    expect((await O('post', `${PR}/${p.id}/tags/${p.tags[0].id}/back-in-stock`)).body.error.code).toBe('NOT_DAMAGED');
  });

  it('sold and held tags are locked', async () => {
    const sub = await newSub();
    const sold = await saree(sub);
    await prisma.piece.update({ where: { id: sold.tags[0].id }, data: { status: 'sold_offline', soldAt: new Date() } });
    expect((await O('post', `${PR}/${sold.id}/tags/${sold.tags[0].id}/change`).send({ code: newTag() })).body.error.code).toBe('TAG_SOLD');
    const held = await saree(sub);
    const order = await holdWithOrder(held.id, held.tags[0].id);
    const g = await O('get', `${PR}/${held.id}`);
    expect(g.body.product.tags[0]).toMatchObject({ status: 'reserved', orderNumber: order.orderNumber });
    expect(g.body.product.tags[0].heldUntil).toBeTruthy();
    expect(g.body.actions.delete).toBe(false);
    expect((await O('post', `${PR}/${held.id}/tags/${held.tags[0].id}/replace`).send({ code: newTag() })).body.error.code).toBe('HELD_BY_ORDER');
    expect((await O('delete', `${PR}/${held.id}`)).body.error.code).toBe('HELD_BY_ORDER');
  });

  it('an extra tag on an old listing can be removed, but never the last one', async () => {
    const sub = await newSub();
    const p = await saree(sub);
    const extra = newTag();
    await prisma.piece.create({ data: { productId: p.id, barcode: extra, status: 'in_stock' } }); // the old app allowed 2–6
    const two = (await O('get', `${PR}/${p.id}`)).body.product.tags;
    expect(two.every((t) => t.actions.remove)).toBe(true);
    const r = await O('post', `${PR}/${p.id}/tags/${tagOf({ tags: two }, extra).id}/remove`);
    expect(r.body.product.tags.map((t) => t.code)).toEqual([p.tags[0].code]);
    expect(r.body.product.tags[0].actions.remove).toBe(false);
    expect((await O('post', `${PR}/${p.id}/tags/${p.tags[0].id}/remove`)).body.error.code).toBe('LAST_TAG');
    await saree(sub, { tag: extra }); // its number is free
  });
});

describe('delete never erases (6.1)', () => {
  it('archives the saree, frees its unsold tag, keeps sold ones blocked', async () => {
    const sub = await newSub();
    const p = await saree(sub);
    const soldTag = newTag();
    await prisma.piece.create({ data: { productId: p.id, barcode: soldTag, status: 'sold_offline', soldAt: new Date() } });
    const r = await S('delete', `${PR}/${p.id}`);
    expect(r.body).toEqual({ deleted: true, freedTags: [p.tags[0].code] });
    const row = await prisma.product.findUnique({ where: { id: p.id } });
    expect(row.deletedAt).toBeTruthy();
    expect(row.isActive).toBe(false);
    expect((await S('get', `${PR}/${p.id}`)).status).toBe(404);
    expect((await S('get', `${PR}?subcategoryId=${sub.id}`)).body.products).toHaveLength(0);
    expect((await O('get', `${C}/subcategories/${sub.id}`)).body.subcategory.productCount).toBe(0);
    await saree(sub, { tag: p.tags[0].code });
    expect((await addSaree(owner, { sub, tag: soldTag })).body.error.code).toBe('TAG_SOLD');
  });

  it('a tag left on a saree the old app archived can be used again', async () => {
    const sub = await newSub();
    const p = await saree(sub);
    await prisma.product.update({ where: { id: p.id }, data: { deletedAt: new Date(), isActive: false } }); // old-app archive: tags not freed
    const again = await saree(sub, { tag: p.tags[0].code });
    expect(again.tags[0].code).toBe(p.tags[0].code);
    expect((await prisma.piece.findUnique({ where: { id: p.tags[0].id } })).status).toBe('removed');
  });
});
