import { apiRequest } from './client';
import { Invoice } from './invoices';

export interface ScanLookupResult {
  mode: 'serialized' | 'quantity';
  productId: string;
  productName: string;
  categoryName: string;
  storePrice: string;
  pieceId?: string;
  barcode?: string;
  sku?: string;
  status: string;
  availableQty?: number;
}

export interface WhatsappCustomerInput {
  fullName: string;
  phone: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  pincode: string;
  notes?: string;
}

export interface ScanSellItemInput {
  code: string;
  quantity?: number;
  override?: boolean;
  /** Bargained price for THIS line on THIS bill. Never changes the catalogue. */
  salePrice?: number;
}

export interface ScanSellSoldLine {
  productId: string;
  productName: string;
  quantity: number;
  /** What this line actually sold for. */
  unitPrice: number;
  /** The subcategory price, unchanged by any bargain on this sale. */
  storePrice: number;
  overridden: boolean;
  priceAdjusted: boolean;
}

export interface ScanSellResult {
  orderId: string;
  orderNumber: string;
  overridden: boolean;
  channel: 'store' | 'whatsapp';
  items: ScanSellSoldLine[];
  total: number;
  // Generated automatically with the sale. Null only if generation failed —
  // the sale still went through, and the invoice can be found (or retried)
  // from the Invoices screen.
  invoice: Invoice | null;
}

export interface StockLedgerEntry {
  id: string;
  productId: string;
  pieceId: string | null;
  delta: number;
  reason: string;
  channel: string;
  actorId: string | null;
  ref: string | null;
  createdAt: string;
  product: { name: string; sku: string };
  piece: { barcode: string } | null;
}

export interface LowStockProduct {
  id: string;
  name: string;
  sku: string;
  category: { name: string };
  stock: number;
  availableCount: number;
}

export interface LowStockResult {
  items: LowStockProduct[];
  threshold: number;
}

export const scanLookup = (token: string, code: string) =>
  apiRequest<{ data: ScanLookupResult }>('/admin/inventory/scan-lookup', { method: 'POST', token, body: { code } });

/**
 * Completes one sale of one or more scanned products: a single order number
 * and a single invoice, however many lines are on the bill.
 */
export const scanSell = (
  token: string,
  items: ScanSellItemInput[],
  options: {
    // 'store' (default) closes the sale at the counter; 'whatsapp' records a
    // remote order that still has to be shipped, so it needs `customer`.
    channel?: 'store' | 'whatsapp';
    customer?: WhatsappCustomerInput;
  } = {}
) =>
  apiRequest<{ data: ScanSellResult }>('/admin/inventory/scan-sell', {
    method: 'POST',
    token,
    body: { items, ...options } as any,
  });

export const receivePieces = (token: string, productId: string, barcodes: string[]) =>
  apiRequest<{ data: { id: string; barcode: string }[] }>(`/admin/inventory/products/${productId}/pieces`, {
    method: 'POST',
    token,
    body: { barcodes },
  });

export interface Piece {
  id: string;
  barcode: string;
  status: string;
  soldAt: string | null;
  createdAt: string;
}

export const listPieces = (token: string, productId: string) =>
  apiRequest<{ data: Piece[] }>(`/admin/inventory/products/${productId}/pieces`, { token });

export const getLedger = (token: string, params: { productId?: string; page?: number } = {}) => {
  const qs = new URLSearchParams();
  if (params.productId) qs.set('productId', params.productId);
  if (params.page) qs.set('page', String(params.page));
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return apiRequest<{ data: { items: StockLedgerEntry[]; total: number; page: number; pageSize: number } }>(
    `/admin/inventory/ledger${suffix}`,
    { token }
  );
};

export const getLowStock = (token: string) =>
  apiRequest<{ data: LowStockResult }>('/admin/inventory/low-stock', { token });
