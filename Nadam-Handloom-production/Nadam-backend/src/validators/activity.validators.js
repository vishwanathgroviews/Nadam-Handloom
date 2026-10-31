// Request shapes for the Activity endpoints (Module 10).
import { z } from 'zod';

const ymd = (label) => z.string({ error: `Choose the ${label} day.` }).regex(/^\d{4}-\d{2}-\d{2}$/, `Choose the ${label} day.`);
const flag = z.union([z.boolean(), z.enum(['true', 'false', '1', '0'])]).transform((v) => v === true || v === 'true' || v === '1');

export const listQuery = z.object({
  kind: z.enum(['all', 'sales', 'orders', 'prices', 'products', 'team', 'signin', 'settings']).default('all'),
  person: z.uuid('Unknown person.').optional(),
  period: z.enum(['today', '7d', '30d', 'custom', 'all']).default('30d'),
  from: ymd('first').optional(),
  to: ymd('last').optional(),
  q: z.string().max(80).default(''),
  important: flag.default(false),
  before: z.string().max(80).regex(/^[0-9T:.\-Z]+\|[0-9a-f-]+$/, 'Unknown page.').optional(),
}).refine((v) => v.period !== 'custom' || (v.from && v.to), 'Choose the first and last day.');
