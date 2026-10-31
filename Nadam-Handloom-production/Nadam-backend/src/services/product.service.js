// Module 4: products (sarees) and their tags. Owners and Staff both manage them
// (products.manage). Rules: docs/modules/module-04-products.md, sections 6, 6A and 8.
//
// - One tag = one saree (6A, T1). A listing is one photo and usually one tag; a SET
//   (several identical sarees, one photo; client's request 15 Oct 2026) has one tag
//   per saree, up to 50. A tag can be on one saree only, ever: sold and retired tags
//   are never used again (T2).
// - The name and price always come from the subcategory (6.2).
// - Adding a saree is safe to repeat: the phone's clientRef returns the saree
//   already made (section 9).
// - Delete never erases (6.1): the saree is archived (deletedAt), and its unsold
//   tags are renamed so their numbers can go on other sarees.
// - Change tag (T3) frees the wrong number; replacing a damaged tag (T4) retires it.
import { websiteState } from './shop/visibility.js';
import { prisma } from '../config/database.js';
import * as P from '../models/product.model.js';
import * as Catalog from '../models/catalog.model.js';
import { compressPhoto } from './photo.service.js';
import { storage } from './storage/index.js';
import { audit } from './audit.service.js';
import { discountPercent } from './catalog.service.js';
import { displayNameOf } from '../models/authAccount.model.js';
import { normalizeTag, isValidTag, tagNumber, isBareNumber, freedName } from '../utils/tags.js';
import { badRequest, conflict, notFound } from '../utils/errors.js';
import { pageOf, PAGE_SIZE } from '../utils/page.js';

// The 5,000 limit counts sarees in stock only (decision 6.8). Tests change it.
export const LIMITS = { inStock: 5000, photos: 5, tagsPerSaree: 50 };
export const CHANNELS = ['both', 'online_only', 'store_only'];
const CHANNEL_TEXT = { both: 'Online + store', online_only: 'Online only', store_only: 'Store only', hidden: 'Hidden' };
const UNSOLD = ['in_stock', 'damaged'];
const DETAIL_FIELDS = ['color', 'fabric', 'borderStyle', 'technique', 'blouseType', 'zariTier', 'purity', 'pattern', 'occasion'];

const num = (d) => (d == null ? null : Number(d));
const iso = (d) => (d ? d.toISOString() : null);
const day = (d) => new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' }).format(d);
const GONE = () => notFound('NOT_FOUND', 'This saree isn\'t in the shop any more. Bills and reports still show it.');

/* ---------- shapes the app reads ---------- */

function stockState(p) {
  const st = p.pieces.map((x) => x.status);
  if (st.includes('in_stock') || p.stock > 0) return 'in_stock';
  if (st.includes('reserved')) return 'held';
  if (st.includes('damaged')) return 'damaged';
  return 'sold_out';
}

function presentListItem(p) {
  return {
    id: p.id,
    sku: p.sku,
    name: p.subcategory?.name ?? p.name,
    imageUrl: p.images[0]?.url ?? null,
    categoryName: p.category?.name ?? null,
    subcategoryId: p.subcategoryId,
    storePrice: num(p.subcategory?.storePrice),
    websitePrice: num(p.subcategory?.onlinePrice),
    channel: p.channelVisibility,
    bestSeller: p.isFeatured,
    stock: stockState(p),
    tags: p.pieces.filter((x) => x.status !== 'retired').map((x) => ({ code: x.barcode, status: x.status })),
    addedAt: iso(p.createdAt),
  };
}

function tagActions(pc, holds, liveCount) {
  const held = pc.status === 'reserved' || holds.has(pc.id);
  const open = UNSOLD.includes(pc.status) && !held;
  return { change: open, replace: open, damaged: open && pc.status === 'in_stock', backInStock: !held && pc.status === 'damaged', remove: open && liveCount > 1 };
}

const EVENT_TEXT = {
  product_created: 'Added', product_updated: 'Details changed', product_image_uploaded: 'Photo changed', product_deleted: 'Deleted',
};

