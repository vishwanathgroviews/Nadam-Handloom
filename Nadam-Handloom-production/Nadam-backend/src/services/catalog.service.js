// Module 3: the catalogue. Owners add and change categories and subcategories;
// everyone can look. Rules: docs/modules/module-03-categories.md (sections 5 and 7).
//
// Delete never erases (decision 5.0): it sets status = 'inactive' and turns off
// "Show on website" (isActive), so the old website hides it too. Inactive rows are
// never returned. A subcategory can't be deleted while any of its pieces are in
// stock or held; a category can't be deleted while it has active subcategories.
import { Prisma } from '@prisma/client';
import { prisma } from '../config/database.js';
import * as Catalog from '../models/catalog.model.js';
import { compressPhoto } from './photo.service.js';
import { storage } from './storage/index.js';
import { shareInfo } from './catalogPdf.service.js';
import { audit } from './audit.service.js';
import { appRoleOf, displayNameOf } from '../models/authAccount.model.js';
import { can, PERMISSION } from '../config/permissions.js';
import { badRequest, conflict, notFound } from '../utils/errors.js';
import { pageOf, PAGE_SIZE } from '../utils/page.js';

const num = (d) => (d == null ? null : Number(d));
const iso = (d) => (d ? d.toISOString() : null);
const cleanName = (v) => v.trim().replace(/\s+/g, ' ');
const isUniqueClash = (e) => e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002';

// Same as the website (customer-web utils/format.js): 0 when there's no MRP above the price.
export function discountPercent(mrp, price) {
  const m = Number(mrp);
  const p = Number(price);
  if (!m || m <= p) return 0;
  return Math.round(((m - p) / m) * 100);
}

export function slugify(name) {
  return name.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'category';
}

const canEdit = (viewer) => can(appRoleOf(viewer), PERMISSION.CATALOG_EDIT);

/* ---------- shapes the app reads ---------- */
function presentSubcategory(s, stats, categoryName) {
  const st = stats.get(s.id) || { products: 0, inStock: 0, pdfReady: 0 };
  return {
    id: s.id,
    categoryId: s.categoryId,
    categoryName: categoryName ?? s.category?.name ?? null,
    name: s.name,
    imageUrl: s.imageUrl,
    hasPhoto: !!s.imageUrl,
    showOnWebsite: s.isActive,
    storePrice: num(s.storePrice),
    websitePrice: num(s.onlinePrice),
    mrp: num(s.mrp),
    discountPercent: discountPercent(s.mrp, s.onlinePrice),
    productCount: st.products,
    inStockCount: st.inStock,
    position: s.sortOrder,
  };
}

// Name or a price; the shop-wide search also matches the category's name (the pickers
// used that before the lists were paged).
function matches(item, q, { withCategory = false } = {}) {
  if (!q) return true;
  const query = q.trim().replace(/\s+/g, ' ').toLowerCase();
  if (!query) return true;
  const n = Number(query.replace(/[₹,\s]/g, ''));
  return item.name.toLowerCase().includes(query) || (withCategory && (item.categoryName || '').toLowerCase().includes(query)) || (Number.isFinite(n) && n > 0 && [item.storePrice, item.websitePrice, item.mrp].includes(n));
}
function applyFilter(items, filter) {
  if (filter === 'hidden') return items.filter((s) => !s.showOnWebsite);
  if (filter === 'nophoto') return items.filter((s) => !s.hasPhoto);
  if (filter === 'empty') return items.filter((s) => s.productCount === 0);
  return items;
}
const filterCounts = (items) => ({
  all: items.length,
  hidden: items.filter((s) => !s.showOnWebsite).length,
  nophoto: items.filter((s) => !s.hasPhoto).length,
  empty: items.filter((s) => s.productCount === 0).length,
});

async function allActiveSubcategories(where = {}) {
  const subs = await Catalog.listSubcategories(where);
  const stats = await Catalog.statsFor(subs.map((s) => s.id));
  return { subs, stats };
}

/* ---------- reading ---------- */

