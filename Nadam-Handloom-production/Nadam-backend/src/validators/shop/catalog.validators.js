// Request shapes for the website's shop lists and saree pages. Unknown or old values in a
// link are ignored (never an error page): a filter that doesn't exist simply isn't applied.
import { z } from 'zod';
import { SHOP_CATALOG, PRICE_BANDS, CRAFTS } from '../../config/constants.js';

const optional = (schema) => schema.optional().catch(undefined);
const CRAFT_KEYS = CRAFTS.map((c) => c.key);

export const listQuery = z.object({
  category: optional(z.string().trim().toLowerCase().regex(/^[a-z0-9-]{1,80}$/)),
  collection: optional(z.uuid()),
  craft: z
    .string()
    .optional()
    .transform((v) => [...new Set(String(v || '').split(',').map((s) => s.trim().toLowerCase()).filter((s) => CRAFT_KEYS.includes(s)))])
    .catch([]),
  price: optional(z.enum(PRICE_BANDS.map((b) => b.key))),
  sets: z.string().optional().transform((v) => v === '1' || v === 'true').catch(false),
  q: optional(z.string().trim().max(60).transform((v) => v.replace(/[%_\\]/g, ' ').replace(/\s+/g, ' ').trim()).refine((v) => v.length > 0)),
  sort: z.enum(['new', 'price-asc', 'price-desc']).default('new').catch('new'),
  offset: z.coerce.number().int().min(0).max(10000).default(0).catch(0),
  limit: z.coerce.number().int().min(1).max(SHOP_CATALOG.MAX_PAGE_SIZE).default(SHOP_CATALOG.PAGE_SIZE).catch(SHOP_CATALOG.PAGE_SIZE),
}).transform(({ craft, ...rest }) => ({ ...rest, crafts: craft }));

export const slugParam = z.object({ slug: z.string().trim().min(1).max(160).regex(/^[A-Za-z0-9-]+$/, 'This saree was not found.') });
