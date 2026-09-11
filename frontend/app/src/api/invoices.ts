import { apiRequest, API_BASE_URL } from './client';

export type InvoiceChannelFilter = 'all' | 'online' | 'store' | 'whatsapp';

export interface Invoice {
  id: string;
  invoiceNumber: string;
  orderId: string;
  channel: string;
  customerName: string | null;
  customerMobile: string | null;
  gstRatePercent: string;
  taxableValue: string;
  cgstAmount: string;
  sgstAmount: string;
  totalAmount: string;
  storageKey: string;
  url: string;
  generatedAt: string;
  generatedBy: string;
}

export interface ListInvoicesParams {
  from?: string;
  to?: string;
  channel?: InvoiceChannelFilter;
  page?: number;
  pageSize?: number;
}

const toQueryString = (params: Record<string, string | number | undefined>) => {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) qs.set(key, String(value));
  }
  const suffix = qs.toString();
  return suffix ? `?${suffix}` : '';
};

export const listInvoices = (token: string, params: ListInvoicesParams = {}) =>
  apiRequest<{ data: { items: Invoice[]; total: number; page: number; pageSize: number } }>(
    `/admin/invoices${toQueryString(params as Record<string, string | number | undefined>)}`,
    { token }
  );

export const getInvoice = (token: string, id: string) => apiRequest<{ data: Invoice }>(`/admin/invoices/${id}`, { token });

export interface SalesReportParams {
  from?: string;
  to?: string;
  channel?: InvoiceChannelFilter;
}

// The consolidated invoice for a whole period — every sale in range across
// online, in-store and WhatsApp, grouped by product. Unlike an individual
// invoice (stored once, then fetched from its public URL), this is rendered
// fresh on every call, so it comes back as raw PDF bytes rather than a link.
export const generateSalesReportPdf = async (
  token: string,
  params: SalesReportParams
): Promise<{ bytes: Uint8Array }> => {
  const response = await fetch(`${API_BASE_URL}/admin/invoices/report`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const error = new Error(data.message || 'Failed to generate the complete invoice') as Error & { code?: string };
    error.code = data.code;
    throw error;
  }

  return { bytes: new Uint8Array(await response.arrayBuffer()) };
};

// Customer-facing lookup — mounted under /orders, not /admin/invoices.
export const getOrderInvoice = (token: string, orderId: string) =>
  apiRequest<{ data: Invoice }>(`/orders/${orderId}/invoice`, { token });
