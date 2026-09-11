import { z } from 'zod';
import { addressSchema } from '../address/address.schema';

const checkoutItemSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().positive().max(20),
});

export const checkoutSchema = z
  .object({
    items: z.array(checkoutItemSchema).min(1, 'Cart is empty'),
    addressId: z.string().uuid().optional(),
    address: addressSchema.optional(),
  })
  .refine((data) => data.addressId || data.address, {
    message: 'A shipping address is required',
    path: ['address'],
  });

export const verifyPaymentSchema = z.object({
  razorpay_order_id: z.string().min(1),
  razorpay_payment_id: z.string().min(1),
  razorpay_signature: z.string().min(1),
});

export const listOrdersQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(50).default(10),
});
