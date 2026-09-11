import { z } from 'zod';

export const analyticsQuerySchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  groupBy: z.enum(['day', 'week', 'month']).default('day'),
  limit: z.coerce.number().int().positive().max(50).default(10),
  channel: z.enum(['all', 'online', 'store', 'whatsapp']).default('all'),
});