async function namesFor(ids) {
  const list = [...new Set(ids.filter(Boolean))];
  if (!list.length) return new Map();
  const people = await prisma.authAccount.findMany({ where: { id: { in: list } }, include: { adminProfile: true, userProfile: true } });
  return new Map(people.map((x) => [x.id, displayNameOf(x)]));
}

async function presentDetail(p) {
  const [holds, actorId, events] = await Promise.all([P.activeHolds(p.id), P.addedBy(p.id), P.events(p.id)]);
  const names = await namesFor([actorId, ...events.map((e) => e.authAccountId || e.metadata?.actorId)]);
  const shown = p.pieces.filter((x) => P.SHOWN_TAG_STATUSES.includes(x.status));
  const liveCount = shown.filter((x) => x.status !== 'retired').length;
  const sub = p.subcategory;
  return {
    id: p.id,
    sku: p.sku,
    slug: p.slug,
    name: sub?.name ?? p.name,
    storedName: p.name !== sub?.name ? p.name : null, // the old app's stale copy, until the switch-over fix
    category: { id: p.category.id, name: p.category.name },
    subcategory: { id: sub.id, name: sub.name, storePrice: num(sub.storePrice), websitePrice: num(sub.onlinePrice), mrp: num(sub.mrp), discountPercent: discountPercent(sub.mrp, sub.onlinePrice), showOnWebsite: sub.isActive },
    images: p.images.map((i) => ({ id: i.id, url: i.url })),
    tags: shown.map((pc) => {
      const hold = holds.get(pc.id);
      return {
        id: pc.id,
        code: pc.barcode,
        number: tagNumber(pc.barcode),
        status: pc.status === 'in_stock' && hold ? 'reserved' : pc.status,
        soldAt: iso(pc.soldAt),
        retiredAt: pc.status === 'retired' ? iso(pc.updatedAt) : null,
        heldUntil: hold ? iso(hold.expiresAt) : null,
        orderNumber: hold?.orderNumber ?? null,
        actions: tagActions(pc, holds, liveCount),
      };
    }),
    stock: stockState(p),
    channel: p.channelVisibility,
    bestSeller: p.isFeatured,
    details: Object.fromEntries(DETAIL_FIELDS.map((k) => [k, k === 'occasion' ? p.occasion ?? [] : p[k] ?? null])),
    website: websiteState(p),
    addedAt: iso(p.createdAt),
    addedBy: actorId ? { id: actorId, name: names.get(actorId) ?? 'Former team member' } : null,
    batchId: p.batchId,
    history: events.map((e) => {
      const who = e.authAccountId || e.metadata?.actorId;
      return { at: iso(e.createdAt), text: e.metadata?.summary || EVENT_TEXT[e.eventType] || 'Changed', by: who ? names.get(who) ?? 'Former team member' : null };
    }),
  };
}

function productActions(p, holds) {
  const held = holds.size > 0 || p.pieces.some((x) => x.status === 'reserved');
  return { edit: true, move: true, photos: true, delete: !held, editPrices: false };
}

async function detailReply(id) {
  const p = await P.findLive(id);
  if (!p) throw GONE();
  return { product: await presentDetail(p), actions: productActions(p, await P.activeHolds(id)) };
}

/* ---------- reading ---------- */

export async function listProducts({ q = '', filter = 'all', subcategoryId, offset = 0, limit = PAGE_SIZE }) {
  const where = subcategoryId ? { subcategoryId } : {};
  const [counts, inStock, listings] = await Promise.all([P.filterCounts(where), P.countInStock(), P.countListings()]);
  let rows;
  let nextOffset = null;
  if (q.trim()) {
    const page = pageOf(await P.search(q, where, LIMITS.inStock), { offset, limit }); // every match, 20 at a time
    rows = page.items;
    nextOffset = page.nextOffset;
  } else {
    rows = await P.listPage({ where: { ...where, ...P.FILTER_WHERE[filter] }, skip: offset, take: limit + 1 });
    if (rows.length > limit) { rows = rows.slice(0, limit); nextOffset = offset + limit; }
  }
  return { products: rows.map(presentListItem), nextOffset, counts, totals: { inStock, listings, limit: LIMITS.inStock } };
}

