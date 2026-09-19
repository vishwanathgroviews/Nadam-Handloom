import { prisma } from '../../config/prisma';
import { storageProvider } from '../../providers/storage';
import { AUDIT_LOG_RETENTION_DAYS } from '../admin/auditLog.groups';

// SOW hard constraint: order data retained 6 months.
const RETENTION_MONTHS = 6;

const getCutoffDate = (): Date => {
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - RETENTION_MONTHS);
  return cutoff;
};

export const previewPurge = async (): Promise<{ cutoffDate: Date; count: number }> => {
  const cutoffDate = getCutoffDate();
  const count = await prisma.order.count({ where: { placedAt: { lt: cutoffDate } } });
  return { cutoffDate, count };
};

/**
 * Deletes orders older than the retention window. Reservation has no
 * cascade delete on Order by design (so an accidental delete elsewhere
 * can't silently vanish an active hold) — cleared explicitly here first.
 * OrderItem/Payment/Shipment cascade automatically via their own FKs.
 */
export const purgeOldOrders = async (): Promise<{ cutoffDate: Date; purgedCount: number }> => {
  const cutoffDate = getCutoffDate();
  const oldOrders = await prisma.order.findMany({ where: { placedAt: { lt: cutoffDate } }, select: { id: true } });
  const orderIds = oldOrders.map((o) => o.id);
  if (!orderIds.length) return { cutoffDate, purgedCount: 0 };

  await prisma.reservation.deleteMany({ where: { orderId: { in: orderIds } } });
  const { count } = await prisma.order.deleteMany({ where: { id: { in: orderIds } } });

  return { cutoffDate, purgedCount: count };
};

const csvEscape = (value: unknown): string => {
  const str = value === null || value === undefined ? '' : String(value);
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
};

const CSV_HEADER = [
  'orderNumber', 'channel', 'status', 'placedAt', 'customerEmail', 'customerPhone',
  'subtotal', 'total', 'paymentStatus', 'carrier', 'awbNumber', 'shipmentStatus', 'items',
];

/** A full snapshot every time, not just "new since last export" — so a missed month never loses data before the next purge. */
export const generateOrdersCsv = async (): Promise<string> => {
  const orders = await prisma.order.findMany({
    orderBy: { placedAt: 'asc' },
    include: { items: true, payment: true, shipment: true, authAccount: { select: { email: true, phone: true } } },
  });

  const rows = orders.map((order) => [
    order.orderNumber,
    order.channel,
    order.status,
    order.placedAt.toISOString(),
    order.authAccount?.email ?? '',
    order.authAccount?.phone ?? '',
    order.subtotal.toString(),
    order.total.toString(),
    order.payment?.status ?? '',
    order.shipment?.carrier ?? '',
    order.shipment?.awbNumber ?? '',
    order.shipment?.status ?? '',
    order.items.map((i) => `${i.quantity}x ${i.nameSnapshot}`).join('; '),
  ]);

  return [CSV_HEADER, ...rows].map((row) => row.map(csvEscape).join(',')).join('\n');
};

export const exportOrdersCsvToStorage = async (): Promise<{ key: string | null; orderCount: number }> => {
  const csv = await generateOrdersCsv();
  const orderCount = Math.max(0, csv.split('\n').length - 1);

  if (!storageProvider.isConfigured()) {
    console.warn('Monthly CSV export: storage not configured, skipping archive.');
    return { key: null, orderCount };
  }

  try {
    const uploaded = await storageProvider.upload({
      buffer: Buffer.from(csv, 'utf-8'),
      contentType: 'text/csv',
      filename: `orders-${new Date().toISOString().slice(0, 10)}.csv`,
      folder: 'backups',
    });
    return { key: uploaded.key, orderCount };
  } catch (error) {
    console.error('Failed to archive monthly CSV export to storage:', error);
    return { key: null, orderCount };
  }
};

/**
 * Removes Audit Log entries older than 30 days.
 *
 * Only the staff-app activity the Audit Log shows is removed; the separate
 * customer sign-in records are not part of that log and are left alone.
 */
export const purgeOldAuditLogs = async (now: Date = new Date()): Promise<{ cutoffDate: Date; purgedCount: number }> => {
  const cutoffDate = new Date(now.getTime() - AUDIT_LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const { count } = await prisma.authEvent.deleteMany({
    where: { source: 'staff_app', createdAt: { lt: cutoffDate } },
  });
  return { cutoffDate, purgedCount: count };
};

let lastCsvExportMonthKey: string | null = null;

const runDailyRetentionTasks = async (): Promise<void> => {
  try {
    const { purgedCount, cutoffDate } = await purgeOldOrders();
    if (purgedCount) console.log(`Retention: purged ${purgedCount} order(s) older than ${cutoffDate.toISOString()}`);
  } catch (error) {
    console.error('Order purge failed:', error);
  }

  try {
    const { purgedCount, cutoffDate } = await purgeOldAuditLogs();
    if (purgedCount) console.log(`Retention: removed ${purgedCount} audit log entr${purgedCount === 1 ? 'y' : 'ies'} older than ${cutoffDate.toISOString()}`);
  } catch (error) {
    console.error('Audit log purge failed:', error);
  }

  const now = new Date();
  const monthKey = `${now.getFullYear()}-${now.getMonth()}`;
  if (now.getDate() === 1 && lastCsvExportMonthKey !== monthKey) {
    lastCsvExportMonthKey = monthKey;
    try {
      const { key, orderCount } = await exportOrdersCsvToStorage();
      console.log(`Monthly CSV export: ${orderCount} order(s)${key ? ` archived to ${key}` : ' (storage not configured)'}`);
    } catch (error) {
      console.error('Monthly CSV export failed:', error);
    }
  }
};

/**
 * Checks every few hours rather than once every 24h on a fixed timer — a
 * short-lived server (frequent redeploys) would otherwise never accumulate
 * a full 24h uptime and the purge/export would silently never run. Both
 * operations are idempotent, so an extra check costs nothing.
 */
export const startRetentionSweep = () => {
  const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

  runDailyRetentionTasks().catch((error) => console.error('Retention sweep failed:', error));
  const interval = setInterval(() => {
    runDailyRetentionTasks().catch((error) => console.error('Retention sweep failed:', error));
  }, CHECK_INTERVAL_MS);

  interval.unref();
  return interval;
};
