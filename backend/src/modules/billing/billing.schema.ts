import { z } from 'zod';

const billingItemSchema = z.object({
  code: z.string().trim().min(1, 'Scan or enter a code'),
  quantity: z.coerce.number().int().positive().max(50).default(1),
  // In-store bargaining: staff can sell below (or above) the category's
  // store price, same as the single-scan quick-sell flow.
  salePrice: z.coerce.number().positive().optional(),
});

export const completeSaleSchema = z.object({
  customerName: z.string().trim().min(1, 'Customer name is required').max(120),
  customerMobile: z.string().trim().min(6, 'Enter a valid mobile number').max(20).optional(),
  items: z.array(billingItemSchema).min(1, 'Add at least one item').max(100),
});
