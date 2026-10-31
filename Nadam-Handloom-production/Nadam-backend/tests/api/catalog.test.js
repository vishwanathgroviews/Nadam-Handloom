// Module 3 (Categories and subcategories): every rule in plan sections 5 and 7.
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import sharp from 'sharp';
import { describe, it, expect, beforeAll } from 'vitest';
import { prisma, signedIn, authed, allPages } from '../support/helpers.js';
import { storage } from '../../src/services/storage/index.js';
import { catalogueFileName, shareInfo } from '../../src/services/catalogPdf.service.js';
import { pdfText } from '../support/pdf.js';

// The PDF's own Title property (PDFKit keeps it in its own object, UTF-16 with a byte-order mark).
function pdfTitle(pdf) {
  const raw = pdf.toString('latin1');
  const ref = /\/Title (\d+) 0 R/.exec(raw)?.[1];
  const body = ref ? new RegExp(`\\n${ref} 0 obj\\n([\\s\\S]*?)\\nendobj`).exec(raw)?.[1] : /\/Title (\([^)]*\)|<[^>]*>)/.exec(raw)?.[1];
  if (!body) return null;
  const hex = /<([0-9a-fA-F]+)>/.exec(body)?.[1];
  if (hex) {
    const b = Buffer.from(hex, 'hex');
    return b[0] === 0xfe && b[1] === 0xff ? Buffer.from(b.subarray(2)).swap16().toString('utf16le') : b.toString('latin1');
  }
  const lit = /\(([\s\S]*)\)/.exec(body)?.[1] ?? '';
  return lit.startsWith('\u00fe\u00ff') ? Buffer.from(lit.slice(2), 'latin1').swap16().toString('utf16le') : lit;
}

const C = '/api/v2/catalog';
const uid = () => crypto.randomUUID().slice(0, 8);
let owner;
let staff;
beforeAll(async () => {
  owner = await signedIn({ role: 'ADMIN', name: 'Cat' });
  staff = await signedIn({ role: 'STAFF', name: 'Viewer' });
});
const as = (who) => (method, url) => authed(method, url, who.session, who.device);
const O = (m, u) => as(owner)(m, u);
const S = (m, u) => as(staff)(m, u);

async function newCategory(name = `Cat ${uid()}`) {
  const r = await O('post', `${C}/categories`).send({ name, description: 'Test category' });
  expect(r.status, JSON.stringify(r.body)).toBe(201);
  return r.body.category;
}
async function newSub(categoryId, extra = {}) {
  const r = await O('post', `${C}/categories/${categoryId}/subcategories`).send({ name: `Sub ${uid()}`, description: 'Test', storePrice: 3400, websitePrice: 2800, mrp: 16999, ...extra });
  expect(r.status, JSON.stringify(r.body)).toBe(201);
  return r.body.subcategory;
}
async function newProduct(sub, { pieces = [], stock = 0, photoUrl = null, deleted = false } = {}) {
  const p = await prisma.product.create({
    data: { slug: `p-${uid()}`, sku: `T-${uid()}`, name: 'Test saree', categoryId: sub.categoryId, subcategoryId: sub.id, stock, deletedAt: deleted ? new Date() : null },
  });
  if (photoUrl) await prisma.productImage.create({ data: { productId: p.id, url: photoUrl } });
  for (const status of pieces) await prisma.piece.create({ data: { productId: p.id, barcode: `NANDAM${Math.floor(Math.random() * 1e9)}`, status } });
  return p;
}
const noisyJpeg = (w = 1800, h = 1350) => sharp(crypto.randomBytes(w * h * 3), { raw: { width: w, height: h, channels: 3 } }).jpeg({ quality: 95 }).toBuffer();

