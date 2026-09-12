import { prisma } from '../../config/prisma';
import { COMPANY } from '../../config/company';
import { AppError, BadRequestError, NotFoundError } from '../../utils/errors';
import { storageProvider } from '../../providers/storage';
import { splitGst } from '../../utils/gst';
import { nextInvoiceNumber } from '../../utils/invoiceNumber';
import { renderInvoicePdf, InvoiceLine } from './invoices.pdf';
import { ChannelFilter, paidOrderWhereClauses } from '../../utils/orderChannels';

export type { ChannelFilter };

const formatDate = (d: Date) => d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

const resolveRange = (from?: Date, to?: Date): { start: Date; end: Date } => {
  const end = to ?? new Date();
  const start = from ?? new Date(end.getFullYear(), end.getMonth(), 1);
  return { start, end };
};

// Online, in-store and WhatsApp alike — the monthly/custom-range summary is
// the business's single complete sales document, so it must never silently
// omit a channel. See utils/orderChannels.ts for the per-channel rules.
const paidOrdersInRange = (start: Date, end: Date, channel: ChannelFilter = 'all') =>
  prisma.order.findMany({
    where: { placedAt: { gte: start, lte: end }, OR: paidOrderWhereClauses(channel) },
    include: { items: true },
    orderBy: { placedAt: 'asc' },
  });

/**
 * The one place an invoice actually gets created. Idempotent — if this
 * order already has an invoice, returns it unchanged rather than
 * generating a duplicate — safe to call from a retrying event handler
 * (online orders) or right after a counter sale commits (store orders).
 */
export const generateInvoiceForOrder = async (orderId: string, actorId: string) => {
  const existing = await prisma.invoice.findUnique({ where: { orderId } });
  if (existing) return existing;

  if (!storageProvider.isConfigured()) {
    throw new AppError('Invoice storage is not configured yet. Please contact support.', 503, 'STORAGE_NOT_CONFIGURED');
  }

  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { items: true, address: true } });
  if (!order) throw new NotFoundError('Order not found');

  const address = order.shippingAddress as { fullName?: string; phone?: string } | null;
  const customerName = order.address?.fullName ?? address?.fullName ?? null;
  const customerMobile = order.address?.phone ?? address?.phone ?? null;

  const lines: InvoiceLine[] = order.items.map((item) => ({
    name: item.nameSnapshot,
    quantity: item.quantity,
    unitPrice: Number(item.priceSnapshot),
    subtotal: Number(item.priceSnapshot) * item.quantity,
  }));

  const total = lines.reduce((sum, l) => sum + l.subtotal, 0);
  const rate = COMPANY.gstRatePercent;
  const gst = lines.reduce(
    (acc, l) => {
      const split = splitGst(l.subtotal, rate);
      return {
        taxableValue: acc.taxableValue + split.taxableValue,
        gstAmount: acc.gstAmount + split.gstAmount,
        cgst: acc.cgst + split.cgst,
        sgst: acc.sgst + split.sgst,
      };
    },
    { taxableValue: 0, gstAmount: 0, cgst: 0, sgst: 0 }
  );

  const invoiceNumber = await prisma.$transaction((tx) => nextInvoiceNumber(tx));

  const pdf = await renderInvoicePdf({
    documentTitle: 'Invoice',
    documentNumber: invoiceNumber,
    dateLabel: formatDate(order.placedAt),
    customerName,
    customerMobile,
    lines,
    gst,
    total,
  });

  const uploaded = await storageProvider.upload({
    buffer: pdf,
    contentType: 'application/pdf',
    filename: `invoice-${invoiceNumber}.pdf`,
    folder: 'invoices',
  });

  return prisma.invoice.create({
    data: {
      invoiceNumber,
      orderId: order.id,
      channel: order.channel,
      customerName,
      customerMobile,
      gstRatePercent: rate,
      taxableValue: gst.taxableValue,
      cgstAmount: gst.cgst,
      sgstAmount: gst.sgst,
      totalAmount: total,
      storageKey: uploaded.key,
      url: uploaded.url,
      generatedBy: actorId,
    },
  });
};

