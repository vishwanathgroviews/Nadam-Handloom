import { z } from 'zod';

export const listInvoicesQuerySchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  channel: z.enum(['all', 'online', 'store', 'whatsapp']).default('all'),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(50).default(20),
});

export const salesReportSchema = z
  .object({
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
    channel: z.enum(['all', 'online', 'store', 'whatsapp']).default('all'),
  })
  .refine((data) => !data.from || !data.to || data.from <= data.to, {
    message: '"from" must be on or before "to"',
    path: ['from'],
  });