describe('who can do what', () => {
  it('Staff can read everything and make PDFs, but every change is refused on the server', async () => {
    const c = await newCategory();
    const s = await newSub(c.id);
    expect((await S('get', `${C}/categories`)).status).toBe(200);
    expect((await S('get', `${C}/categories/${c.id}`)).status).toBe(200);
    const detail = await S('get', `${C}/subcategories/${s.id}`);
    expect(detail.body.subcategory).toMatchObject({ storePrice: 3400, websitePrice: 2800 });
    expect(detail.body.actions).toMatchObject({ edit: false, delete: false, toggleWebsite: false, makePdf: true });
    const jpeg = await noisyJpeg(40, 30);
    const calls = [
      ['post', `${C}/categories`], ['patch', `${C}/categories/${c.id}`], ['delete', `${C}/categories/${c.id}`], ['put', `${C}/categories/order`],
      ['post', `${C}/categories/${c.id}/subcategories`], ['patch', `${C}/subcategories/${s.id}`], ['delete', `${C}/subcategories/${s.id}`], ['put', `${C}/categories/${c.id}/subcategories/order`],
    ];
    for (const [m, u] of calls) {
      const r = await S(m, u).send({ name: 'Nope nope', description: 'x', storePrice: 1, websitePrice: 1, ids: [s.id] });
      expect(r.status, `${m} ${u}`).toBe(403);
    }
    expect((await S('put', `${C}/subcategories/${s.id}/photo`).attach('photo', jpeg, { filename: 'p.jpg', contentType: 'image/jpeg' })).status).toBe(403);
  });
});

describe('catalogue and search (6.1)', () => {
  it('lists active categories with counts, and filter counts across all subcategories', async () => {
    const c = await newCategory();
    const a = await newSub(c.id);
    await newSub(c.id);
    await newProduct(a, { pieces: ['in_stock'] });
    await newProduct(a, { deleted: true }); // archived: not counted
    const { items, pages, first } = await allPages(O, `${C}/categories`, 'categories');
    const mine = items.find((x) => x.id === c.id);
    expect(mine).toMatchObject({ subcategoryCount: 2, productCount: 1 });
    expect(pages.every((p) => p.categories.length <= 20)).toBe(true);
    expect(items).toHaveLength(first.total);
    expect(first.counts.all).toBeGreaterThanOrEqual(2);
    expect(first.actions).toEqual({ create: true, reorder: true });
  });

  it('searches every category by name or price; inactive ones never appear', async () => {
    const c = await newCategory();
    const tag = uid();
    const s = await newSub(c.id, { name: `Rainbow ${tag} checks`, storePrice: 15127 });
    let r = await O('get', `${C}/subcategories?q=${encodeURIComponent(`rainbow ${tag}`)}`);
    expect(r.body.subcategories.map((x) => x.id)).toEqual([s.id]);
    expect(r.body.subcategories[0]).toMatchObject({ categoryName: c.name, discountPercent: 84 });
    r = await O('get', `${C}/subcategories?q=15127`);
    expect(r.body.subcategories.map((x) => x.id)).toContain(s.id);
    await O('delete', `${C}/subcategories/${s.id}`);
    r = await O('get', `${C}/subcategories?q=${tag}`);
    expect(r.body.subcategories).toHaveLength(0);
  });

  it('filters: hidden, needs photo, no products', async () => {
    const c = await newCategory();
    const hidden = await newSub(c.id);
    await O('patch', `${C}/subcategories/${hidden.id}`).send({ showOnWebsite: false });
    const full = await newSub(c.id);
    await newProduct(full, { pieces: ['in_stock'] });
    const r = await O('get', `${C}/categories/${c.id}?filter=hidden`);
    expect(r.body.subcategories.map((x) => x.id)).toEqual([hidden.id]);
    expect(r.body.counts).toEqual({ all: 2, hidden: 1, nophoto: 2, empty: 1 });
    expect((await O('get', `${C}/categories/${c.id}?filter=empty`)).body.subcategories.map((x) => x.id)).toEqual([hidden.id]);
  });
});

