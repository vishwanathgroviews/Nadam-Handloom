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

// One scanned line on a sale.
export const scanSellItemSchema = z.object({
  code: z.string().trim().min(1, 'Scan or enter a code'),
  quantity: z.coerce.number().int().positive().max(20).default(1),
  override: z.coerce.boolean().default(false),
  // Bargaining: staff can sell this line below (or above) the subcategory's
  // store price. It applies to this line on this order only — nothing writes
  // back to Subcategory.storePrice, so the next sale starts from the real
  // price again. Omit to sell at the store price unchanged.
  salePrice: z.coerce.number().positive().optional(),
});

export const scanSellSchema = z
  .object({
    // The canonical form: one sale, any number of scanned lines, one order
    // and one invoice at the end.
    items: z.array(scanSellItemSchema).min(1, 'Add at least one product').max(50).optional(),
    // Single-line shorthand, normalised into `items` below so the service
    // only ever deals with one shape.
    code: z.string().trim().min(1).optional(),
    quantity: z.coerce.number().int().positive().max(20).optional(),
    override: z.coerce.boolean().optional(),
    salePrice: z.coerce.number().positive().optional(),
    // 'store' = handed over at the counter, done. 'whatsapp' = sold over
    // chat, still needs shipping, so it enters the To Ship queue instead.
    channel: z.enum(['store', 'whatsapp']).default('store'),
    customer: whatsappCustomerSchema.optional(),
  })
  .refine((data) => (data.items && data.items.length > 0) || data.code, {
    message: 'Scan or enter at least one product',
    path: ['items'],
  })
  .refine((data) => data.channel !== 'whatsapp' || data.customer, {
    message: 'Customer name, mobile and address are required for a WhatsApp order',
    path: ['customer'],
  })
  .transform((data) => ({
    channel: data.channel,
    customer: data.customer,
    items:
      data.items && data.items.length > 0
        ? data.items
        : [
            {
              code: data.code as string,
              quantity: data.quantity ?? 1,
              override: data.override ?? false,
              ...(data.salePrice !== undefined ? { salePrice: data.salePrice } : {}),
            },
          ],
  }))
  // The same physical piece cannot be on one bill twice.
  .refine(
    (data) => {
      const codes = data.items.map((i) => i.code.trim().toUpperCase());
      return new Set(codes).size === codes.length;
    },
    { message: 'The same code was scanned twice on this sale', path: ['items'] }
  );

export const receivePiecesSchema = z.object({
  barcodes: z.array(z.string().trim().min(3).max(64)).min(1).max(200),
});

export const ledgerQuerySchema = z.object({
  productId: z.string().uuid().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(50),
});
