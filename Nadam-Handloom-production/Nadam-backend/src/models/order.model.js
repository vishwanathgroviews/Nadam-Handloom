// Order queries (Module 7): online and WhatsApp orders, which are packed and shipped.
// Counter sales have no shipping (Module 5).
import { prisma } from '../config/database.js';
import { tagCandidates } from '../utils/tags.js';

export const SHIP_CHANNELS = ['online', 'whatsapp'];

// The three lists (decision 6.2: To ship oldest first).
export const TAB_WHERE = {
  to_ship: { channel: { in: SHIP_CHANNELS }, status: 'processing' },
  shipped: { channel: { in: SHIP_CHANNELS }, status: 'shipped' },
  delivered: { channel: { in: SHIP_CHANNELS }, status: 'delivered' },
};
export const TAB_ORDER = {
  to_ship: [{ placedAt: 'asc' }, { id: 'asc' }],
  shipped: [{ shipment: { shippedAt: 'desc' } }, { placedAt: 'desc' }],
  delivered: [{ shipment: { deliveredAt: 'desc' } }, { placedAt: 'desc' }],
};

const ROW_INCLUDE = {
  items: { select: { quantity: true, imageSnapshot: true } },
  shipment: { select: { carrier: true, awbNumber: true, status: true, shippedAt: true, deliveredAt: true } },
};
export const DETAIL_INCLUDE = {
  items: { orderBy: [{ lineNo: { sort: 'asc', nulls: 'last' } }, { id: 'asc' }], include: { piece: { select: { id: true, barcode: true } }, product: { select: { slug: true } } } },
  shipment: true,
  invoice: true,
  payment: { select: { status: true, provider: true, razorpayPaymentId: true, amount: true, updatedAt: true, method: true, capturedAt: true } },
  authAccount: { select: { phone: true, email: true, userProfile: { select: { firstName: true, lastName: true } } } },
};

export const listPage = (tab, { skip, take }, db = prisma) =>
  db.order.findMany({ where: TAB_WHERE[tab], include: ROW_INCLUDE, orderBy: TAB_ORDER[tab], skip, take });
export const countTab = (tab, db = prisma) => db.order.count({ where: TAB_WHERE[tab] });

// Search every online and WhatsApp order: order number, customer name or mobile,
// tracking number, or a saree's tag.
export async function search(q, take = 60, db = prisma) {
  const term = String(q || '').trim();
  if (!term) return [];
  const like = `%${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  const digits = term.replace(/\D/g, '');
  const phone = digits.length >= 5 ? `%${digits.slice(-10)}%` : '__never__';
  const tags = tagCandidates(term.toUpperCase().replace(/\s+/g, ''));
  const rows = await db.$queryRaw`
    SELECT o.id FROM "Order" o
    WHERE o.channel IN ('online', 'whatsapp') AND (
      o."orderNumber" ILIKE ${like}
      OR o."shippingAddress"->>'fullName' ILIKE ${like}
      OR o."shippingAddress"->>'phone' LIKE ${phone}
      OR EXISTS (SELECT 1 FROM "Shipment" s WHERE s."orderId" = o.id AND s."awbNumber" ILIKE ${like})
      OR EXISTS (SELECT 1 FROM "AuthAccount" a WHERE a.id = o."authAccountId" AND a.phone LIKE ${phone})
      OR EXISTS (SELECT 1 FROM "OrderItem" oi JOIN "Piece" p ON p.id = oi."pieceId" WHERE oi."orderId" = o.id AND p.barcode = ANY(${tags}))
    )
    ORDER BY o."placedAt" DESC LIMIT ${take}`;
  if (!rows.length) return [];
  const found = await db.order.findMany({ where: { id: { in: rows.map((r) => r.id) } }, include: ROW_INCLUDE });
  const byId = new Map(found.map((o) => [o.id, o]));
  return rows.map((r) => byId.get(r.id)).filter(Boolean);
}

export const findOne = (id, db = prisma) => db.order.findFirst({ where: { id, channel: { in: SHIP_CHANNELS } }, include: DETAIL_INCLUDE });

// The order a tracking number is already on (decision 6.5). Orders shipped from the old
// app can share a number, so this is the earliest one that is not the order being shipped.
export const shipmentWithAwb = (awb, exceptOrderId, db = prisma) =>
  db.shipment.findFirst({
    where: { awbNumber: awb, NOT: { orderId: exceptOrderId } },
    orderBy: { createdAt: 'asc' },
    include: { order: { select: { id: true, orderNumber: true, shippingAddress: true } } },
  });

// One tracking number at a time across the shop (two phones scanning the same label).
export const lockAwb = (db) => db.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext('nandam-awb'))");

// Website checkouts never paid (decision 6.7): older than 15 minutes, newer than 30 days.
export const unpaidCheckouts = (db = prisma) =>
  db.order.findMany({
    where: { channel: 'online', status: 'pending_payment', placedAt: { lt: new Date(Date.now() - 15 * 60000), gte: new Date(Date.now() - 30 * 86400000) } },
    include: {
      items: { select: { nameSnapshot: true, imageSnapshot: true, quantity: true, priceSnapshot: true } },
      authAccount: { select: { id: true, phone: true, email: true, userProfile: { select: { firstName: true, lastName: true } } } },
    },
    orderBy: { placedAt: 'desc' },
  });

// The changes to an order's tracking number, from the activity log.
export const trackingChanges = (orderId, db = prisma) =>
  db.authEvent.findMany({ where: { eventType: 'order_tracking_changed', metadata: { path: ['orderId'], equals: orderId } }, orderBy: { createdAt: 'asc' } });