// The Catalogue screen: categories in shop order with counts, and the filter counts
// across every subcategory.
export async function listCategories({ viewer, offset = 0, limit = PAGE_SIZE }) {
  const [categories, { subs, stats }] = await Promise.all([Catalog.listCategories(), allActiveSubcategories()]);
  const items = subs.map((s) => presentSubcategory(s, stats));
  const per = new Map();
  for (const s of items) {
    const p = per.get(s.categoryId) || { subcategories: 0, products: 0 };
    p.subcategories += 1;
    p.products += s.productCount;
    per.set(s.categoryId, p);
  }
  const page = pageOf(categories, { offset, limit });
  return {
    nextOffset: page.nextOffset,
    total: page.total,
    categories: page.items.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      description: c.description,
      imageUrl: c.imageUrl,
      position: c.sortOrder,
      subcategoryCount: per.get(c.id)?.subcategories ?? 0,
      productCount: per.get(c.id)?.products ?? 0,
    })),
    counts: filterCounts(items),
    actions: { create: canEdit(viewer), reorder: canEdit(viewer) },
  };
}

// Search or filter across every category (Catalogue screen search box and chips).
export async function searchSubcategories({ q = '', filter = 'all', offset = 0, limit = PAGE_SIZE }) {
  const { subs, stats } = await allActiveSubcategories();
  const items = applyFilter(subs.map((s) => presentSubcategory(s, stats)), filter).filter((s) => matches(s, q, { withCategory: true }));
  const page = pageOf(items, { offset, limit });
  return { subcategories: page.items, nextOffset: page.nextOffset, total: page.total };
}

// A category page: the category and its subcategories.
export async function getCategory({ viewer, id, q = '', filter = 'all', offset = 0, limit = PAGE_SIZE }) {
  const c = await Catalog.findCategory(id);
  if (!c) throw notFound('NOT_FOUND', 'This category isn\'t in the catalogue any more.');
  const { subs, stats } = await allActiveSubcategories({ categoryId: id });
  const all = subs.map((s) => presentSubcategory(s, stats, c.name));
  const edit = canEdit(viewer);
  const page = pageOf(applyFilter(all, filter).filter((s) => matches(s, q)), { offset, limit });
  return {
    category: { id: c.id, name: c.name, slug: c.slug, description: c.description, imageUrl: c.imageUrl, position: c.sortOrder, subcategoryCount: all.length, productCount: all.reduce((t, s) => t + s.productCount, 0) },
    subcategories: page.items,
    nextOffset: page.nextOffset,
    total: page.total,
    counts: filterCounts(all),
    actions: { edit, delete: edit, createSubcategory: edit, reorder: edit },
  };
}

// A subcategory page: details, prices, PDF status and price history.
export async function getSubcategory({ viewer, id }) {
  const s = await Catalog.findSubcategory(id);
  if (!s) throw notFound('NOT_FOUND', 'This subcategory isn\'t in the catalogue any more.');
  const stats = await Catalog.statsFor([id]);
  const st = stats.get(id);
  const edit = canEdit(viewer);
  return {
    subcategory: {
      ...presentSubcategory(s, stats),
      description: s.description,
      pdfReadyCount: st.pdfReady,
      catalogue: s.catalogPdf ? { url: s.catalogPdf.url, productCount: s.catalogPdf.productCount, generatedAt: iso(s.catalogPdf.generatedAt), ...shareInfo(s.name) } : null,
      priceHistory: await priceHistory(id),
    },
    actions: { edit, delete: edit, toggleWebsite: edit, makePdf: true, changePhoto: edit },
  };
}

const PRICE_FIELDS = [['storePrice', 'store'], ['onlinePrice', 'website'], ['mrp', 'mrp']];