export const getProduct = ({ id }) => detailReply(id);

/* ---------- tag checks ---------- */

// What stands in the way of using a tag. A tag left on a saree the old app archived
// (never sold) can be reclaimed: it is renamed in the same step as the new use.
async function tagClash(code, { ignorePieceId } = {}) {
  const pc = await P.pieceByTag(code);
  if (!pc || pc.id === ignorePieceId) return {};
  const on = { productId: pc.product.id, name: pc.product.subcategory?.name ?? pc.product.name, sku: pc.product.sku, imageUrl: pc.product.images[0]?.url ?? null, status: pc.status, soldAt: iso(pc.soldAt) };
  if (pc.status === 'retired') return { error: conflict('TAG_RETIRED', `${pc.barcode} was a damaged tag and was replaced. It can't be used again.`, { code: pc.barcode, product: on }) };
  if (P.SOLD.includes(pc.status)) return { error: conflict('TAG_SOLD', `${pc.barcode} was sold${pc.soldAt ? ` on ${day(pc.soldAt)}` : ''}. A tag can't be used twice.`, { code: pc.barcode, product: on }) };
  if (pc.product.deletedAt && UNSOLD.includes(pc.status)) return { reclaim: pc };
  return { error: conflict('TAG_TAKEN', `${pc.barcode} is already on ${on.name} (${on.sku}).`, { code: pc.barcode, product: on }) };
}
const reclaim = (tx, pc) => tx.piece.update({ where: { id: pc.id }, data: { barcode: freedName(pc.barcode, 'del', pc.id), status: 'removed' } });

// Checked the moment a tag is scanned (rule T2): free, or where it is.
export async function checkTags({ codes }) {
  const out = [];
  for (const raw of codes) {
    const code = normalizeTag(raw);
    if (!isValidTag(code)) { out.push({ code, status: 'invalid', message: 'That doesn\'t look like a tag. Scan it again or type the number on it.' }); continue; }
    const c = await tagClash(code);
    if (!c.error) { out.push({ code, status: 'free' }); continue; }
    out.push({ code, status: { TAG_TAKEN: 'taken', TAG_SOLD: 'sold', TAG_RETIRED: 'retired' }[c.error.code], message: c.error.message, product: c.error.details.product });
  }
  return { tags: out };
}

// Scan to find: the whole tag in any camera form, or just the number on it.
export async function findByTag({ code }) {
  const tidy = normalizeTag(code);
  let pc = await P.pieceByTag(tidy);
  if (pc && (pc.product.deletedAt || !P.SHOWN_TAG_STATUSES.includes(pc.status))) pc = null;
  if (!pc && isBareNumber(tidy)) {
    const matches = await P.piecesByNumber(tidy);
    const inStock = matches.filter((m) => m.status === 'in_stock');
    if (matches.length === 1) [pc] = matches;
    else if (inStock.length === 1) [pc] = inStock;
    else if (matches.length > 1) {
      throw conflict('AMBIGUOUS_CODE', `${matches.length} tags carry the number ${tidy}. Scan the tag or type the whole code.`, { matches: matches.map((m) => ({ code: m.barcode, productId: m.product.id, name: m.product.subcategory?.name ?? m.product.name, status: m.status })) });
    }
  }
  if (!pc) throw notFound('TAG_UNKNOWN', `No saree has ${tidy}.`, { code: tidy });
  return { productId: pc.product?.id ?? pc.productId, code: pc.barcode, status: pc.status };
}

/* ---------- adding a saree ---------- */

