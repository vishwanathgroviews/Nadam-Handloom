// Catalogue queries: categories, subcategories and the counts the screens show.
// Only ACTIVE rows are ever read for lists; "deleted" rows stay in the table with
// status = 'inactive' (Module 3, decision 5.0).
import { Prisma } from '@prisma/client';
import { prisma } from '../config/database.js';

export const ACTIVE = 'active';
export const INACTIVE = 'inactive';
const order = [{ sortOrder: 'asc' }, { name: 'asc' }];

export const listCategories = (db = prisma) => db.category.findMany({ where: { status: ACTIVE }, orderBy: order });
export const findCategory = (id, db = prisma) => db.category.findFirst({ where: { id, status: ACTIVE } });
export const listSubcategories = (where = {}, db = prisma) =>
  db.subcategory.findMany({ where: { status: ACTIVE, category: { is: { status: ACTIVE } }, ...where }, orderBy: order, include: { category: { select: { id: true, name: true } } } });
export const findSubcategory = (id, db = prisma) =>
  db.subcategory.findFirst({ where: { id, status: ACTIVE, category: { is: { status: ACTIVE } } }, include: { category: { select: { id: true, name: true } }, catalogPdf: true } });

export const countActiveSubcategories = (categoryId, db = prisma) => db.subcategory.count({ where: { categoryId, status: ACTIVE } });

// Name taken by another ACTIVE row (ignoring capitals and extra spaces), the same
// rule as the database's partial unique indexes.
export async function categoryNameTaken(name, exceptId = null, db = prisma) {
  const rows = await db.$queryRaw`SELECT id FROM "Category" WHERE status = 'active' AND lower(regexp_replace(btrim(name), '\\s+', ' ', 'g')) = lower(regexp_replace(btrim(${name}), '\\s+', ' ', 'g')) AND (${exceptId}::text IS NULL OR id <> ${exceptId}) LIMIT 1`;
  return rows.length > 0;
}
export async function subcategoryNameTaken(categoryId, name, exceptId = null, db = prisma) {
  const rows = await db.$queryRaw`SELECT id FROM "Subcategory" WHERE status = 'active' AND "categoryId" = ${categoryId} AND lower(regexp_replace(btrim(name), '\\s+', ' ', 'g')) = lower(regexp_replace(btrim(${name}), '\\s+', ' ', 'g')) AND (${exceptId}::text IS NULL OR id <> ${exceptId}) LIMIT 1`;
  return rows.length > 0;
}

export const slugTaken = async (slug, db = prisma) => !!(await db.category.findUnique({ where: { slug }, select: { id: true } }));
export const nextPosition = async (model, where, db = prisma) => ((await db[model].aggregate({ where: { ...where, status: ACTIVE }, _max: { sortOrder: true } }))._max.sortOrder ?? 0) + 1;

// Per subcategory: products (not archived), pieces in stock or held by an online
// order, and products the catalogue PDF can show (active, photo, in stock).
export async function statsFor(subcategoryIds, db = prisma) {
  const out = new Map(subcategoryIds.map((id) => [id, { products: 0, inStock: 0, pdfReady: 0 }]));
  if (!subcategoryIds.length) return out;
  const ids = Prisma.join(subcategoryIds);
  const products = await db.$queryRaw`
    SELECT p."subcategoryId" AS id, count(*)::int AS n, coalesce(sum(greatest(p.stock, 0)), 0)::int AS stock
    FROM "Product" p WHERE p."deletedAt" IS NULL AND p."subcategoryId" IN (${ids}) GROUP BY 1`;
  const pieces = await db.$queryRaw`
    SELECT p."subcategoryId" AS id, count(*)::int AS n
    FROM "Piece" pc JOIN "Product" p ON p.id = pc."productId"
    WHERE p."deletedAt" IS NULL AND pc.status IN ('in_stock', 'reserved') AND p."subcategoryId" IN (${ids}) GROUP BY 1`;
  const ready = await db.$queryRaw`
    SELECT p."subcategoryId" AS id, count(*)::int AS n FROM "Product" p
    WHERE p."deletedAt" IS NULL AND p."isActive" = true AND p."subcategoryId" IN (${ids})
      AND EXISTS (SELECT 1 FROM "ProductImage" i WHERE i."productId" = p.id)
      AND (p.stock > 0 OR EXISTS (SELECT 1 FROM "Piece" pc WHERE pc."productId" = p.id AND pc.status = 'in_stock'))
    GROUP BY 1`;
  for (const r of products) Object.assign(out.get(r.id), { products: r.n, inStock: r.stock });
  for (const r of pieces) out.get(r.id).inStock += r.n;
  for (const r of ready) out.get(r.id).pdfReady = r.n;
  return out;
}

// The products a catalogue PDF shows, oldest first, with their first photo and in-stock tags.
export const pdfProducts = (subcategoryId, db = prisma) =>
  db.product.findMany({
    where: { subcategoryId, isActive: true, deletedAt: null },
    include: {
      images: { orderBy: { sortOrder: 'asc' }, take: 1 },
      pieces: { where: { status: 'in_stock' }, orderBy: { createdAt: 'asc' }, select: { barcode: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

// Saves a new order: positions 1..n in the given order, in one go.
export async function setPositions(model, ids, db) {
  for (let i = 0; i < ids.length; i++) await db[model].update({ where: { id: ids[i] }, data: { sortOrder: i + 1 } });
}

// Price changes for one subcategory from the activity trail (old and new app).
export const priceEvents = (subcategoryId, take = 10, db = prisma) =>
  db.authEvent.findMany({
    where: { eventType: 'subcategory_price_changed', metadata: { path: ['subcategoryId'], equals: subcategoryId } },
    orderBy: { createdAt: 'desc' },
    take,
  });
