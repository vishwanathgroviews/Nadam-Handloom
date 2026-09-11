import { z } from 'zod';

const csv = () =>
  z
    .string()
    .optional()
    .transform((v) => (v ? v.split(',').map((s) => s.trim()).filter(Boolean) : undefined));

export const listProductsQuerySchema = z.object({
  category: z.string().optional(),
  subcategoryId: z.string().optional(),
  subCategory: csv(),
  technique: csv(),
  borderStyle: csv(),
  purity: csv(),
  zariTier: csv(),
  blouseType: csv(),
  pattern: csv(),
  color: csv(),
  occasion: csv(),
  minPrice: z.coerce.number().nonnegative().optional(),
  maxPrice: z.coerce.number().nonnegative().optional(),
  q: z.string().trim().optional(),
  featured: z.coerce.boolean().optional(),
  sort: z.enum(['newest', 'price_asc', 'price_desc', 'featured']).default('newest'),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(48).default(12),
});

export type ListProductsQuery = z.infer<typeof listProductsQuerySchema>;