// Every tag must be free. Throws the first clash; returns the tags to reclaim.
async function clearTags(codes, { productId } = {}) {
  const reclaims = [];
  for (const code of codes) {
    if (!isValidTag(code)) throw badRequest('TAG_INVALID', `${code} doesn't look like a tag. Scan it again or type the number on it.`, { code });
    const clash = await tagClash(code);
    if (clash.error) {
      if (productId && clash.error.details?.product?.productId === productId) throw conflict('TAG_ON_THIS_SAREE', `${code} is already one of this saree's tags.`, { code });
      throw clash.error;
    }
    if (clash.reclaim) reclaims.push(clash.reclaim);
  }
  return reclaims;
}
const tidyTags = (list) => [...new Set(list.map(normalizeTag))];
const listText = (codes) => (codes.length > 1 ? `a set of ${codes.length}: ${codes.join(', ')}` : `tag ${codes[0]}`);

// One listing: photo + subcategory + its tag (or a set's tags), in one step, all or
// nothing. Repeating it with the same clientRef returns the saree already made (the
// phone retries after a lost answer). Older app builds send a single `tag`.
export async function createProduct({ viewer, subcategoryId, tags, tag, channel = 'both', clientRef = null, batchId = null, photo, ctx }) {
  if (clientRef) {
    const done = await P.findByClientRef(clientRef);
    if (done) return { ...(await detailReply(done.id)), repeated: true };
  }
  const sub = await Catalog.findSubcategory(subcategoryId);
  if (!sub) throw notFound('SUBCATEGORY_GONE', 'This subcategory isn\'t in the catalogue any more. Choose another one.');
  const codes = tidyTags(tags ?? (tag ? [tag] : []));
  if (!codes.length) throw badRequest('TAG_MISSING', 'Scan or type the tag.');
  if (codes.length > LIMITS.tagsPerSaree) throw badRequest('TOO_MANY_TAGS', `Up to ${LIMITS.tagsPerSaree} tags on one saree.`);
  if ((await P.countInStock()) >= LIMITS.inStock) {
    throw conflict('LIMIT_REACHED', `The shop has ${LIMITS.inStock.toLocaleString('en-IN')} sarees in stock, the most allowed. Sold-out sarees don't count, so selling frees up space.`, { limit: LIMITS.inStock });
  }
  const reclaims = await clearTags(codes);
  const category = await prisma.category.findUnique({ where: { id: sub.categoryId }, select: { slug: true } });

  const jpeg = await compressPhoto(photo);
  const stored = await storage().upload({ buffer: jpeg, contentType: 'image/jpeg', folder: 'products', ext: 'jpg' });
  let created;
  try {
    for (let attempt = 1; !created; attempt += 1) {
      try {
        created = await prisma.$transaction(async (tx) => {
          await P.lockNumbering(tx);
          for (const pc of reclaims) await reclaim(tx, pc);
          const product = await tx.product.create({
            data: {
              slug: await P.uniqueSlug(sub.name, tx), sku: await P.nextSku(category.slug, tx), name: sub.name, categoryId: sub.categoryId, subcategoryId: sub.id,
              channelVisibility: channel, trackingMode: 'serialized', isActive: true, clientRef, batchId,
            },
          });
          await tx.productImage.create({ data: { productId: product.id, url: stored.url, storageKey: stored.key, altText: sub.name, sortOrder: 0 } });
          for (const code of codes) {
            const piece = await tx.piece.create({ data: { productId: product.id, barcode: code, status: 'in_stock' } });
            await tx.stockLedger.create({ data: { productId: product.id, pieceId: piece.id, delta: 1, reason: 'restock', channel: 'store', actorId: viewer.id, ref: code } });
          }
          return product;
        });
      } catch (e) {
        if (P.isUniqueClash(e, 'clientRef') && clientRef) {
          const done = await P.findByClientRef(clientRef);
          if (done) { storage().remove(stored.key).catch(() => {}); return { ...(await detailReply(done.id)), repeated: true }; }
        }
        if (P.isUniqueClash(e, 'barcode')) throw conflict('TAG_TAKEN', `${codes.length > 1 ? 'One of these tags' : codes[0]} was just put on another saree.`, { codes });
        // The old app took the same SKU or web address a moment ago: take the next one.
        if (!P.isUniqueClash(e) || attempt >= 4) throw e;
      }
    }
  } catch (e) {
    storage().remove(stored.key).catch(() => {});
    throw e;
  }
  await audit('product_created', { accountId: viewer.id, ctx, metadata: { productId: created.id, sku: created.sku, barcodeCount: codes.length, barcodes: codes, batchId, actorId: viewer.id, summary: codes.length > 1 ? `Added as ${listText(codes)}` : `Added with tag ${codes[0]}` } });
  return { ...(await detailReply(created.id)), repeated: false };
}