describe('categories (6.2, 6.4, 7)', () => {
  it('adds a category with a web address made from its name; renaming keeps the address', async () => {
    const name = `Handloom Silk ${uid()}`;
    const c = await newCategory(name);
    expect(c.slug).toBe(name.toLowerCase().replace(/\s+/g, '-'));
    const r = await O('patch', `${C}/categories/${c.id}`).send({ name: 'A Completely New Name ' + uid() });
    expect(r.body.category.slug).toBe(c.slug);
  });

  it('refuses a duplicate active name, ignoring capitals and extra spaces', async () => {
    const name = `Pattu ${uid()}`;
    await newCategory(name);
    const r = await O('post', `${C}/categories`).send({ name: `  ${name.toUpperCase()}  `, description: 'x' });
    expect(r.status).toBe(409);
    expect(r.body.error.code).toBe('NAME_TAKEN');
  });

  it('checks the name and description', async () => {
    for (const body of [{ name: 'A', description: 'x' }, { name: 'x'.repeat(101), description: 'x' }, { name: 'Good name', description: '' }, { name: '<b>x</b>', description: 'x' }]) {
      expect((await O('post', `${C}/categories`).send(body)).status, JSON.stringify(body)).toBe(400);
    }
  });

  it('delete = inactive: refused while it has subcategories; then gone everywhere but kept; the name is free again', async () => {
    const name = `Lehanga ${uid()}`;
    const c = await newCategory(name);
    const s = await newSub(c.id);
    let r = await O('delete', `${C}/categories/${c.id}`);
    expect(r.status).toBe(409);
    expect(r.body.error).toMatchObject({ code: 'HAS_SUBCATEGORIES', details: { count: 1 } });
    await O('delete', `${C}/subcategories/${s.id}`);
    r = await O('delete', `${C}/categories/${c.id}`);
    expect(r.body).toEqual({ deleted: true });
    const row = await prisma.category.findUnique({ where: { id: c.id } });
    expect(row).toMatchObject({ status: 'inactive', isActive: false, name });
    expect((await O('get', `${C}/categories`)).body.categories.find((x) => x.id === c.id)).toBeUndefined();
    expect((await O('get', `${C}/categories/${c.id}`)).body.error.code).toBe('NOT_FOUND');
    const again = await newCategory(name);
    expect(again.slug).toBe(`${c.slug}-2`);
    expect(await prisma.authEvent.count({ where: { eventType: 'category_deleted', metadata: { path: ['categoryId'], equals: c.id } } })).toBe(1);
  });
});

