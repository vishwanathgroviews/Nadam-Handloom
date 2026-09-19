import { apiRequest } from './client';

export interface AdminOrderItem {
  id: string;
  // The catalog product this line was sold from, so the order and shipment
  // screens can open its full details. Kept alongside the snapshots below
  // rather than replacing them: the snapshots are what was actually bought.
  productId: string;
  nameSnapshot: string;
  quantity: number;
  priceSnapshot: string;
  // Captured at sale time (see the order-creation paths in the backend), so
  // the thumbnail keeps showing what was actually bought even if the
  // product's photo is replaced later.
  imageSnapshot: string | null;
  // Link to this product's page on the customer site, built server-side from
  // FRONTEND_URL so it is right in every environment. Null only if the
  // product row went missing.
  productUrl: string | null;
}

export interface AdminOrderInvoice {
  id: string;
  invoiceNumber: string;
  url: string;
  totalAmount: string;
}

// Snapshot written onto the order itself. Online orders also have a linked
// Address row; store and WhatsApp orders only ever have this.
export interface AdminShippingAddress {
  fullName?: string;
  phone?: string;
  line1?: string;
  line2?: string | null;
  city?: string;
  state?: string;
  pincode?: string;
  notes?: string;
}

export interface AdminShipment {
  awbNumber: string | null;
  carrier: string;
  status: string;
  shippedAt: string | null;
}

export interface AdminOrderSummary {
  id: string;
  orderNumber: string;
  status: string;
  channel: string;
  total: string;
  placedAt: string;
  authAccount?: { email: string | null; phone: string | null };
  items: AdminOrderItem[];
  shipment: AdminShipment | null;
  payment: { status: string } | null;
  invoice?: AdminOrderInvoice | null;
  shippingAddress?: AdminShippingAddress | null;
}

export interface AdminOrdersFilter {
  status?: string[];
  channel?: 'online' | 'store' | 'whatsapp';
  paymentStatus?: 'created' | 'paid' | 'failed';
  from?: string;
  to?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface AdminOrderDetail extends AdminOrderSummary {
  address?: {
    fullName: string;
    phone: string;
    line1: string;
    line2?: string | null;
    city: string;
    state: string;
    pincode: string;
  } | null;
}

export interface MarkShippedResult {
  orderId: string;
  orderNumber: string;
  channel: string;
  carrier: string;
  awbNumber: string;
  status: string;
  trackingUrl: string;
  // Everything needed to send the shipment message + invoice in one step,
  // without re-fetching the order.
  customerPhone: string | null;
  invoiceUrl: string | null;
  invoiceNumber: string | null;
  productLinks: { name: string; url: string }[];
}

export const listAdminOrders = (token: string, filter: AdminOrdersFilter = {}) => {
  const qs = new URLSearchParams();
  if (filter.status?.length) qs.set('status', filter.status.join(','));
  if (filter.channel) qs.set('channel', filter.channel);
  if (filter.paymentStatus) qs.set('paymentStatus', filter.paymentStatus);
  if (filter.from) qs.set('from', filter.from);
  if (filter.to) qs.set('to', filter.to);
  if (filter.search) qs.set('search', filter.search);
  if (filter.page) qs.set('page', String(filter.page));
  if (filter.pageSize) qs.set('pageSize', String(filter.pageSize));
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return apiRequest<{ data: { items: AdminOrderSummary[]; total: number; page: number; pageSize: number } }>(
    `/admin/orders${suffix}`,
    { token }
  );
};

export const getAdminOrder = (token: string, orderId: string) =>
  apiRequest<{ data: AdminOrderDetail }>(`/admin/orders/${orderId}`, { token });

export const markOrderShipped = (token: string, orderId: string, awbNumber: string, carrier?: string) =>
  apiRequest<{ data: MarkShippedResult }>(`/admin/orders/${orderId}/shipment`, {
    method: 'PATCH',
    token,
    body: { awbNumber, ...(carrier ? { carrier } : {}) },
  });

export interface SoldProductLine {
  productId: string;
  productName: string;
  revenue: number;
  unitsSold: number;
}

export interface DashboardStats {
  // Omitted entirely for STAFF — today's revenue is an ADMIN-only figure
  // (see admin.service.ts:getDashboardStats), not just hidden client-side.
  today?: {
    online: { count: number; total: number; products: SoldProductLine[] };
    store: { count: number; total: number; products: SoldProductLine[] };
    whatsapp: { count: number; total: number; products: SoldProductLine[] };
  };
  lowStockCount: number;
  products: { activeCount: number; cap: number; remaining: number };
}

export const getDashboard = (token: string) => apiRequest<{ data: DashboardStats }>('/admin/dashboard', { token });

export interface AdminUser {
  id: string;
  email: string | null;
  phone: string | null;
  status: string;
  name: string | null;
  roles: string[];
  createdAt: string;
}

export const listUsers = (token: string) => apiRequest<{ data: AdminUser[] }>('/admin/users', { token });

/**
 * Takes a teammate's access to the app away. The account and its history
 * stay — they can be invited back with provisionUser — but their roles,
 * sessions and MPIN are cleared, so they cannot sign in and any app they
 * currently have open stops working on its next request.
 */
export const revokeUserAccess = (token: string, userId: string) =>
  apiRequest<{ data: { id: string; name: string | null; revokedRoles: string[] } }>(
    `/admin/users/${userId}/access`,
    { method: 'DELETE', token }
  );

export const provisionUser = (
  token: string,
  data: { name: string; mobile: string; email: string; role: 'ADMIN' | 'STAFF' }
) => apiRequest<{ data: { id: string; mobile: string; email: string; role: string } }>('/admin/users', {
  method: 'POST',
  token,
  body: data,
});

export interface AuditPerson {
  id: string;
  name: string;
  /** 'Owner' | 'Staff' | 'Customer' */
  role: string | null;
}

export interface AuditLogEntry {
  id: string;
  eventType: string;
  ipAddress: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  /** Who performed the action; null when an older entry never recorded it. */
  actor?: AuditPerson | null;
  /** The person the action was done to (an invited teammate, a customer whose order shipped). */
  subject?: AuditPerson | null;
  /** Names looked up from the ids in `metadata`. */
  context?: {
    productName?: string;
    productSku?: string;
    subcategoryName?: string;
    categoryName?: string;
    orderNumber?: string;
  };
  authAccount?: {
    email: string | null;
    phone: string | null;
    adminProfile?: { firstName: string; lastName: string } | null;
    userProfile?: { firstName: string; lastName: string } | null;
  } | null;
}

export type AuditGroup = 'sales' | 'orders' | 'products' | 'catalog' | 'team' | 'signin';

export const getAuditLog = (
  token: string,
  params: { eventType?: string; group?: AuditGroup; from?: string; page?: number; pageSize?: number } = {}
) => {
  const qs = new URLSearchParams();
  if (params.eventType) qs.set('eventType', params.eventType);
  if (params.group) qs.set('group', params.group);
  if (params.from) qs.set('from', params.from);
  if (params.page) qs.set('page', String(params.page));
  if (params.pageSize) qs.set('pageSize', String(params.pageSize));
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return apiRequest<{ data: { items: AuditLogEntry[]; total: number } }>(`/admin/audit-log${suffix}`, { token });
};