// More sarees of the same design came in: their tags join the listing (a set). Each
// new tag is one more saree in stock; all are added or none.
export async function addTags({ viewer, id, codes: raw, ctx }) {
  const p = await P.findLive(id);
  if (!p) throw GONE();
  const codes = tidyTags(raw);
  const live = p.pieces.filter((x) => P.SHOWN_TAG_STATUSES.includes(x.status) && x.status !== 'retired');
  if (live.length + codes.length > LIMITS.tagsPerSaree) throw conflict('TOO_MANY_TAGS', `Up to ${LIMITS.tagsPerSaree} tags on one saree. This one has ${live.length}.`, { limit: LIMITS.tagsPerSaree });
  const soldOut = !p.pieces.some((x) => x.status === 'in_stock');
  if (soldOut && (await P.countInStock()) >= LIMITS.inStock) {
    throw conflict('LIMIT_REACHED', `The shop has ${LIMITS.inStock.toLocaleString('en-IN')} sarees in stock, the most allowed. Sold-out sarees don't count, so selling frees up space.`, { limit: LIMITS.inStock });
  }
  const reclaims = await clearTags(codes, { productId: id });
  await inTx(async (tx) => {
    for (const pc of reclaims) await reclaim(tx, pc);
    for (const code of codes) {
      const piece = await tx.piece.create({ data: { productId: p.id, barcode: code, status: 'in_stock' } });
      await ledger(tx, p, piece, 1, 'restock', viewer.id, code);
    }
  }, codes.length > 1 ? 'One of these tags' : codes[0]);
  const total = live.length + codes.length;
  await audit('product_tags_added', { accountId: viewer.id, ctx, metadata: { productId: id, barcodes: codes, total, actorId: viewer.id, summary: `${codes.length > 1 ? `${codes.length} tags` : 'Tag'} added: ${codes.join(', ')}. Now a set of ${total}.` } });
  return detailReply(id);
}

/* ---------- changing a saree ---------- */

const cleanDetail = (v) => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ') || null : v ?? null);

export async function updateProduct({ viewer, id, subcategoryId, channel, bestSeller, details, ctx }) {
  const p = await P.findLive(id);
  if (!p) throw GONE();
  const data = {};
  const said = [];
  let moved = null;
  if (subcategoryId && subcategoryId !== p.subcategoryId) {
    const sub = await Catalog.findSubcategory(subcategoryId);
    if (!sub) throw notFound('SUBCATEGORY_GONE', 'That subcategory isn\'t in the catalogue any more. Choose another one.');
    Object.assign(data, { subcategoryId: sub.id, categoryId: sub.categoryId, name: sub.name });
    moved = { from: p.subcategory.name, to: sub.name };
  }
  if (channel && channel !== p.channelVisibility) { data.channelVisibility = channel; said.push(`Where it sells: ${CHANNEL_TEXT[channel]}`); }
  if (bestSeller !== undefined && bestSeller !== p.isFeatured) { data.isFeatured = bestSeller; said.push(bestSeller ? 'Marked Best Seller' : 'Best Seller removed'); }
  if (details) {
    let changed = false;
    for (const k of DETAIL_FIELDS) {
      if (!(k in details)) continue;
      const v = k === 'occasion' ? [...new Set((details.occasion || []).map(cleanDetail).filter(Boolean))] : cleanDetail(details[k]);
      if (JSON.stringify(v) !== JSON.stringify(k === 'occasion' ? p.occasion ?? [] : p[k] ?? null)) { data[k] = v; changed = true; }
    }
    if (changed) said.push('Details updated');
  }
  if (!Object.keys(data).length) return detailReply(id);
  await prisma.product.update({ where: { id }, data });
  if (moved) await audit('product_moved', { accountId: viewer.id, ctx, metadata: { productId: id, from: moved.from, to: moved.to, actorId: viewer.id, summary: `Moved from ${moved.from} to ${moved.to}` } });
  if (said.length) await audit('product_updated', { accountId: viewer.id, ctx, metadata: { productId: id, changed: Object.keys(data), actorId: viewer.id, summary: said.join(' · ') } });
  return detailReply(id);
}