describe('subcategories (6.3, 6.4, 7)', () => {
  it('adds one with prices and MRP; % off is the website\'s formula', async () => {
    const c = await newCategory();
    const s = await newSub(c.id, { storePrice: 3400, websitePrice: 2800, mrp: 16999 });
    expect(s).toMatchObject({ storePrice: 3400, websitePrice: 2800, mrp: 16999, discountPercent: 84, showOnWebsite: true, productCount: 0 });
    const plain = await newSub(c.id, { mrp: null });
    expect(plain).toMatchObject({ mrp: null, discountPercent: 0 });
  });

  it('checks prices: more than 0, at most ₹10,00,000, 2 decimals; MRP above the website price', async () => {
    const c = await newCategory();
    const base = { name: `Sub ${uid()}`, description: 'x', storePrice: 100, websitePrice: 100 };
    for (const bad of [{ storePrice: 0 }, { websitePrice: -5 }, { storePrice: 1000001 }, { storePrice: 10.555 }, { websitePrice: 'abc' }]) {
      expect((await O('post', `${C}/categories/${c.id}/subcategories`).send({ ...base, ...bad })).status, JSON.stringify(bad)).toBe(400);
    }
    const r = await O('post', `${C}/categories/${c.id}/subcategories`).send({ ...base, mrp: 100 });
    expect(r.body.error).toMatchObject({ code: 'MRP_TOO_LOW', details: { field: 'mrp' } });
  });

  it('a store price above the MRP is refused (equal is fine; without an MRP there is no check)', async () => {
    const c = await newCategory();
    const base = { name: `Sub ${uid()}`, description: 'x', storePrice: 54310, websitePrice: 2800, mrp: 16999 };
    const r = await O('post', `${C}/categories/${c.id}/subcategories`).send(base);
    expect(r.status).toBe(400);
    expect(r.body.error).toMatchObject({ code: 'STORE_ABOVE_MRP', details: { field: 'storePrice' } });
    expect(r.body.error.message).toBe('The store price can\'t be above the MRP (₹16,999). Lower the store price, or raise the MRP.');
    expect((await O('post', `${C}/categories/${c.id}/subcategories`).send({ ...base, name: `Sub ${uid()}`, storePrice: 16999 })).status).toBe(201);
    expect((await O('post', `${C}/categories/${c.id}/subcategories`).send({ ...base, name: `Sub ${uid()}`, mrp: null })).status).toBe(201);
    // Editing: a new store price above the MRP, or an MRP lowered below the store price, is refused.
    const s = await newSub(c.id); // store 3400, website 2800, MRP 16999
    expect((await O('patch', `${C}/subcategories/${s.id}`).send({ storePrice: 17000 })).body.error.code).toBe('STORE_ABOVE_MRP');
    expect((await O('patch', `${C}/subcategories/${s.id}`).send({ mrp: 3000 })).body.error.code).toBe('STORE_ABOVE_MRP');
    expect((await O('patch', `${C}/subcategories/${s.id}`).send({ storePrice: 17000, mrp: 18000 })).status).toBe(200);
    const after = await prisma.subcategory.findUnique({ where: { id: s.id } });
    expect(Number(after.storePrice)).toBe(17000);
  });

  it('a row with the old ₹54,310 typo: hiding it still works; editing any price asks to fix the store price first', async () => {
    const c = await newCategory();
    const s = await newSub(c.id);
    await prisma.subcategory.update({ where: { id: s.id }, data: { storePrice: 54310, onlinePrice: 2800, mrp: 16999 } }); // like the live row
    expect((await O('patch', `${C}/subcategories/${s.id}`).send({ showOnWebsite: false })).status).toBe(200);
    expect((await O('patch', `${C}/subcategories/${s.id}`).send({ websitePrice: 3000 })).body.error.code).toBe('STORE_ABOVE_MRP');
    const fixed = await O('patch', `${C}/subcategories/${s.id}`).send({ storePrice: 5431 });
    expect(fixed.status).toBe(200);
    expect(fixed.body.subcategory.storePrice).toBe(5431);
  });

  it('a duplicate name in the same category is refused; another category is fine', async () => {
    const c1 = await newCategory();
    const c2 = await newCategory();
    const s = await newSub(c1.id);
    expect((await O('post', `${C}/categories/${c1.id}/subcategories`).send({ name: s.name.toUpperCase(), description: 'x', storePrice: 1, websitePrice: 1 })).body.error.code).toBe('NAME_TAKEN');
    expect((await O('post', `${C}/categories/${c2.id}/subcategories`).send({ name: s.name, description: 'x', storePrice: 1, websitePrice: 1 })).status).toBe(201);
  });

  it('price changes are recorded with old and new values and shown as price history', async () => {
    const c = await newCategory();
    const s = await newSub(c.id);
    const r = await O('patch', `${C}/subcategories/${s.id}`).send({ storePrice: 3600, mrp: 17999 });
    expect(r.body.subcategory).toMatchObject({ storePrice: 3600, mrp: 17999 });
    const h = r.body.subcategory.priceHistory[0];
    expect(h.by).toMatchObject({ id: owner.account.id, name: 'Cat Person' });
    expect(h.changes).toEqual([{ field: 'store', from: 3400, to: 3600 }, { field: 'mrp', from: 16999, to: 17999 }]);
    const ev = await prisma.authEvent.findFirst({ where: { eventType: 'subcategory_price_changed', metadata: { path: ['subcategoryId'], equals: s.id } } });
    expect(ev.metadata.before).toMatchObject({ storePrice: '3400', onlinePrice: '2800' });
    expect(ev.metadata.after).toMatchObject({ storePrice: '3600' });
  });

  it('price history includes changes made in the old app (same activity name and shape)', async () => {
    const c = await newCategory();
    const s = await newSub(c.id);
    await prisma.authEvent.create({ data: { eventType: 'subcategory_price_changed', authAccountId: null, metadata: { subcategoryId: s.id, actorId: owner.account.id, before: { storePrice: '3800', onlinePrice: '3200', mrp: '16999', description: 'x' }, after: { storePrice: '54310', onlinePrice: '25888', mrp: '16999', description: 'x' } } } });
    const h = (await O('get', `${C}/subcategories/${s.id}`)).body.subcategory.priceHistory;
    expect(h[0].changes).toEqual([{ field: 'store', from: 3800, to: 54310 }, { field: 'website', from: 3200, to: 25888 }]);
    expect(h[0].by.name).toBe('Cat Person');
  });

  it('show / hide on the website; hiding a row with an old wrong MRP still works', async () => {
    const c = await newCategory();
    const s = await newSub(c.id);
    await prisma.subcategory.update({ where: { id: s.id }, data: { mrp: 100 } }); // like the live row with MRP below the price
    let r = await O('patch', `${C}/subcategories/${s.id}`).send({ showOnWebsite: false });
    expect(r.body.subcategory.showOnWebsite).toBe(false);
    r = await O('patch', `${C}/subcategories/${s.id}`).send({ storePrice: 3500 });
    expect(r.body.error.code).toBe('MRP_TOO_LOW'); // editing a price makes the MRP be fixed
    expect(await prisma.authEvent.count({ where: { eventType: 'subcategory_hidden_from_web', metadata: { path: ['subcategoryId'], equals: s.id } } })).toBe(1);
  });

  it('delete = inactive: refused while pieces are in stock or held; also off the website; history kept; name reusable', async () => {
    const c = await newCategory();
    const s = await newSub(c.id);
    const p = await newProduct(s, { pieces: ['in_stock', 'reserved', 'sold_offline'] });
    let r = await O('delete', `${C}/subcategories/${s.id}`);
    expect(r.status).toBe(409);
    expect(r.body.error).toMatchObject({ code: 'HAS_STOCK', details: { count: 2 } });
    await prisma.piece.updateMany({ where: { productId: p.id }, data: { status: 'sold_offline' } });
    r = await O('delete', `${C}/subcategories/${s.id}`);
    expect(r.body).toEqual({ deleted: true });
    const row = await prisma.subcategory.findUnique({ where: { id: s.id } });
    expect(row).toMatchObject({ status: 'inactive', isActive: false }); // gone from the old website too
    expect(await prisma.product.count({ where: { subcategoryId: s.id } })).toBe(1); // products and history untouched
    expect((await O('get', `${C}/subcategories/${s.id}`)).status).toBe(404);
    expect((await O('get', `${C}/categories/${c.id}`)).body.subcategories).toHaveLength(0);
    const again = await O('post', `${C}/categories/${c.id}/subcategories`).send({ name: s.name, description: 'x', storePrice: 1, websitePrice: 1 });
    expect(again.status).toBe(201);
  });

  it('the old stock counter also counts as in stock', async () => {
    const c = await newCategory();
    const s = await newSub(c.id);
    await newProduct(s, { stock: 3 });
    expect((await O('delete', `${C}/subcategories/${s.id}`)).body.error).toMatchObject({ code: 'HAS_STOCK', details: { count: 3 } });
  });

  it('the database itself refuses two active subcategories with the same name, but allows it once one is inactive', async () => {
    const c = await newCategory();
    const s = await newSub(c.id);
    await expect(prisma.subcategory.create({ data: { categoryId: c.id, name: ` ${s.name.toLowerCase()} `, description: 'x', storePrice: 1, onlinePrice: 1 } })).rejects.toThrow();
    await prisma.subcategory.update({ where: { id: s.id }, data: { status: 'inactive' } });
    await expect(prisma.subcategory.create({ data: { categoryId: c.id, name: s.name, description: 'x', storePrice: 1, onlinePrice: 1 } })).resolves.toBeTruthy();
  });
});

