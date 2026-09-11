import { Request } from 'express';
import { prisma } from '../../config/prisma';
import { splitFullName } from '../../utils/name';
import { BadRequestError, ConflictError, NotFoundError } from '../../utils/errors';
import { DTDC_TRACKING_URL, PAID_STATUSES } from '../../utils/constants';
import { env } from '../../config/env';
import { logAuthEvent } from '../auth/auditLog.service';
import { getLowStock } from '../inventory/inventory.service';
import { getProductStats } from '../catalog/catalog.admin.service';

export const provisionUser = async (
  data: { name: string; mobile: string; email: string; role: 'ADMIN' | 'STAFF' },
  req: Request
) => {
  const existing = await prisma.authAccount.findFirst({
    where: { OR: [{ phone: data.mobile }, { email: data.email }] },
  });
  if (existing) {
    throw new ConflictError('An account with this mobile number or email already exists');
  }

  const { firstName, lastName } = splitFullName(data.name);

  const account = await prisma.$transaction(async (tx) => {
    const created = await tx.authAccount.create({
      data: {
        phone: data.mobile,
        email: data.email,
        status: 'pending',
        adminProfile: { create: { firstName, lastName } },
      },
    });
    const role = await tx.role.findUniqueOrThrow({ where: { name: data.role } });
    await tx.userRole.create({ data: { authAccountId: created.id, roleId: role.id } });
    return created;
  });

  await logAuthEvent({
    authAccountId: account.id,
    eventType: 'admin_provisioned_user',
    source: 'staff_app',
    req,
    metadata: { role: data.role },
  });

  return { id: account.id, mobile: data.mobile, email: data.email, role: data.role };
};

// AuthAccount is shared by customers (role CUSTOMER, userProfile set) and
// staff/admins (role ADMIN/STAFF, adminProfile set) alike — this must filter
// to just the latter, or every customer who ever registered on the
// storefront would show up in the Team screen mislabeled as staff.
export const listUsers = async () => {
  const accounts = await prisma.authAccount.findMany({
    where: { deletedAt: null, roles: { some: { role: { name: { in: ['ADMIN', 'STAFF'] } } } } },
    include: { adminProfile: true, userProfile: true, roles: { include: { role: true } } },
    orderBy: { createdAt: 'desc' },
  });

  return accounts.map((account) => ({
    id: account.id,
    email: account.email,
    phone: account.phone,
    status: account.status,
    name: account.adminProfile
      ? `${account.adminProfile.firstName} ${account.adminProfile.lastName}`
      : account.userProfile
        ? `${account.userProfile.firstName} ${account.userProfile.lastName}`
        : null,
    roles: account.roles.map((userRole) => userRole.role.name),
    createdAt: account.createdAt,
  }));
};

// ─────────────────────────────────────────────────────────────────
// Order & shipment management (ADMIN/STAFF) — DTDC AWB entry.
// We never call the DTDC API here: staff paste the AWB DTDC gave them
// for the pickup, and customers self-track on DTDC's own website.
// ─────────────────────────────────────────────────────────────────

const ORDER_ADMIN_INCLUDE = {
  // The product slug comes along so every order item can be handed back with
  // a link to its page on the customer site — the staff app puts that link
  // in the WhatsApp shipment message.
  items: { include: { product: { select: { slug: true } } } },
  shipment: true,
  payment: true,
  address: true,
  // So the staff app can hand the customer their invoice PDF straight from
  // the order screen (WhatsApp orders especially, where the shipment message
  // and the invoice go out together).
  invoice: true,
  authAccount: { select: { email: true, phone: true } },
} as const;

/** `https://site/product/<slug>` — one place builds it, so every admin order
 *  response (list, detail, mark-shipped) carries the same link, correct for
 *  whatever FRONTEND_URL this environment runs against. */
export const productPageUrl = (slug: string | null | undefined): string | null =>
  slug ? `${env.FRONTEND_URL.replace(/\/$/, '')}/product/${slug}` : null;

type OrderItemWithProduct = { product?: { slug: string } | null };

const withProductUrls = <T extends { items: OrderItemWithProduct[] }>(order: T) => ({
  ...order,
  items: order.items.map((item) => ({ ...item, productUrl: productPageUrl(item.product?.slug) })),
});