/* ---------- photos (decision 6.3: up to 5, the first is the main one) ---------- */

export async function addPhoto({ viewer, id, photo, ctx }) {
  const p = await P.findLive(id);
  if (!p) throw GONE();
  if (p.images.length >= LIMITS.photos) throw conflict('TOO_MANY_PHOTOS', `A saree can have up to ${LIMITS.photos} photos. Remove one first.`);
  const jpeg = await compressPhoto(photo);
  const stored = await storage().upload({ buffer: jpeg, contentType: 'image/jpeg', folder: 'products', ext: 'jpg' });
  const position = p.images.length ? Math.max(...p.images.map((i) => i.sortOrder)) + 1 : 0;
  await prisma.productImage.create({ data: { productId: id, url: stored.url, storageKey: stored.key, altText: p.subcategory.name, sortOrder: position } });
  await audit('product_image_uploaded', { accountId: viewer.id, ctx, metadata: { productId: id, bytes: jpeg.length, actorId: viewer.id, summary: p.images.length ? 'Photo added' : 'Main photo added' } });
  return detailReply(id);
}

export async function orderPhotos({ viewer, id, ids, ctx }) {
  const p = await P.findLive(id);
  if (!p) throw GONE();
  const have = new Set(p.images.map((i) => i.id));
  if (ids.length !== have.size || new Set(ids).size !== ids.length || ids.some((x) => !have.has(x))) throw conflict('ORDER_OUT_OF_DATE', 'The photos changed on another phone. Reload and try again.');
  await prisma.$transaction(ids.map((photoId, i) => prisma.productImage.update({ where: { id: photoId }, data: { sortOrder: i } })));
  if (ids[0] !== p.images[0]?.id) await audit('product_updated', { accountId: viewer.id, ctx, metadata: { productId: id, changed: ['images'], actorId: viewer.id, summary: 'Main photo changed' } });
  return detailReply(id);
}

export async function deletePhoto({ viewer, id, photoId, ctx }) {
  const p = await P.findLive(id);
  if (!p) throw GONE();
  const img = p.images.find((i) => i.id === photoId);
  if (!img) throw notFound('PHOTO_NOT_FOUND', 'That photo was already removed.');
  if (p.images.length === 1) throw conflict('LAST_PHOTO', 'A saree needs at least one photo. Add another first.');
  await prisma.productImage.delete({ where: { id: photoId } });
  const rest = p.images.filter((i) => i.id !== photoId);
  await prisma.$transaction(rest.map((i, n) => prisma.productImage.update({ where: { id: i.id }, data: { sortOrder: n } })));
  if (img.storageKey) storage().remove(img.storageKey).catch((e) => console.error(`[photo] could not remove ${img.storageKey}: ${e.message}`));
  await audit('product_updated', { accountId: viewer.id, ctx, metadata: { productId: id, changed: ['images'], actorId: viewer.id, summary: 'Photo removed' } });
  return detailReply(id);
}

/* ---------- tags on a saved saree (6A) ---------- */

