// Invoice queries (Module 6). Every period is by the invoice date (generatedAt) in
// India time, for the list and the summary alike, so their totals always agree.
import { prisma } from '../config/database.js';
import { tagCandidates } from '../utils/tags.js';

// A cancelled sale's invoice: kept and listed, never counted.
export const NOT_CANCELLED = { cancelledAt: null, order: { status: { not: 'cancelled' } } };
export const isCancelledInvoice = (inv) => !!inv.cancelledAt || inv.order?.status === 'cancelled';

const ROW_INCLUDE = { order: { select: { id: true, orderNumber: true, status: true, paymentMethod: true, channel: true } } };
export const DETAIL_INCLUDE = {
  order: {
    include: {
      items: { orderBy: [{ lineNo: { sort: 'asc', nulls: 'last' } }, { id: 'asc' }], include: { piece: { select: { id: true, barcode: true } } } },
      shipment: { select: { status: true, awbNumber: true } },
    },
  },
};

// What the search box means: an invoice number (17, INV-000017), an order number, a
// mobile (5+ digits), a name, or a saree's tag.
export function searchWhere(raw) {
  const q = String(raw || '').trim();
  if (!q) return null;
  const tidy = q.toUpperCase().replace(/\s+/g, '');
  const digits = tidy.replace(/\D/g, '');
  const or = [];
  const inv = /^(INV-?)?(\d{1,6})$/.exec(tidy);
  if (inv) or.push({ invoiceNumber: `INV-${inv[2].padStart(6, '0')}` });
  if (/^\d{5,}$/.test(tidy) || /^NH\d{5,}$/.test(tidy)) {
    or.push({ order: { orderNumber: { contains: tidy } } });
    if (/^\d+$/.test(tidy)) or.push({ customerMobile: { contains: digits.slice(-10) } });
  }
  if (/[A-Za-z]/.test(q) && q.length >= 2) or.push({ customerName: { contains: q.replace(/\s+/g, ' '), mode: 'insensitive' } });
  if (tidy.length >= 3) or.push({ order: { items: { some: { piece: { barcode: { in: tagCandidates(tidy) } } } } } });
  return or.length ? { OR: or } : { id: '00000000-0000-0000-0000-000000000000' };
}

export function listWhere({ q, range, channel, cancelled }) {
  const and = [];
  const s = searchWhere(q);
  if (s) and.push(s); // a search looks at every date
  else if (range) and.push({ generatedAt: { gte: range.from, lte: range.to } });
  if (channel && channel !== 'all') and.push({ channel });
  if (cancelled) and.push({ OR: [{ cancelledAt: { not: null } }, { order: { status: 'cancelled' } }] });
  return and.length ? { AND: and } : {};
}

export const listPage = (where, { skip, take }, db = prisma) =>
  db.invoice.findMany({ where, include: ROW_INCLUDE, orderBy: [{ generatedAt: 'desc' }, { invoiceNumber: 'desc' }], skip, take });

export async function totals(where, db = prisma) {
  const [live, all] = await Promise.all([
    db.invoice.aggregate({ where: { AND: [where, NOT_CANCELLED] }, _count: { _all: true }, _sum: { totalAmount: true } }),
    db.invoice.count({ where }),
  ]);
  return { count: live._count._all, amount: Number(live._sum.totalAmount ?? 0), cancelled: all - live._count._all };
}

export const findOne = (id, db = prisma) => db.invoice.findUnique({ where: { id }, include: DETAIL_INCLUDE });

// The summary: every invoice in the period with its sale's lines and payment mode.
export const forSummary = ({ range, channels }, db = prisma) =>
  db.invoice.findMany({
    where: { generatedAt: { gte: range.from, lte: range.to }, channel: { in: channels } },
    include: { order: { select: { orderNumber: true, status: true, paymentMethod: true, items: { select: { nameSnapshot: true, priceSnapshot: true, quantity: true } } } } },
    orderBy: [{ generatedAt: 'asc' }, { invoiceNumber: 'asc' }],
  });

// Counter and WhatsApp sales recorded without an invoice (online orders always get one).
export const salesWithout = ({ range, channels }, db = prisma) =>
  db.order.findMany({
    where: { channel: { in: channels.filter((c) => c !== 'online') }, placedAt: { gte: range.from, lte: range.to }, invoiceRequired: false, status: { not: 'cancelled' }, invoice: null },
    include: { items: { select: { nameSnapshot: true, priceSnapshot: true, quantity: true, imageSnapshot: true } } },
    orderBy: { placedAt: 'desc' },
  });