describe('reordering (5.5)', () => {
  it('saves a new order of subcategories; refuses an out-of-date list', async () => {
    const c = await newCategory();
    const a = await newSub(c.id);
    const b = await newSub(c.id);
    const d = await newSub(c.id);
    let r = await O('put', `${C}/categories/${c.id}/subcategories/order`).send({ ids: [d.id, a.id, b.id] });
    expect(r.body).toEqual({ saved: true });
    expect((await O('get', `${C}/categories/${c.id}`)).body.subcategories.map((x) => x.id)).toEqual([d.id, a.id, b.id]);
    r = await O('put', `${C}/categories/${c.id}/subcategories/order`).send({ ids: [d.id, a.id] });
    expect(r.body.error.code).toBe('ORDER_OUT_OF_DATE');
  });
});

describe('photos (5.9, 7)', () => {
  it('stores a small JPEG (80 KB or less) without location data and replaces the old file', async () => {
    const c = await newCategory();
    const s = await newSub(c.id);
    const big = await noisyJpeg();
    const r1 = await O('put', `${C}/subcategories/${s.id}/photo`).attach('photo', big, { filename: 'p.jpg', contentType: 'image/jpeg' });
    expect(r1.status, JSON.stringify(r1.body)).toBe(200);
    const url1 = r1.body.subcategory.imageUrl;
    expect(url1).toMatch(/^http:\/\/test\.local:4100\/uploads\/subcategories\/.+\.jpg$/);
    const file1 = path.join(storage().root, url1.split('/uploads/')[1]);
    const stored = fs.readFileSync(file1);
    expect(stored.length).toBeLessThanOrEqual(80 * 1024);
    const meta = await sharp(stored).metadata();
    expect(meta.format).toBe('jpeg');
    expect(meta.exif).toBeUndefined();
    const r2 = await O('put', `${C}/subcategories/${s.id}/photo`).attach('photo', await noisyJpeg(400, 300), { filename: 'p.jpg', contentType: 'image/jpeg' });
    expect(r2.body.subcategory.imageUrl).not.toBe(url1);
    await new Promise((res) => setTimeout(res, 100));
    expect(fs.existsSync(file1)).toBe(false); // our own old file is removed
  });

  it('never deletes a live file: replacing a photo whose file isn\'t ours leaves it alone', async () => {
    const c = await newCategory();
    const s = await newSub(c.id);
    await prisma.subcategory.update({ where: { id: s.id }, data: { imageUrl: 'https://nandamhandlooms-media.s3.ap-south-1.amazonaws.com/subcategories/live.jpg', storageKey: 'subcategories/live.jpg' } });
    expect(await storage().remove('subcategories/live.jpg')).toBe(false);
    const r = await O('put', `${C}/subcategories/${s.id}/photo`).attach('photo', await noisyJpeg(200, 150), { filename: 'p.jpg', contentType: 'image/jpeg' });
    expect(r.status).toBe(200);
    expect(storage().name).toBe('local');
  });

  it('refuses other file types and unreadable pictures', async () => {
    const c = await newCategory();
    let r = await O('put', `${C}/categories/${c.id}/photo`).attach('photo', Buffer.from('%PDF-1.4'), { filename: 'x.pdf', contentType: 'application/pdf' });
    expect(r.body.error.code).toBe('PHOTO_TYPE');
    r = await O('put', `${C}/categories/${c.id}/photo`).attach('photo', Buffer.from('not a picture'), { filename: 'x.jpg', contentType: 'image/jpeg' });
    expect(r.body.error.code).toBe('PHOTO_UNREADABLE');
    r = await O('put', `${C}/categories/${c.id}/photo`);
    expect(r.body.error.code).toBe('PHOTO_MISSING');
  });
});

