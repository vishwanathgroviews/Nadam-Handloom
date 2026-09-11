import { z } from 'zod';

export const addressSchema = z.object({
  fullName: z.string().trim().min(2, 'Full name is required'),
  phone: z.string().regex(/^\d{10}$/, 'Phone number must be 10 digits'),
  line1: z.string().trim().min(3, 'Address line is required'),
  line2: z.string().trim().optional(),
  city: z.string().trim().min(2, 'City is required'),
  state: z.string().trim().min(2, 'State is required'),
  pincode: z.string().regex(/^\d{6}$/, 'Pincode must be 6 digits'),
  isDefault: z.boolean().optional().default(false),
});

export const updateAddressSchema = addressSchema.partial();
