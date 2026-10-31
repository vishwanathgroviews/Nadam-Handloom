// Product (saree) queries. A "live" product is one that isn't deleted (deletedAt is
// empty); deleted ones are kept for bills and reports but never listed (decision 6.1).
import { Prisma } from '@prisma/client';
import { prisma } from '../config/database.js';
import { tagCandidates, tagNumber } from '../utils/tags.js';

export const LIVE = { deletedAt: null };
// Tags that still belong to the saree (not retired, not taken off).
export const SHOWN_TAG_STATUSES = ['in_stock', 'reserved', 'sold_online', 'sold_offline', 'damaged', 'returned', 'retired'];
export const SOLD = ['sold_online', 'sold_offline'];

const LIST_INCLUDE = {
  images: { orderBy: { sortOrder: 'asc' }, take: 1, select: { url: true } },
  pieces: { where: { status: { in: SHOWN_TAG_STATUSES } }, orderBy: { createdAt: 'asc' }, select: { id: true, barcode: true, status: true } },
  subcategory: { select: { id: true, name: true, storePrice: true, onlinePrice: true, isActive: true } },
  category: { select: { id: true, name: true } },
};
export const DETAIL_INCLUDE = {
  images: { orderBy: { sortOrder: 'asc' }, select: { id: true, url: true, storageKey: true, sortOrder: true } },
  pieces: { orderBy: { createdAt: 'asc' }, select: { id: true, barcode: true, status: true, soldAt: true, createdAt: true, updatedAt: true } },
  subcategory: { select: { id: true, name: true, storePrice: true, onlinePrice: true, mrp: true, isActive: true, status: true } },
  category: { select: { id: true, name: true, slug: true, isActive: true, status: true } },
};

/* ---------- the list ---------- */

// The filter chips on the Products tab, as database conditions.
const inStockWhere = { pieces: { some: { status: 'in_stock' } } };
export const FILTER_WHERE = {
  all: {},
  instock: inStockWhere,
  soldout: { pieces: { none: { status: { in: ['in_stock', 'reserved', 'damaged'] } } } },
  nophoto: { images: { none: {} } },
  online: { channelVisibility: 'online_only' },
  store: { channelVisibility: 'store_only' },
};

export const listPage = ({ where, skip, take }, db = prisma) =>
  db.product.findMany({ where: { ...LIVE, ...where }, include: LIST_INCLUDE, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip, take });

export async function filterCounts(where = {}, db = prisma) {
  const keys = Object.keys(FILTER_WHERE);
  const counts = await Promise.all(keys.map((k) => db.product.count({ where: { ...LIVE, ...where, ...FILTER_WHERE[k] } })));
  return Object.fromEntries(keys.map((k, i) => [k, counts[i]]));
}

// Search: a number finds the tag with that number first (2264 → NH2264), then SKUs
// containing it; words match the name, the subcategory, the SKU, or a whole tag.
export async function search(q, where = {}, take = 60, db = prisma) {
  const query = q.trim();
  const digits = /^\d+$/.test(query);
  const tidy = query.replace(/\s+/g, '').toUpperCase();
  const or = digits
    ? [{ pieces: { some: { barcode: { endsWith: query }, status: { in: SHOWN_TAG_STATUSES } } } }, { sku: { contains: query } }, { pieces: { some: { barcode: { in: tagCandidates(query) } } } }]
    : [
      { name: { contains: query, mode: 'insensitive' } },
      { subcategory: { is: { name: { contains: query, mode: 'insensitive' } } } },
      { sku: { contains: tidy, mode: 'insensitive' } },
      { pieces: { some: { barcode: { in: tagCandidates(query) } } } },
    ];
  const rows = await db.product.findMany({ where: { ...LIVE, ...where, OR: or }, include: LIST_INCLUDE, orderBy: [{ createdAt: 'desc' }], take: take * 2 });
  const exact = (p) => p.pieces.some((pc) => (digits ? tagNumber(pc.barcode) === query : tagCandidates(query).includes(pc.barcode)));
  // A number that only matched as the end of a longer tag number (…12264) isn't a hit.
  const kept = rows.filter((p) => !digits || exact(p) || p.sku.includes(query) || p.pieces.some((pc) => pc.barcode === query));
  return [...kept.filter(exact), ...kept.filter((p) => !exact(p))].slice(0, take);
}

/* ---------- totals ---------- */

// Sarees in stock: live, on sale (isActive) and with at least one tag in stock.
// The 5,000 limit counts these only (decision 6.8).
export const countInStock = (db = prisma) => db.product.count({ where: { ...LIVE, isActive: true, ...inStockWhere } });
export const countListings = (db = prisma) => db.product.count({ where: LIVE });