export const listOrdersForAdmin = async (query: {
  status?: string[];
  channel?: string;
  paymentStatus?: string;
  from?: Date;
  to?: Date;
  search?: string;
  page: number;
  pageSize: number;
}) => {
  const where: any = {};
  if (query.status?.length) where.status = { in: query.status };
  if (query.channel) where.channel = query.channel;
  if (query.paymentStatus) where.payment = { is: { status: query.paymentStatus } };
  if (query.from || query.to) {
    where.placedAt = {};
    if (query.from) where.placedAt.gte = query.from;
    if (query.to) where.placedAt.lte = query.to;
  }
  if (query.search) {
    const term = query.search.trim();
    where.OR = [
      { orderNumber: { contains: term, mode: 'insensitive' } },
      {
        authAccount: {
          is: {
            OR: [
              { email: { contains: term, mode: 'insensitive' } },
              { phone: { contains: term, mode: 'insensitive' } },
            ],
          },
        },
      },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { placedAt: 'desc' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      include: ORDER_ADMIN_INCLUDE,
    }),
    prisma.order.count({ where }),
  ]);

  return { items: items.map(withProductUrls), total, page: query.page, pageSize: query.pageSize };
};

export const getOrderForAdmin = async (orderId: string) => {
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: ORDER_ADMIN_INCLUDE });
  if (!order) throw new NotFoundError('Order not found');
  return withProductUrls(order);
};

export const markOrderShipped = async (
  orderId: string,
  data: { awbNumber: string; carrier?: string },
  req: Request
) => {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { shipment: true, invoice: true, items: { include: { product: { select: { slug: true } } } } },
  });
  if (!order) throw new NotFoundError('Order not found');
  if (!order.shipment) {
    throw new BadRequestError('This order has no shipment record yet — payment must be confirmed first');
  }

  const [shipment] = await prisma.$transaction([
    prisma.shipment.update({
      where: { orderId },
      data: {
        awbNumber: data.awbNumber,
        carrier: data.carrier?.trim() || order.shipment.carrier,
        status: 'shipped',
        shippedAt: order.shipment.shippedAt ?? new Date(),
      },
    }),
    prisma.order.update({ where: { id: orderId }, data: { status: 'shipped' } }),
  ]);

  await logAuthEvent({
    authAccountId: order.authAccountId,
    eventType: 'order_marked_shipped',
    source: 'staff_app',
    req,
    metadata: { orderId, awbNumber: data.awbNumber },
  });

  return {
    orderId,
    orderNumber: order.orderNumber,
    channel: order.channel,
    carrier: shipment!.carrier,
    awbNumber: shipment!.awbNumber,
    status: shipment!.status,
    trackingUrl: DTDC_TRACKING_URL,
    // Handed back so the staff app can send the shipment message and the
    // invoice PDF together in one go, without a second round trip.
    customerPhone:
      (order.shippingAddress as { phone?: string } | null)?.phone ?? null,
    invoiceUrl: order.invoice?.url ?? null,
    invoiceNumber: order.invoice?.invoiceNumber ?? null,
    // The shipment message links the customer back to what they bought, so
    // the links ride along with the AWB rather than needing a second fetch.
    productLinks: order.items
      .map((item) => ({ name: item.nameSnapshot, url: productPageUrl(item.product?.slug) }))
      .filter((link): link is { name: string; url: string } => link.url !== null),
  };
};

// ─────────────────────────────────────────────────────────────────
// Audit log — owner-only, per the doc's "price changes especially" bar.
// ─────────────────────────────────────────────────────────────────

export const getAuditLog = async (query: {
  eventType?: string;
  source?: 'customer_web' | 'staff_app';
  page: number;
  pageSize: number;
}) => {
  const where: any = {};
  if (query.eventType) where.eventType = query.eventType;
  // Admin's Audit Log only shows staff-app activity by default — customer-web
  // registrations/logins/etc. would otherwise drown out real staff actions.
  // Pass ?source=customer_web explicitly to opt back into seeing those.
  where.source = query.source ? query.source : { in: ['staff_app'] };

  const [items, total] = await Promise.all([
    prisma.authEvent.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      include: {
        authAccount: {
          select: { email: true, phone: true, adminProfile: true, userProfile: true },
        },
      },
    }),
    prisma.authEvent.count({ where }),
  ]);

  return { items, total, page: query.page, pageSize: query.pageSize };
};

// ─────────────────────────────────────────────────────────────────
// Sessions — "lost phone = lost store control otherwise" (doc, §A).
// ─────────────────────────────────────────────────────────────────