// Who changed which price, when (old app's entries included: same activity name and shape).
export async function priceHistory(subcategoryId, take = 10) {
  const events = await Catalog.priceEvents(subcategoryId, take * 2);
  const ids = [...new Set(events.map((e) => e.authAccountId || e.metadata?.actorId).filter(Boolean))];
  const people = ids.length ? await prisma.authAccount.findMany({ where: { id: { in: ids } }, include: { adminProfile: true, userProfile: true } }) : [];
  const names = new Map(people.map((p) => [p.id, displayNameOf(p)]));
  const out = [];
  for (const e of events) {
    const before = e.metadata?.before || {};
    const after = e.metadata?.after || {};
    const changes = PRICE_FIELDS
      .map(([key, field]) => ({ field, from: num(before[key]), to: num(after[key]) }))
      .filter((c) => c.from !== c.to);
    if (!changes.length) continue; // a description-only change
    const who = e.authAccountId || e.metadata?.actorId;
    out.push({ at: iso(e.createdAt), by: who ? { id: who, name: names.get(who) ?? 'Former team member' } : null, changes });
    if (out.length >= take) break;
  }
  return out;
}

/* ---------- categories ---------- */

export async function createCategory({ viewer, name, description, ctx }) {
  name = cleanName(name);
  if (await Catalog.categoryNameTaken(name)) throw conflict('NAME_TAKEN', `There's already a category called "${name}".`);
  let slug = slugify(name);
  for (let i = 2; await Catalog.slugTaken(slug); i++) slug = `${slugify(name)}-${i}`;
  let c;
  try {
    c = await prisma.category.create({ data: { name, description: description.trim(), slug, sortOrder: await Catalog.nextPosition('category', {}) } });
  } catch (e) {
    if (isUniqueClash(e)) throw conflict('NAME_TAKEN', `There's already a category called "${name}".`);
    throw e;
  }
  await audit('category_created', { accountId: viewer.id, ctx, metadata: { categoryId: c.id, name: c.name, actorId: viewer.id } });
  return getCategory({ viewer, id: c.id });
}

// Renaming keeps the web address (decision 5.8).
export async function updateCategory({ viewer, id, name, description, ctx }) {
  const c = await Catalog.findCategory(id);
  if (!c) throw notFound('NOT_FOUND', 'This category isn\'t in the catalogue any more.');
  const data = {};
  if (name !== undefined) {
    data.name = cleanName(name);
    if (await Catalog.categoryNameTaken(data.name, id)) throw conflict('NAME_TAKEN', `There's already a category called "${data.name}".`);
  }
  if (description !== undefined) data.description = description.trim();
  try {
    await prisma.category.update({ where: { id }, data });
  } catch (e) {
    if (isUniqueClash(e)) throw conflict('NAME_TAKEN', `There's already a category called "${data.name}".`);
    throw e;
  }
  await audit('category_updated', { accountId: viewer.id, ctx, metadata: { categoryId: id, changed: Object.keys(data), actorId: viewer.id } });
  return getCategory({ viewer, id });
}

export async function deleteCategory({ viewer, id, ctx }) {
  const c = await Catalog.findCategory(id);
  if (!c) throw notFound('NOT_FOUND', 'This category isn\'t in the catalogue any more.');
  const n = await Catalog.countActiveSubcategories(id);
  if (n) throw conflict('HAS_SUBCATEGORIES', `${c.name} still has ${n} subcategor${n === 1 ? 'y' : 'ies'}. Delete them first, then the category.`, { count: n });
  await prisma.category.update({ where: { id }, data: { status: Catalog.INACTIVE, isActive: false } });
  await audit('category_deleted', { accountId: viewer.id, ctx, metadata: { categoryId: id, name: c.name, actorId: viewer.id } });
  return { deleted: true };
}

/* ---------- subcategories ---------- */

// With an MRP: the website price must be below it, and the store price not above it
// (owner's decision, 2026-10-12: a store price above the MRP is always a typing mistake,
// like ₹54,310 for ₹5,431, so it is refused, not just warned about).
const inr = (n) => `₹${Number(n).toLocaleString('en-IN')}`;
function priceErrors({ storePrice, onlinePrice, mrp }) {
  if (mrp != null && onlinePrice != null && Number(mrp) <= Number(onlinePrice)) {
    return badRequest('MRP_TOO_LOW', `The MRP must be higher than the website price (₹${Number(onlinePrice)}), or left empty.`, { field: 'mrp' });
  }
  if (mrp != null && storePrice != null && Number(storePrice) > Number(mrp)) {
    return badRequest('STORE_ABOVE_MRP', `The store price can't be above the MRP (${inr(mrp)}). Lower the store price, or raise the MRP.`, { field: 'storePrice' });
  }
  if (storePrice != null && Number(storePrice) <= 0) return badRequest('VALIDATION_FAILED', 'The store price must be more than ₹0.', { field: 'storePrice' });
  return null;
}
const priceSnapshot = (s) => ({ onlinePrice: s.onlinePrice, storePrice: s.storePrice, mrp: s.mrp, description: s.description });

