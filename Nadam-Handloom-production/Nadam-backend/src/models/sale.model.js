// Sale queries (Module 5). A sale is an Order made at the counter (channel "store")
// or for a WhatsApp customer ("whatsapp"); online checkouts are Module 7.
import { randomInt } from 'node:crypto';
import { prisma } from '../config/database.js';
import { tagCandidates, tagNumber } from '../utils/tags.js';
import { SHOWN_TAG_STATUSES, LIVE } from './product.model.js';

export const SALE_CHANNELS = ['store', 'whatsapp'];

// Everything the bill and the sale need to know about a saree.
const PIECE_INCLUDE = {
  product: {
    select: {
      id: true, name: true, sku: true, deletedAt: true, isActive: true, channelVisibility: true,
      subcategory: { select: { id: true, name: true, storePrice: true, onlinePrice: true, mrp: true } },
      images: { orderBy: { sortOrder: 'asc' }, take: 1, select: { url: true } },
    },
  },
  reservations: { where: { status: 'active' }, select: { id: true, expiresAt: true, orderId: true, order: { select: { orderNumber: true } } } },
};

// The piece holding a tag, in any form the camera may report.
export const pieceByTag = (code, db = prisma) => db.piece.findFirst({ where: { barcode: { in: tagCandidates(code) } }, include: PIECE_INCLUDE });
export const pieceById = (id, db = prisma) => db.piece.findUnique({ where: { id }, include: PIECE_INCLUDE });

// Find by the number on the tag ("2264"): live sarees only.
export async function piecesByNumber(digits, db = prisma) {
  const rows = await db.piece.findMany({ where: { barcode: { endsWith: digits }, status: { in: SHOWN_TAG_STATUSES }, product: { is: LIVE } }, include: PIECE_INCLUDE });
  return rows.filter((p) => tagNumber(p.barcode) === digits);
}

// "NH" + 8 random digits, as the old backend makes them.
export async function newOrderNumber(db = prisma) {
  for (let i = 0; i < 8; i += 1) {
    const candidate = `NH${String(randomInt(0, 100000000)).padStart(8, '0')}`;
    if (!(await db.order.findUnique({ where: { orderNumber: candidate }, select: { id: true } }))) return candidate;
  }
  throw new Error('Could not find a free order number');
}

export const SALE_INCLUDE = {
  // In the bill's order (lineNo); the old app's lines after, in a fixed order.
  items: { orderBy: [{ lineNo: { sort: 'asc', nulls: 'last' } }, { id: 'asc' }], include: { piece: { select: { id: true, barcode: true } } } },
  invoice: true,
  shipment: { select: { status: true, awbNumber: true } },
};

// One bill at a time per phone bill id (the same "Complete sale" sent twice at once).
export const lockBill = (db, clientRef) => db.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`nandam-sale:${clientRef}`}))`;

export const findSale = (id, db = prisma) => db.order.findFirst({ where: { id, channel: { in: SALE_CHANNELS } }, include: SALE_INCLUDE });
// Any order with its lines and invoice, online ones too (stamping a cancelled invoice).
export const findOrder = (id, db = prisma) => db.order.findUnique({ where: { id }, include: SALE_INCLUDE });
export const findByClientRef = (clientRef, db = prisma) => db.order.findUnique({ where: { clientRef }, include: SALE_INCLUDE });

// Sales placed from `from` (up to `to`, when given), newest first.
export const salesSince = (from, to = null, db = prisma) =>
  db.order.findMany({ where: { channel: { in: SALE_CHANNELS }, placedAt: { gte: from, ...(to ? { lt: to } : {}) } }, include: SALE_INCLUDE, orderBy: { placedAt: 'desc' } });

// Who sold each order: the person on its "offline_sale" stock entries (old and new app).
export async function sellers(orderNumbers, db = prisma) {
  if (!orderNumbers.length) return new Map();
  const rows = await db.stockLedger.findMany({ where: { reason: 'offline_sale', ref: { in: orderNumbers } }, select: { ref: true, actorId: true }, orderBy: { createdAt: 'asc' } });
  const out = new Map();
  for (const r of rows) if (!out.has(r.ref) && r.actorId) out.set(r.ref, r.actorId);
  return out;
}

// Invoice numbers: INV-000016, one past the highest. One at a time, so two phones
// never take the same number (the old app can still clash: the caller retries).
export const lockInvoiceNumbering = (db) => db.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext('nandam-invoice-number'))");
// Website payments tried with Razorpay's TEST keys on the live server get their own numbers
// (TEST-000001 …): the real GST invoice numbers are never used up by test money.
export async function nextTestInvoiceNumber(db = prisma) {
  const rows = await db.$queryRaw`
    SELECT coalesce(max(split_part("invoiceNumber", '-', 2)::int), 0)::int AS high
    FROM "Invoice" WHERE "invoiceNumber" ~ '^TEST-[0-9]{6}$'`;
  return `TEST-${String(rows[0].high + 1).padStart(6, '0')}`;
}
export async function nextInvoiceNumber(db = prisma) {
  const rows = await db.$queryRaw`
    SELECT coalesce(max(split_part("invoiceNumber", '-', 2)::int), 0)::int AS high
    FROM "Invoice" WHERE "invoiceNumber" ~ '^INV-[0-9]+$'`;
  return `INV-${String(rows[0].high + 1).padStart(6, '0')}`;
}