/* ---------- one product ---------- */

export const findLive = (id, db = prisma) => db.product.findFirst({ where: { id, ...LIVE }, include: DETAIL_INCLUDE });
export const findByClientRef = (clientRef, db = prisma) => db.product.findUnique({ where: { clientRef }, include: DETAIL_INCLUDE });

// Active checkout holds on this product's tags: { pieceId: { expiresAt, orderNumber } }.
export async function activeHolds(productId, db = prisma) {
  const rows = await db.reservation.findMany({
    where: { productId, status: 'active', expiresAt: { gt: new Date() } },
    select: { pieceId: true, expiresAt: true, order: { select: { orderNumber: true } } },
  });
  return new Map(rows.map((r) => [r.pieceId, { expiresAt: r.expiresAt, orderNumber: r.order?.orderNumber ?? null }]));
}

// Who added the saree: the person on its first "restock" entry (old and new app).
export async function addedBy(productId, db = prisma) {
  const first = await db.stockLedger.findFirst({ where: { productId, reason: 'restock' }, orderBy: { createdAt: 'asc' }, select: { actorId: true } });
  return first?.actorId ?? null;
}

// The activity trail entries about this saree (newest first).
export const events = (productId, take = 8, db = prisma) =>
  db.authEvent.findMany({ where: { metadata: { path: ['productId'], equals: productId } }, orderBy: { createdAt: 'desc' }, take });

/* ---------- tags ---------- */

// The piece holding a tag, in any form the camera may report. Freed (renamed) tags never match.
export const pieceByTag = (code, db = prisma) =>
  db.piece.findFirst({
    where: { barcode: { in: tagCandidates(code) } },
    include: { product: { select: { id: true, name: true, sku: true, deletedAt: true, subcategory: { select: { name: true } }, images: { orderBy: { sortOrder: 'asc' }, take: 1, select: { url: true } } } } },
  });

// Find by the number on the tag ("2264"): live sarees only.
export async function piecesByNumber(digits, db = prisma) {
  const rows = await db.piece.findMany({
    where: { barcode: { endsWith: digits }, status: { in: SHOWN_TAG_STATUSES }, product: { is: LIVE } },
    include: { product: { select: { id: true, name: true, sku: true, subcategory: { select: { name: true } } } } },
  });
  return rows.filter((p) => tagNumber(p.barcode) === digits);
}

/* ---------- SKU and web address ---------- */

// SKU prefix from the category's web address, as the old app: initials, at most 4.
export const categoryCode = (slug) => slug.split('-').filter(Boolean).map((w) => w[0]).join('').toUpperCase().slice(0, 4) || 'GEN';

// One past the highest SKU number issued under this prefix (deleted products included).
export async function nextSku(categorySlug, db = prisma) {
  const prefix = `NH-${categoryCode(categorySlug)}-`;
  // NH-<code>-<number>: the number is the third dash-separated part.
  const rows = await db.$queryRaw`
    SELECT coalesce(max(split_part(sku, '-', 3)::int), 0)::int AS high
    FROM "Product" WHERE sku LIKE ${`${prefix}%`} AND split_part(sku, '-', 3) ~ '^[0-9]+$' AND split_part(sku, '-', 4) = ''`;
  return `${prefix}${String(rows[0].high + 1).padStart(3, '0')}`;
}

export function slugify(name) {
  return name.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'saree';
}
// "rainbow-checks-sarees", then "-2", "-3"…: one query for the whole family.
export async function uniqueSlug(name, db = prisma) {
  const root = slugify(name);
  const rows = await db.product.findMany({ where: { OR: [{ slug: root }, { slug: { startsWith: `${root}-` } }] }, select: { slug: true } });
  const taken = new Set(rows.map((r) => r.slug));
  if (!taken.has(root)) return root;
  let n = 2;
  for (const s of taken) {
    const m = s.slice(root.length + 1);
    if (/^\d+$/.test(m)) n = Math.max(n, Number(m) + 1);
  }
  while (taken.has(`${root}-${n}`)) n += 1;
  return `${root}-${n}`;
}

// One saree at a time gets its SKU and web address, so two phones adding at once
// don't pick the same "next" one. The old app can still clash: callers retry.
export const lockNumbering = (db) => db.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext('nandam-product-numbering'))");

export const isUniqueClash = (e, field) =>
  e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002' && (!field || JSON.stringify(e.meta || {}).includes(field) || String(e.message).includes(field));
