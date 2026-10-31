// Website W5: the bag's queries. A signed-in customer's bag is one BagItem row per saree;
// what is "on the website" comes from services/shop/visibility.js.
import { prisma } from '../config/database.js';
import { CARD_SELECT } from './shopCatalog.model.js';

// What a bag line shows: a saree card's fields (price, stock, photo, collection, category).
export const LINE_SELECT = { ...CARD_SELECT, category: { select: { slug: true, name: true } } };

// One customer's bag changes one request at a time (two tabs, two phones, a double tap).
export const lockFor = (authAccountId, db) => db.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`shop-bag:${authAccountId}`}))`;

export const productsBySlugs = (slugs, db = prisma) => db.product.findMany({ where: { slug: { in: slugs } }, select: LINE_SELECT });

// The ids, among these, of sarees that are on the website (sold out or not).
export async function listedIds(ids, listedWhere, db = prisma) {
  if (!ids.length) return new Set();
  const rows = await db.product.findMany({ where: { AND: [listedWhere, { id: { in: ids } }] }, select: { id: true } });
  return new Set(rows.map((r) => r.id));
}

export const rowsFor = (authAccountId, db = prisma) =>
  db.bagItem.findMany({ where: { authAccountId }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], include: { product: { select: LINE_SELECT } } });

// Pieces this customer's own unpaid checkouts hold (W6): still theirs to buy, so their bag
// doesn't call them sold out while they pay. productId → number held.
export async function heldFor(authAccountId, db = prisma) {
  const rows = await db.reservation.groupBy({
    by: ['productId'],
    where: { status: 'active', order: { is: { authAccountId, channel: 'online', status: 'pending_payment' } } },
    _sum: { quantity: true },
  });
  return new Map(rows.map((r) => [r.productId, r._sum.quantity ?? 0]));
}

export const countFor = (authAccountId, db = prisma) => db.bagItem.count({ where: { authAccountId } });

export const find = (authAccountId, productId, db = prisma) => db.bagItem.findUnique({ where: { authAccountId_productId: { authAccountId, productId } } });

export const create = (data, db = prisma) => db.bagItem.create({ data });

export const setQuantity = (id, quantity, db = prisma) => db.bagItem.update({ where: { id }, data: { quantity } });

export const update = (id, data, db = prisma) => db.bagItem.update({ where: { id }, data });

export const removeBySlug = (authAccountId, slug, db = prisma) => db.bagItem.deleteMany({ where: { authAccountId, product: { is: { slug } } } });

export const removeAll = (authAccountId, db = prisma) => db.bagItem.deleteMany({ where: { authAccountId } });

// A change by the customer means they have seen today's prices: the "price changed" notes go.
export const acknowledgePrices = (authAccountId, db = prisma) => db.$executeRaw`
  UPDATE "BagItem" b SET "priceSeen" = s."onlinePrice"
  FROM "Product" p JOIN "Subcategory" s ON s."id" = p."subcategoryId"
  WHERE b."productId" = p."id" AND b."authAccountId" = ${authAccountId} AND b."priceSeen" <> s."onlinePrice"`;

// Clean-up job: sarees nobody has touched for a long time (their bag is forgotten).
export const deleteUnchangedSince = (before, db = prisma) => db.bagItem.deleteMany({ where: { updatedAt: { lt: before } } });
