// Request shapes for the catalogue endpoints. Messages are plain English for the app.
import { z } from 'zod';
import { pageFields } from '../utils/page.js';

const text = (label, min, max) =>
  z.string({ error: `Enter the ${label}.` })
    .transform((v) => v.trim().replace(/[ \t]+/g, ' '))
    .pipe(z.string().min(min, min > 1 ? `The ${label} needs at least ${min} letters.` : `Enter the ${label}.`).max(max, `Keep the ${label} under ${max} characters.`).refine((v) => !/[<>]/.test(v), `Remove the < > characters from the ${label}.`));
const description = z.string({ error: 'Add a short description: the website shows it.' })
  .transform((v) => v.trim())
  .pipe(z.string().min(1, 'Add a short description: the website shows it.').max(2000, 'Keep the description under 2000 characters.'));
// Rupees with up to 2 decimals, more than 0, at most ₹10,00,000.
const price = (label) => z.coerce.number({ error: `Enter the ${label}.` })
  .refine(Number.isFinite, `Enter the ${label}.`)
  .refine((v) => v > 0, `The ${label} must be more than ₹0.`)
  .refine((v) => v <= 1000000, `The ${label} can be at most ₹10,00,000.`)
  .refine((v) => Math.abs(v * 100 - Math.round(v * 100)) < 1e-6, `Use at most 2 decimals for the ${label}.`);
const mrp = z.union([z.null(), z.literal(''), price('MRP')]).transform((v) => (v === '' ? null : v));

export const idParams = z.object({ id: z.uuid('Unknown item.') });
export const listQuery = z.object({
  q: z.string().max(100).default(''),
  filter: z.enum(['all', 'hidden', 'nophoto', 'empty']).default('all'),
  ...pageFields,
});
export const categoryBody = z.object({ name: text('name', 2, 100), description });
export const categoryPatch = z.object({ name: text('name', 2, 100).optional(), description: description.optional() })
  .refine((v) => Object.keys(v).length > 0, 'Nothing to change.');
export const subcategoryBody = z.object({
  name: text('name', 2, 150), description, storePrice: price('store price'), websitePrice: price('website price'), mrp: mrp.optional().default(null),
});
export const subcategoryPatch = z.object({
  name: text('name', 2, 150).optional(), description: description.optional(), storePrice: price('store price').optional(), websitePrice: price('website price').optional(), mrp: mrp.optional(),
  showOnWebsite: z.boolean().optional(),
}).refine((v) => Object.keys(v).length > 0, 'Nothing to change.');
export const orderBody = z.object({ ids: z.array(z.uuid()).min(1).max(500) });