describe('catalogue PDF (6.5)', () => {
  it('one page per in-stock product with a photo, with tag numbers; Staff can make it; old file replaced', async () => {
    const c = await newCategory();
    const s = await newSub(c.id, { name: `Rainbow ${uid()}` });
    const photo = await storage().upload({ buffer: await noisyJpeg(300, 400), contentType: 'image/jpeg', folder: 'products', ext: 'jpg' });
    await newProduct(s, { pieces: ['in_stock', 'in_stock'], photoUrl: photo.url });
    await newProduct(s, { pieces: ['in_stock'], photoUrl: photo.url });
    await newProduct(s, { pieces: ['in_stock'] }); // no photo: left out
    await newProduct(s, { pieces: ['sold_offline'], photoUrl: photo.url }); // sold: left out
    const detail = (await O('get', `${C}/subcategories/${s.id}`)).body.subcategory;
    expect(detail.pdfReadyCount).toBe(2);
    const r = await S('post', `${C}/subcategories/${s.id}/catalogue-pdf`);
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body.catalogue).toMatchObject({ productCount: 2, fileName: `${s.name}.pdf`, caption: `${s.name}. Please tell us the ID number of the piece you like.` });
    const file = path.join(storage().root, r.body.catalogue.url.split('/uploads/')[1]);
    const pdf = fs.readFileSync(file);
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    expect((pdf.toString('latin1').match(/\/Type \/Page\b/g) || []).length).toBe(2);
    // Nothing the customer receives names the shop (client, 23 Oct 2026): the printed text, the
    // PDF's own properties, the file name, the message, and the details the app shares from.
    expect(pdfText(pdf)).toContain(s.name.toUpperCase());
    expect(pdfTitle(pdf)).toBe(s.name);
    const shared = (await O('get', `${C}/subcategories/${s.id}`)).body.subcategory.catalogue;
    for (const text of [pdfText(pdf), pdf.toString('latin1'), r.body.catalogue.fileName, r.body.catalogue.caption, JSON.stringify(shared)]) {
      expect(text).not.toMatch(/nandam/i);
    }
    const r2 = await O('post', `${C}/subcategories/${s.id}/catalogue-pdf`);
    await new Promise((res) => setTimeout(res, 100));
    expect(fs.existsSync(file)).toBe(false);
    expect((await O('get', `${C}/subcategories/${s.id}`)).body.subcategory.catalogue.url).toBe(r2.body.catalogue.url);
  });

  it('the shared file is named after the subcategory only, with what a phone can\'t keep in a name made dashes', () => {
    expect(catalogueFileName('GAP BORDER DIGITAL PRINT SAREES')).toBe('GAP BORDER DIGITAL PRINT SAREES.pdf');
    expect(catalogueFileName('150/50 PLAIN SAREE EMBROIDERY')).toBe('150-50 PLAIN SAREE EMBROIDERY.pdf');
    expect(catalogueFileName(' 50/50  Bandini: "New"? ')).toBe('50-50 Bandini New.pdf');
    expect(catalogueFileName('...')).toBe('Catalogue.pdf');
    expect(catalogueFileName('మంగళగిరి పట్టు')).toBe('మంగళగిరి పట్టు.pdf');
    expect(shareInfo('GAP BORDER DIGITAL PRINT SAREES')).toEqual({ fileName: 'GAP BORDER DIGITAL PRINT SAREES.pdf', caption: 'GAP BORDER DIGITAL PRINT SAREES. Please tell us the ID number of the piece you like.' });
  });

  it('says so when nothing can be shown', async () => {
    const c = await newCategory();
    const s = await newSub(c.id);
    expect((await O('post', `${C}/subcategories/${s.id}/catalogue-pdf`)).body.error.code).toBe('NOTHING_TO_SHOW');
  });
});