export const listInvoices = async (query: {
  from?: Date;
  to?: Date;
  channel?: ChannelFilter;
  page: number;
  pageSize: number;
}) => {
  const where: any = {};
  if (query.from || query.to) {
    where.generatedAt = {};
    if (query.from) where.generatedAt.gte = query.from;
    if (query.to) where.generatedAt.lte = query.to;
  }
  if (query.channel && query.channel !== 'all') where.channel = query.channel;

  const [items, total] = await Promise.all([
    prisma.invoice.findMany({
      where,
      orderBy: { generatedAt: 'desc' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    prisma.invoice.count({ where }),
  ]);

  return { items, total, page: query.page, pageSize: query.pageSize };
};

export const getInvoice = async (id: string) => {
  const invoice = await prisma.invoice.findUnique({ where: { id } });
  if (!invoice) throw new NotFoundError('Invoice not found');
  return invoice;
};

export const getInvoiceByOrderId = async (orderId: string, authAccountId: string) => {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order || order.authAccountId !== authAccountId) throw new NotFoundError('Order not found');
  const invoice = await prisma.invoice.findUnique({ where: { orderId } });
  if (!invoice) throw new NotFoundError('No invoice has been generated for this order yet');
  return invoice;
};

/**
 * Monthly/custom-range sales register — never persisted (freshly rendered
 * every call, same "never keep a stale copy" principle the subcategory
 * catalog PDF already follows). A sales summary grouped by product, not a
 * re-print of every individual invoice: in-store bargaining means the same
 * product can sell at different prices across orders, so the unit price
 * shown here is the period's blended average (total revenue / total qty).
 */
export const generateSalesReportPdf = async (query: { from?: Date; to?: Date; channel?: ChannelFilter }): Promise<Buffer> => {
  const { start, end } = resolveRange(query.from, query.to);
  const orders = await paidOrdersInRange(start, end, query.channel ?? 'all');

  const byProduct = new Map<string, { name: string; quantity: number; revenue: number }>();
  for (const order of orders) {
    for (const item of order.items) {
      const entry = byProduct.get(item.nameSnapshot) ?? { name: item.nameSnapshot, quantity: 0, revenue: 0 };
      entry.quantity += item.quantity;
      entry.revenue += Number(item.priceSnapshot) * item.quantity;
      byProduct.set(item.nameSnapshot, entry);
    }
  }

  if (byProduct.size === 0) {
    throw new BadRequestError('No sales were recorded in this date range');
  }

  const lines: InvoiceLine[] = Array.from(byProduct.values())
    .sort((a, b) => b.revenue - a.revenue)
    .map((p) => ({
      name: p.name,
      quantity: p.quantity,
      unitPrice: Math.round((p.revenue / p.quantity) * 100) / 100,
      subtotal: p.revenue,
    }));

  const total = lines.reduce((sum, l) => sum + l.subtotal, 0);
  const rate = COMPANY.gstRatePercent;
  const gst = lines.reduce(
    (acc, l) => {
      const split = splitGst(l.subtotal, rate);
      return {
        taxableValue: acc.taxableValue + split.taxableValue,
        gstAmount: acc.gstAmount + split.gstAmount,
        cgst: acc.cgst + split.cgst,
        sgst: acc.sgst + split.sgst,
      };
    },
    { taxableValue: 0, gstAmount: 0, cgst: 0, sgst: 0 }
  );

  // The report still *covers* every channel (see paidOrdersInRange above),
  // it just doesn't print the mode of sale — the customer-facing document
  // states what was sold and the tax on it, nothing about how it was sold.
  return renderInvoicePdf({
    documentTitle: 'Sales Summary',
    documentNumber: `${formatDate(start)} - ${formatDate(end)}`,
    dateLabel: formatDate(new Date()),
    lines,
    gst,
    total,
  });
};