export async function createSubcategory({ viewer, categoryId, name, description, storePrice, websitePrice, mrp = null, ctx }) {
  const c = await Catalog.findCategory(categoryId);
  if (!c) throw notFound('NOT_FOUND', 'This category isn\'t in the catalogue any more.');
  name = cleanName(name);
  const err = priceErrors({ storePrice, onlinePrice: websitePrice, mrp });
  if (err) throw err;
  if (await Catalog.subcategoryNameTaken(categoryId, name)) throw conflict('NAME_TAKEN', `There's already a subcategory called "${name}" in ${c.name}.`);
  let s;
  try {
    s = await prisma.subcategory.create({
      data: { categoryId, name, description: description.trim(), storePrice, onlinePrice: websitePrice, mrp, sortOrder: await Catalog.nextPosition('subcategory', { categoryId }) },
    });
  } catch (e) {
    if (isUniqueClash(e)) throw conflict('NAME_TAKEN', `There's already a subcategory called "${name}" in ${c.name}.`);
    throw e;
  }
  await audit('subcategory_created', { accountId: viewer.id, ctx, metadata: { categoryId, subcategoryId: s.id, name: s.name, actorId: viewer.id } });
  return getSubcategory({ viewer, id: s.id });
}

// Edit details and prices, or show / hide on the website. The MRP rule is checked
// only when a price is part of the change, so hiding an old row with a wrong MRP still works.
export async function updateSubcategory({ viewer, id, ctx, ...changes }) {
  const s = await Catalog.findSubcategory(id);
  if (!s) throw notFound('NOT_FOUND', 'This subcategory isn\'t in the catalogue any more.');
  const data = {};
  if (changes.name !== undefined) data.name = cleanName(changes.name);
  if (changes.description !== undefined) data.description = changes.description.trim();
  if (changes.storePrice !== undefined) data.storePrice = changes.storePrice;
  if (changes.websitePrice !== undefined) data.onlinePrice = changes.websitePrice;
  if (changes.mrp !== undefined) data.mrp = changes.mrp;
  if (changes.showOnWebsite !== undefined) data.isActive = changes.showOnWebsite;
  const touchesPrice = ['storePrice', 'onlinePrice', 'mrp'].some((k) => k in data);
  if (touchesPrice) {
    const err = priceErrors({ storePrice: data.storePrice ?? s.storePrice, onlinePrice: data.onlinePrice ?? s.onlinePrice, mrp: 'mrp' in data ? data.mrp : s.mrp });
    if (err) throw err;
  }
  if (data.name && (await Catalog.subcategoryNameTaken(s.categoryId, data.name, id))) throw conflict('NAME_TAKEN', `There's already a subcategory called "${data.name}" in ${s.category.name}.`);
  let updated;
  try {
    updated = await prisma.subcategory.update({ where: { id }, data });
  } catch (e) {
    if (isUniqueClash(e)) throw conflict('NAME_TAKEN', `There's already a subcategory called "${data.name}" in ${s.category.name}.`);
    throw e;
  }
  // A product's name always follows its subcategory (Module 4, decision 6.2); the website shows it.
  if (data.name && data.name !== s.name) await prisma.product.updateMany({ where: { subcategoryId: id, deletedAt: null }, data: { name: data.name } });
  const priceChanged = PRICE_FIELDS.some(([k]) => num(s[k]) !== num(updated[k]));
  if (priceChanged) {
    await audit('subcategory_price_changed', { accountId: viewer.id, ctx, metadata: { subcategoryId: id, actorId: viewer.id, before: priceSnapshot(s), after: priceSnapshot(updated) } });
  }
  if ('isActive' in data && data.isActive !== s.isActive) {
    await audit(data.isActive ? 'subcategory_shown_on_web' : 'subcategory_hidden_from_web', { accountId: viewer.id, ctx, metadata: { subcategoryId: id, actorId: viewer.id } });
  }
  const other = ['name', 'description'].filter((k) => k in data && data[k] !== s[k]);
  if (other.length && !priceChanged) await audit('subcategory_updated', { accountId: viewer.id, ctx, metadata: { subcategoryId: id, changed: other, actorId: viewer.id } });
  return getSubcategory({ viewer, id });
}