// Admin/staff sessions only — this screen is about "lost phone = lost store
// control", not general session administration, so a customer's logged-in
// laptop has no business showing up here (and no admin action makes sense
// against it from this screen anyway).
export const listActiveSessions = async () => {
  return prisma.session.findMany({
    where: {
      revokedAt: null,
      expiresAt: { gt: new Date() },
      authAccount: { is: { roles: { some: { role: { is: { name: { in: ['ADMIN', 'STAFF'] } } } } } } },
    },
    orderBy: { createdAt: 'desc' },
    include: {
      authAccount: {
        select: {
          email: true,
          phone: true,
          adminProfile: true,
          roles: { include: { role: true } },
        },
      },
    },
  });
};

export const revokeSession = async (sessionId: string, req: Request) => {
  const session = await prisma.session.findUnique({ where: { id: sessionId } });
  if (!session) throw new NotFoundError('Session not found');
  if (session.revokedAt) throw new BadRequestError('Session is already revoked');

  await prisma.session.update({ where: { id: sessionId }, data: { revokedAt: new Date() } });

  await logAuthEvent({
    authAccountId: session.authAccountId,
    eventType: 'session_revoked_by_admin',
    source: 'staff_app',
    req,
    metadata: { sessionId },
  });
};

// ─────────────────────────────────────────────────────────────────
// Dashboard — today's sales by channel, low stock, active-listing cap.
// ─────────────────────────────────────────────────────────────────

interface SoldProductLine {
  productId: string;
  productName: string;
  revenue: number;
  unitsSold: number;
}

// Same "findMany + JS reduction" shape as analytics.service.ts's
// getTopProducts — small scale here (a day's orders), so no groupBy needed.
const productsSoldFor = async (orders: { id: string }[]): Promise<SoldProductLine[]> => {
  if (!orders.length) return [];
  const items = await prisma.orderItem.findMany({ where: { orderId: { in: orders.map((o) => o.id) } } });
  const byProduct = new Map<string, SoldProductLine>();
  for (const item of items) {
    const entry = byProduct.get(item.productId) ?? {
      productId: item.productId,
      productName: item.nameSnapshot,
      revenue: 0,
      unitsSold: 0,
    };
    entry.revenue += Number(item.priceSnapshot) * item.quantity;
    entry.unitsSold += item.quantity;
    byProduct.set(item.productId, entry);
  }
  return Array.from(byProduct.values()).sort((a, b) => b.revenue - a.revenue);
};

// Today's revenue/units-sold is an owner-level figure — deliberately withheld
// from STAFF here (not just hidden client-side) even though this endpoint is
// otherwise shared ADMIN+STAFF, matching the analytics module's stricter
// ADMIN-only gate on the same kind of data. STAFF still gets lowStockCount
// and the product cap/remaining, which they need operationally.
export const getDashboardStats = async (roles: string[]) => {
  const [lowStock, productStats] = await Promise.all([getLowStock(), getProductStats()]);

  if (!roles.includes('ADMIN')) {
    return { lowStockCount: lowStock.items.length, products: productStats };
  }

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [onlineOrders, storeOrders, whatsappOrders] = await Promise.all([
    prisma.order.findMany({
      where: { channel: 'online', placedAt: { gte: startOfToday }, status: { in: PAID_STATUSES } },
      select: { id: true, total: true },
    }),
    prisma.order.findMany({
      where: { channel: 'store', placedAt: { gte: startOfToday } },
      select: { id: true, total: true },
    }),
    prisma.order.findMany({
      where: { channel: 'whatsapp', placedAt: { gte: startOfToday }, status: { in: PAID_STATUSES } },
      select: { id: true, total: true },
    }),
  ]);

  const [onlineProducts, storeProducts, whatsappProducts] = await Promise.all([
    productsSoldFor(onlineOrders),
    productsSoldFor(storeOrders),
    productsSoldFor(whatsappOrders),
  ]);

  const sumTotals = (rows: { total: unknown }[]) => rows.reduce((sum, o) => sum + Number(o.total), 0);

  return {
    today: {
      online: { count: onlineOrders.length, total: sumTotals(onlineOrders), products: onlineProducts },
      store: { count: storeOrders.length, total: sumTotals(storeOrders), products: storeProducts },
      whatsapp: { count: whatsappOrders.length, total: sumTotals(whatsappOrders), products: whatsappProducts },
    },
    lowStockCount: lowStock.items.length,
    products: productStats,
  };
};
