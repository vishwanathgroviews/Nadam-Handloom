import { z } from 'zod';

export const scanLookupSchema = z.object({
  code: z.string().trim().min(1, 'Scan or enter a code'),
});

// A WhatsApp sale is a remote order that still has to be packed and
// couriered, so unlike a counter sale it needs the buyer's delivery details
// up front — see scanSell in inventory.service.ts.
export const whatsappCustomerSchema = z.object({
  fullName: z.string().trim().min(1, 'Customer name is required').max(120),
  phone: z.string().trim().min(6, 'Enter a valid mobile number').max(20),
  line1: z.string().trim().min(1, 'Address is required').max(200),
  line2: z.string().trim().max(200).optional(),
  city: z.string().trim().min(1, 'City is required').max(100),
  state: z.string().trim().min(1, 'State is required').max(100),
  pincode: z.string().trim().min(4, 'Enter a valid pincode').max(12),
  notes: z.string().trim().max(500).optional(),
});

export const scanSellSchema = z
  .object({
    code: z.string().trim().min(1, 'Scan or enter a code'),
    quantity: z.coerce.number().int().positive().max(20).default(1),
    override: z.coerce.boolean().default(false),
    // In-store bargaining: staff can sell below (or above) the category's
    // store price. Omit to sell at the store price unchanged.
    salePrice: z.coerce.number().positive().optional(),
    // 'store' = handed over at the counter, done. 'whatsapp' = sold over
    // chat, still needs shipping, so it enters the To Ship queue instead.
    channel: z.enum(['store', 'whatsapp']).default('store'),
    customer: whatsappCustomerSchema.optional(),
  })
  .refine((data) => data.channel !== 'whatsapp' || data.customer, {
    message: 'Customer name, mobile and address are required for a WhatsApp order',
    path: ['customer'],
  });

export const receivePiecesSchema = z.object({
  barcodes: z.array(z.string().trim().min(3).max(64)).min(1).max(200),
});

export const ledgerQuerySchema = z.object({
  productId: z.string().uuid().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(50),
});