async function loadTag(id, pieceId) {
  const p = await P.findLive(id);
  if (!p) throw GONE();
  const pc = p.pieces.find((x) => x.id === pieceId && P.SHOWN_TAG_STATUSES.includes(x.status));
  if (!pc) throw notFound('TAG_NOT_FOUND', 'That tag isn\'t on this saree any more.');
  return { p, pc, holds: await P.activeHolds(id) };
}
function assertOpen(pc, holds) {
  if (pc.status === 'reserved' || holds.has(pc.id)) throw conflict('HELD_BY_ORDER', 'A customer is paying for this saree online right now. Try again after the checkout ends.');
  if (P.SOLD.includes(pc.status)) throw conflict('TAG_SOLD', `${pc.barcode} was sold. A sold saree's tag can't be changed.`);
  if (pc.status === 'retired') throw conflict('TAG_RETIRED', `${pc.barcode} was retired. Its number can't be used again.`);
  if (!UNSOLD.includes(pc.status)) throw conflict('TAG_LOCKED', `${pc.barcode} can't be changed now.`);
}
function newCode(code, pc) {
  const tidy = normalizeTag(code);
  if (!isValidTag(tidy)) throw badRequest('TAG_INVALID', 'That doesn\'t look like a tag. Scan it again or type the number on it.');
  if (tidy === pc.barcode) throw badRequest('SAME_TAG', `${tidy} is already this saree's tag.`);
  return tidy;
}
// Saves a change to a tag only if it is still as it was read: a sale (or another phone) that
// changed it a moment ago wins, and this change is refused instead of overwriting it.
const tagChanged = () => conflict('TAG_CHANGED', 'This tag changed a moment ago (it may have just been sold). Open the saree again and check.');
async function updateTag(tx, pc, data) {
  const r = await tx.piece.updateMany({ where: { id: pc.id, status: pc.status, barcode: pc.barcode }, data });
  if (r.count !== 1) throw tagChanged();
}
const ledger = (tx, p, pc, delta, reason, actorId, ref) => tx.stockLedger.create({ data: { productId: p.id, pieceId: pc.id, delta, reason, channel: 'store', actorId, ref } });
async function inTx(fn, code) {
  try {
    return await prisma.$transaction(fn);
  } catch (e) {
    if (P.isUniqueClash(e, 'barcode')) throw conflict('TAG_TAKEN', `${code} was just put on another saree.`, { code });
    throw e;
  }
}

// T3: a wrong tag. The same tag row gets the right number; the wrong one is free.
export async function changeTag({ viewer, id, pieceId, code, ctx }) {
  const { p, pc, holds } = await loadTag(id, pieceId);
  assertOpen(pc, holds);
  const to = newCode(code, pc);
  const clash = await tagClash(to, { ignorePieceId: pc.id });
  if (clash.error) throw clash.error;
  await inTx(async (tx) => {
    if (clash.reclaim) await reclaim(tx, clash.reclaim);
    await updateTag(tx, pc, { barcode: to });
    await ledger(tx, p, pc, 0, 'tag_changed', viewer.id, `${pc.barcode} → ${to}`);
  }, to);
  await audit('product_tag_changed', { accountId: viewer.id, ctx, metadata: { productId: id, pieceId, from: pc.barcode, to, actorId: viewer.id, summary: `Tag changed ${pc.barcode} → ${to} (wrong tag)` } });
  return detailReply(id);
}

// T4: a damaged tag. The old number is retired for good; a new tag takes its place.
export async function replaceTag({ viewer, id, pieceId, code, ctx }) {
  const { p, pc, holds } = await loadTag(id, pieceId);
  assertOpen(pc, holds);
  const to = newCode(code, pc);
  const clash = await tagClash(to);
  if (clash.error) throw clash.error;
  const counts = pc.status === 'in_stock' ? 1 : 0;
  await inTx(async (tx) => {
    if (clash.reclaim) await reclaim(tx, clash.reclaim);
    await updateTag(tx, pc, { status: 'retired' });
    await ledger(tx, p, pc, -counts, 'tag_retired', viewer.id, pc.barcode);
    const fresh = await tx.piece.create({ data: { productId: p.id, barcode: to, status: pc.status } });
    await ledger(tx, p, fresh, counts, 'tag_replaced', viewer.id, `${pc.barcode} → ${to}`);
  }, to);
  await audit('product_tag_replaced', { accountId: viewer.id, ctx, metadata: { productId: id, pieceId, from: pc.barcode, to, actorId: viewer.id, summary: `Tag ${pc.barcode} damaged, replaced with ${to}. ${pc.barcode} retired.` } });
  return detailReply(id);
}

