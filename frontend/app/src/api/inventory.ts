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
  phone: string;
  /** The entire delivery address as one block of text — see the WhatsApp form in ScannerScreen. */
  address: string;
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
  /** What staff chose on the bill. false = recorded without an invoice. */
  invoiceRequired: boolean;
  // Generated automatically with the sale when one was asked for. Null when
  // staff chose "Invoice Not Required", or if generation failed — the sale
  // still went through either way.
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

/**
 * Finds the product for a scanned or typed code. The full tag ("NANDAM3136"),
 * just the number on it ("3136") and a camera scan all find the same product.
 * `exact` turns the number match off — for checking a code is free before
 * assigning it to a new product, where "3136" means the literal code.
 */
export const scanLookup = (token: string, code: string, options: { exact?: boolean } = {}) =>
  apiRequest<{ data: ScanLookupResult }>('/admin/inventory/scan-lookup', {
    method: 'POST',
    token,
    body: { code, ...(options.exact ? { exact: true } : {}) },
  });

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
    // Required by the server: staff choose on every bill. false still
    // records the sale in full, it just never gets an invoice.
    invoiceRequired?: boolean;
  } = {}
) =>
  apiRequest<{ data: ScanSellResult }>('/admin/inventory/scan-sell', {
    method: 'POST',
    token,
    body: { items, ...options } as any,
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
