import { apiRequest } from './client';
import { Invoice } from './invoices';

export interface BillingItemInput {
  code: string;
  quantity?: number;
  salePrice?: number;
}

export interface CompleteSaleInput {
  customerName: string;
  customerMobile?: string;
  items: BillingItemInput[];
}

export interface CompleteSaleResult {
  orderId: string;
  orderNumber: string;
  invoice: Invoice;
}

export const completeSale = (token: string, input: CompleteSaleInput) =>
  apiRequest<{ data: CompleteSaleResult }>('/admin/billing/complete-sale', {
    method: 'POST',
    token,
    body: input as any,
  });