// T5: the saree itself is damaged (not for sale), or fine again.
export async function setDamaged({ viewer, id, pieceId, damaged, ctx }) {
  const { p, pc, holds } = await loadTag(id, pieceId);
  if (damaged) {
    assertOpen(pc, holds);
    if (pc.status === 'damaged') return detailReply(id);
  } else if (pc.status !== 'damaged') throw conflict('NOT_DAMAGED', `${pc.barcode} isn't marked damaged.`);
  await prisma.$transaction(async (tx) => {
    await updateTag(tx, pc, { status: damaged ? 'damaged' : 'in_stock' });
    await ledger(tx, p, pc, damaged ? -1 : 1, damaged ? 'damaged' : 'back_in_stock', viewer.id, pc.barcode);
  });
  await audit(damaged ? 'product_marked_damaged' : 'product_back_in_stock', { accountId: viewer.id, ctx, metadata: { productId: id, pieceId, code: pc.barcode, actorId: viewer.id, summary: damaged ? `Marked damaged, not for sale (${pc.barcode})` : `Back in stock (${pc.barcode})` } });
  return detailReply(id);
}

// An extra tag taken off an old listing (only when another tag stays). Its number is freed.
export async function removeTag({ viewer, id, pieceId, ctx }) {
  const { p, pc, holds } = await loadTag(id, pieceId);
  assertOpen(pc, holds);
  const live = p.pieces.filter((x) => P.SHOWN_TAG_STATUSES.includes(x.status) && x.status !== 'retired');
  if (live.length < 2) throw conflict('LAST_TAG', 'A saree needs its tag. Change the tag instead, or delete the saree.');
  await prisma.$transaction(async (tx) => {
    await updateTag(tx, pc, { barcode: freedName(pc.barcode, 'rm', pc.id), status: 'removed' });
    await ledger(tx, p, pc, pc.status === 'in_stock' ? -1 : 0, 'removed', viewer.id, pc.barcode);
  });
  await audit('product_tag_removed', { accountId: viewer.id, ctx, metadata: { productId: id, pieceId, code: pc.barcode, actorId: viewer.id, summary: `Tag ${pc.barcode} removed (added by mistake)` } });
  return detailReply(id);
}

/* ---------- delete (decision 6.1) ---------- */

export async function deleteProduct({ viewer, id, ctx }) {
  const p = await P.findLive(id);
  if (!p) throw GONE();
  const holds = await P.activeHolds(id);
  if (holds.size || p.pieces.some((x) => x.status === 'reserved')) throw conflict('HELD_BY_ORDER', 'A customer is paying for this saree online right now. Try again after the checkout ends.');
  const freed = p.pieces.filter((x) => UNSOLD.includes(x.status));
  await prisma.$transaction(async (tx) => {
    await tx.product.update({ where: { id }, data: { deletedAt: new Date(), isActive: false, channelVisibility: 'hidden' } });
    for (const pc of freed) {
      await updateTag(tx, pc, { barcode: freedName(pc.barcode, 'del', pc.id), status: 'removed' });
      await ledger(tx, p, pc, pc.status === 'in_stock' ? -1 : 0, 'deleted', viewer.id, pc.barcode);
    }
  });
  const codes = freed.map((x) => x.barcode);
  await audit('product_deleted', { accountId: viewer.id, ctx, metadata: { productId: id, name: p.subcategory.name, sku: p.sku, barcodes: p.pieces.map((x) => x.barcode), freedTags: codes, archived: true, actorId: viewer.id, summary: 'Deleted (kept for bills and reports)' } });
  return { deleted: true, freedTags: codes };
}
