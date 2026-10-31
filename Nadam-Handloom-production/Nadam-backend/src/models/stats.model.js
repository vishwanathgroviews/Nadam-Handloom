// Sales figures and counts for Home (Module 8); Analytics (Module 9) uses the same rule.
// A sale counts when it is a counter, WhatsApp or paid online order that isn't
// cancelled (plan Module 8, section 8). Days are India days (utils/day.js).
import { prisma } from '../config/database.js';
import { LIVE, FILTER_WHERE } from './product.model.js';

export const COUNTED_STATUSES = ['processing', 'shipped', 'delivered'];
export const COUNTED = { channel: { in: ['store', 'whatsapp', 'online'] }, status: { in: COUNTED_STATUSES }, cancelledAt: null };

// Total and number of bills placed from `from` up to (not including) `to`.
export async function sumRange(from, to, db = prisma) {
  const r = await db.order.aggregate({ where: { ...COUNTED, placedAt: { gte: from, lt: to } }, _sum: { total: true }, _count: { _all: true } });
  return { amount: Number(r._sum.total ?? 0), bills: r._count._all };
}

// Paid online orders (and those cancelled after paying) placed from `from`, newest first.
// A checkout cancelled before it was paid (an owner's "Sell anyway") is not a sale.
export const onlineSince = (from, to = null, db = prisma) =>
  db.order.findMany({
    where: {
      channel: 'online',
      placedAt: { gte: from, ...(to ? { lt: to } : {}) },
      OR: [{ status: { in: COUNTED_STATUSES } }, { status: 'cancelled', payment: { is: { status: 'paid' } } }],
    },
    include: { items: { select: { quantity: true, imageSnapshot: true } }, invoice: { select: { invoiceNumber: true } } },
    orderBy: { placedAt: 'desc' },
  });

// The oldest order waiting to ship (Module 7's To ship).
export const oldestToShip = (db = prisma) =>
  db.order.findFirst({ where: { channel: { in: ['online', 'whatsapp'] }, status: 'processing' }, orderBy: { placedAt: 'asc' }, select: { placedAt: true } });

// Parcels shipped before `before` and not marked delivered.
export async function toCheck(before, db = prisma) {
  const where = { channel: { in: ['online', 'whatsapp'] }, status: 'shipped', shipment: { is: { shippedAt: { lt: before } } } };
  const [count, oldest] = await Promise.all([
    db.order.count({ where }),
    db.shipment.findFirst({ where: { order: where, shippedAt: { lt: before } }, orderBy: { shippedAt: 'asc' }, select: { shippedAt: true, orderId: true } }),
  ]);
  return { count, oldestShippedAt: oldest?.shippedAt ?? null, oldestId: oldest?.orderId ?? null };
}

// Website checkouts not paid since `since` (older than 15 minutes), by customer.
export async function unpaidSince(since, db = prisma) {
  const rows = await db.order.findMany({
    where: { channel: 'online', status: 'pending_payment', placedAt: { gte: since, lt: new Date(Date.now() - 15 * 60000) } },
    select: { id: true, authAccountId: true },
  });
  return { customers: new Set(rows.map((r) => r.authAccountId || r.id)).size, tries: rows.length };
}

// Counter and WhatsApp sales since `since` that asked for an invoice and have none.
export const invoiceMissing = (since, db = prisma) =>
  db.order.findMany({
    where: { channel: { in: ['store', 'whatsapp'] }, invoiceRequired: true, invoice: null, status: { not: 'cancelled' }, cancelledAt: null, placedAt: { gte: since } },
    select: { id: true, orderNumber: true, placedAt: true },
    orderBy: { placedAt: 'desc' },
  });

// Live sarees without a photo: the same list as the Products "No photo" filter.
export const countNoPhoto = (db = prisma) => db.product.count({ where: { ...LIVE, ...FILTER_WHERE.nophoto } });

// Designs (subcategories) with 1–3 sarees in stock, or none left with one sold since
// `since`. Designs that never had a tagged saree have no pieces, so they never show.
export function lowDesigns(since, db = prisma) {
  return db.$queryRaw`
    SELECT s.id, s.name, s."imageUrl", c.name AS category,
      count(p.id) FILTER (WHERE p.status = 'in_stock')::int AS "left",
      count(p.id) FILTER (WHERE p.status IN ('sold_online', 'sold_offline') AND coalesce(p."soldAt", p."updatedAt") >= ${since})::int AS "soldRecent",
      max(coalesce(p."soldAt", p."updatedAt")) FILTER (WHERE p.status IN ('sold_online', 'sold_offline')) AS "lastSold"
    FROM "Subcategory" s
    JOIN "Category" c ON c.id = s."categoryId" AND c.status = 'active'
    JOIN "Product" pr ON pr."subcategoryId" = s.id AND pr."deletedAt" IS NULL
    JOIN "Piece" p ON p."productId" = pr.id
    WHERE s.status = 'active'
    GROUP BY s.id, c.name
    HAVING count(p.id) FILTER (WHERE p.status = 'in_stock') BETWEEN 1 AND 3
      OR (count(p.id) FILTER (WHERE p.status = 'in_stock') = 0
          AND count(p.id) FILTER (WHERE p.status IN ('sold_online', 'sold_offline') AND coalesce(p."soldAt", p."updatedAt") >= ${since}) > 0)
    ORDER BY "left" ASC, "lastSold" DESC NULLS LAST, s.name ASC`;
}
