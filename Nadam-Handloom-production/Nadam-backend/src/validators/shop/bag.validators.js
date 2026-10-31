// Request shapes for the bag (W5). A line is a saree's link name (slug), how many pieces, and
// the website price the customer saw when adding it (whole rupees, as shown).
import { z } from 'zod';
import { BAG } from '../../config/constants.js';

export const slug = z
  .string({ error: 'This saree was not found.' })
  .trim()
  .min(1, 'This saree was not found.')
  .max(160, 'This saree was not found.')
  .regex(/^[A-Za-z0-9-]+$/, 'This saree was not found.');

const quantity = z
  .number({ error: 'Choose how many pieces.' })
  .int('Choose a whole number of pieces.')
  .min(1, 'Choose at least 1 piece.')
  .max(BAG.MAX_QUANTITY, `Choose ${BAG.MAX_QUANTITY} pieces or fewer.`);

const priceSeen = z.number().min(0).max(10_000_000).transform((v) => Math.round(v)).optional().catch(undefined);

export const items = z
  .array(z.object({ slug, quantity, priceSeen }), { error: 'Send the sarees in the bag.' })
  .max(BAG.MAX_LINES, `A bag holds at most ${BAG.MAX_LINES} sarees.`);

export const itemsBody = z.object({ items });
export const slugParam = z.object({ slug });
export const setBody = z.object({ quantity, priceSeen });
