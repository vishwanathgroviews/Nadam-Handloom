// Request shapes for Online payments (admin app, owners) and the phone's notification token.
import { z } from 'zod';
import { PERIODS } from '../utils/period.js';
import { pageFields } from '../utils/page.js';
import { STATUSES, METHODS } from '../services/onlinePayments.service.js';

const ymd = (label) => z.string({ error: `Choose the ${label} day.` }).regex(/^\d{4}-\d{2}-\d{2}$/, `Choose the ${label} day.`);

export const listQuery = z.object({
  status: z.enum(['all', ...STATUSES]).default('all'),
  period: z.enum(['all', ...PERIODS]).default('all'),
  from: ymd('first').optional(),
  to: ymd('last').optional(),
  method: z.enum(['all', ...METHODS]).default('all'),
  q: z.string().max(80).default(''),
  ...pageFields,
}).refine((v) => v.period !== 'custom' || (v.from && v.to), 'Choose the first and last day.');

export const numberParams = z.object({ number: z.string().regex(/^NH\d{8}$/, 'Unknown order.') });

export const pushBody = z.object({
  token: z.string({ error: 'No notification token.' }).min(20, 'No notification token.').max(4096),
  platform: z.enum(['android', 'ios']),
  payments: z.boolean().optional(),
});
export const pushPatch = z.object({ payments: z.boolean() });
