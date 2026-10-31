// Analytics queries (Module 9). Which sales count is Module 8's rule (stats.model.js).
import { prisma } from '../config/database.js';
import { COUNTED } from './stats.model.js';
import { withRolesAndName } from './authAccount.model.js';

const channelWhere = (channel) => (channel && channel !== 'all' ? { channel } : {});

// Every counted sale in the period, with its lines and each line's design.
export const ordersIn = ({ from, to }, channel, db = prisma) =>
  db.order.findMany({
    where: { ...COUNTED, ...channelWhere(channel), placedAt: { gte: from, lte: to } },
    select: {
      id: true, orderNumber: true, channel: true, total: true, paymentMethod: true, placedAt: true,
      items: {
        select: {
          productId: true, pieceId: true, quantity: true, priceSnapshot: true, storePrice: true, nameSnapshot: true, imageSnapshot: true,
          product: { select: { subcategory: { select: { id: true, name: true, imageUrl: true, category: { select: { name: true } } } } } },
        },
      },
    },
    orderBy: { placedAt: 'asc' },
  });

// Totals only (the period before).
export async function totalsIn({ from, to }, channel, db = prisma) {
  const where = { ...COUNTED, ...channelWhere(channel), placedAt: { gte: from, lte: to } };
  const [o, i] = await Promise.all([
    db.order.aggregate({ where, _sum: { total: true }, _count: { _all: true } }),
    db.orderItem.aggregate({ where: { order: where }, _sum: { quantity: true } }),
  ]);
  return { amount: Number(o._sum.total ?? 0), bills: o._count._all, sarees: i._sum.quantity ?? 0 };
}

// Sales cancelled in the period (an online order only if it had been paid): not counted.
export async function cancelledIn({ from, to }, channel, db = prisma) {
  const r = await db.order.aggregate({
    where: {
      ...channelWhere(channel),
      placedAt: { gte: from, lte: to },
      OR: [
        { channel: { in: ['store', 'whatsapp'] }, OR: [{ status: 'cancelled' }, { cancelledAt: { not: null } }] },
        { channel: 'online', status: 'cancelled', payment: { is: { status: 'paid' } } },
      ],
    },
    _sum: { total: true },
    _count: { _all: true },
  });
  return { bills: r._count._all, amount: Number(r._sum.total ?? 0) };
}

// The store price recorded with each bargain (Module 5 and the old app), by order.
export async function bargainPrices(orderIds, db = prisma) {
  const out = new Map();
  if (!orderIds.length) return out;
  const rows = await db.$queryRaw`
    SELECT metadata FROM "AuthEvent"
    WHERE "eventType" = 'offline_sale_price_override' AND metadata->>'orderId' = ANY(${orderIds})`;
  for (const { metadata: m } of rows) {
    const key = `${m.orderId}:${m.pieceId ?? m.productId}`;
    if (!out.has(key) && m.categoryStorePrice != null) out.set(key, Number(m.categoryStorePrice));
  }
  return out;
}

// The first counted sale: history starts here.
export const firstSale = (db = prisma) => db.order.findFirst({ where: COUNTED, orderBy: { placedAt: 'asc' }, select: { placedAt: true } });

export const people = (ids, db = prisma) => db.authAccount.findMany({ where: { id: { in: ids } }, include: withRolesAndName });
export const person = (id, db = prisma) => db.authAccount.findUnique({ where: { id }, include: withRolesAndName });

// Stock by design: sarees in stock, store price, when the first saree came in, the last
// sale and sales since `since`.
export const stockByDesign = (since, db = prisma) => db.$queryRaw`
  SELECT s.id, s.name, s."imageUrl", s."storePrice"::float AS "storePrice", s."onlinePrice"::float AS "onlinePrice", s.mrp::float AS mrp, c.name AS category,
    count(p.id) FILTER (WHERE p.status = 'in_stock')::int AS "inStock",
    min(p."createdAt") AS "firstAdded",
    max(p."soldAt") FILTER (WHERE p.status IN ('sold_online', 'sold_offline')) AS "lastSold",
    count(p.id) FILTER (WHERE p.status IN ('sold_online', 'sold_offline') AND p."soldAt" >= ${since})::int AS "soldRecent"
  FROM "Piece" p
  JOIN "Product" pr ON pr.id = p."productId" AND pr."deletedAt" IS NULL
  JOIN "Subcategory" s ON s.id = pr."subcategoryId" AND s.status = 'active'
  JOIN "Category" c ON c.id = s."categoryId" AND c.status = 'active'
  GROUP BY s.id, c.name
  HAVING count(p.id) FILTER (WHERE p.status = 'in_stock') > 0`;

export const firstTagged = (db = prisma) => db.piece.findFirst({ orderBy: { createdAt: 'asc' }, select: { createdAt: true } });