export async function deleteSubcategory({ viewer, id, ctx }) {
  const s = await Catalog.findSubcategory(id);
  if (!s) throw notFound('NOT_FOUND', 'This subcategory isn\'t in the catalogue any more.');
  const { inStock } = (await Catalog.statsFor([id])).get(id);
  if (inStock > 0) {
    throw conflict('HAS_STOCK', `${inStock} saree${inStock === 1 ? ' is' : 's are'} from ${s.name} still in stock. Sell or move them first. You can hide it from the website instead.`, { count: inStock });
  }
  await prisma.subcategory.update({ where: { id }, data: { status: Catalog.INACTIVE, isActive: false } });
  await audit('subcategory_deleted', { accountId: viewer.id, ctx, metadata: { subcategoryId: id, categoryId: s.categoryId, name: s.name, actorId: viewer.id, kept: true } });
  return { deleted: true };
}

/* ---------- order ---------- */

// Saves a new order. `ids` must be exactly the active items in that place, so two
// phones reordering at once can't mix their lists.
export async function reorder({ viewer, categoryId = null, ids, ctx }) {
  const current = categoryId
    ? (await Catalog.findCategory(categoryId)) && (await prisma.subcategory.findMany({ where: { categoryId, status: Catalog.ACTIVE }, select: { id: true } }))
    : await prisma.category.findMany({ where: { status: Catalog.ACTIVE }, select: { id: true } });
  if (!current) throw notFound('NOT_FOUND', 'This category isn\'t in the catalogue any more.');
  const have = new Set(current.map((r) => r.id));
  if (ids.length !== have.size || new Set(ids).size !== ids.length || ids.some((x) => !have.has(x))) {
    throw conflict('ORDER_OUT_OF_DATE', 'The list changed on another phone. Reload it and try again.');
  }
  await prisma.$transaction((tx) => Catalog.setPositions(categoryId ? 'subcategory' : 'category', ids, tx));
  await audit(categoryId ? 'subcategories_reordered' : 'categories_reordered', { accountId: viewer.id, ctx, metadata: { categoryId, count: ids.length, actorId: viewer.id } });
  return { saved: true };
}

/* ---------- photos ---------- */

// Compress, store, point the row at the new photo, then remove the old file
// (the local store only ever removes its own files).
export async function setPhoto({ viewer, kind, id, buffer, ctx }) {
  const isCat = kind === 'category';
  const row = isCat ? await Catalog.findCategory(id) : await Catalog.findSubcategory(id);
  if (!row) throw notFound('NOT_FOUND', 'This item isn\'t in the catalogue any more.');
  const jpeg = await compressPhoto(buffer);
  const stored = await storage().upload({ buffer: jpeg, contentType: 'image/jpeg', folder: isCat ? 'categories' : 'subcategories', ext: 'jpg' });
  await prisma[isCat ? 'category' : 'subcategory'].update({ where: { id }, data: { imageUrl: stored.url, storageKey: stored.key } });
  if (row.storageKey) storage().remove(row.storageKey).catch((e) => console.error(`[photo] could not remove ${row.storageKey}: ${e.message}`));
  await audit(isCat ? 'category_image_updated' : 'subcategory_image_updated', { accountId: viewer.id, ctx, metadata: { [isCat ? 'categoryId' : 'subcategoryId']: id, bytes: jpeg.length, actorId: viewer.id } });
  return isCat ? getCategory({ viewer, id }) : getSubcategory({ viewer, id });
}
