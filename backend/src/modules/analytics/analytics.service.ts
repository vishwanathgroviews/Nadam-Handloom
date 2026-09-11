import { prisma } from '../../config/prisma';
import { ChannelFilter, paidOrderWhereClauses } from '../../utils/orderChannels';

// Admin-only revenue/sales analytics. Deliberately built with findMany + a
// JS reduction rather than `prisma.groupBy` — the test double (fakePrisma)
// doesn't implement groupBy, and at this store's scale (a boutique catalog,
// not a high-volume marketplace) in-process aggregation is plenty fast.

const DEFAULT_RANGE_DAYS = 30;

export type { ChannelFilter };

interface DateRange {
  from?: Date;
  to?: Date;
  channel?: ChannelFilter;
}

const resolveRange = (range: DateRange): { start: Date; end: Date } => {
  const end = range.to ?? new Date();
  const start = range.from ?? new Date(end.getTime() - DEFAULT_RANGE_DAYS * 24 * 60 * 60 * 1000);
  return { start, end };
};

// Which orders count as sales per channel lives in one shared place —
// utils/orderChannels.ts — so online, in-store and WhatsApp stay in sync
// across analytics, the invoice list and the sales-summary PDF. `channel`
// narrows to one side of the business when set (e.g. isolating the online
// storefront's trend from in-store walk-in sales).
const paidOrdersInRange = (start: Date, end: Date, channel: ChannelFilter = 'all') =>
  prisma.order.findMany({
    where: { placedAt: { gte: start, lte: end }, OR: paidOrderWhereClauses(channel) },
  });

// Percent change vs. the prior period — null when the prior period had
// nothing to compare against (avoids a meaningless "+Infinity%"); the
// frontend renders that as a "New" badge instead of a percentage.
const pctChange = (current: number, previous: number): number | null => {
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / previous) * 100;
};

export const getSummary = async (query: DateRange) => {
  const { start, end } = resolveRange(query);
  const channel = query.channel ?? 'all';
  const orders = await paidOrdersInRange(start, end, channel);

  const online = orders.filter((o) => o.channel === 'online');
  const store = orders.filter((o) => o.channel === 'store');
  const whatsapp = orders.filter((o) => o.channel === 'whatsapp');
  const sum = (rows: typeof orders) => rows.reduce((acc, o) => acc + Number(o.total), 0);

  const totalRevenue = sum(orders);
  const orderCount = orders.length;

  // Previous period of equal length, immediately before this one — the
  // standard "+12% vs last period" comparison every analytics view needs.
  const durationMs = end.getTime() - start.getTime();
  const previousStart = new Date(start.getTime() - durationMs);
  const previousEnd = new Date(start.getTime());
  const previousOrders = await paidOrdersInRange(previousStart, previousEnd, channel);
  const previousRevenue = sum(previousOrders);
  const previousOrderCount = previousOrders.length;

  return {
    from: start,
    to: end,
    orderCount,
    totalRevenue,
    averageOrderValue: orderCount ? totalRevenue / orderCount : 0,
    online: { count: online.length, total: sum(online) },
    store: { count: store.length, total: sum(store) },
    whatsapp: { count: whatsapp.length, total: sum(whatsapp) },
    previousPeriod: {
      from: previousStart,
      to: previousEnd,
      totalRevenue: previousRevenue,
      orderCount: previousOrderCount,
      revenueChangePct: pctChange(totalRevenue, previousRevenue),
      orderCountChangePct: pctChange(orderCount, previousOrderCount),
    },
  };
};

export const getTopSubcategories = async (query: DateRange & { limit: number }) => {
  const { start, end } = resolveRange(query);
  const orders = await paidOrdersInRange(start, end, query.channel);
  const orderIds = orders.map((o) => o.id);
  if (!orderIds.length) return [];

  const items = await prisma.orderItem.findMany({
    where: { orderId: { in: orderIds } },
    include: { product: { include: { subcategory: { select: { id: true, name: true } } } } },
  });

  const bySubcategory = new Map<string, { subcategoryId: string; subcategoryName: string; revenue: number; unitsSold: number }>();
  for (const item of items) {
    const subcategory = (item as any).product?.subcategory;
    if (!subcategory) continue;
    const entry = bySubcategory.get(subcategory.id) ?? {
      subcategoryId: subcategory.id,
      subcategoryName: subcategory.name,
      revenue: 0,
      unitsSold: 0,
    };
    entry.revenue += Number(item.priceSnapshot) * item.quantity;
    entry.unitsSold += item.quantity;
    bySubcategory.set(subcategory.id, entry);
  }

  return Array.from(bySubcategory.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, query.limit);
};
