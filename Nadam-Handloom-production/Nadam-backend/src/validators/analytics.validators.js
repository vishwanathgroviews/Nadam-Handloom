// Request shapes for the Analytics endpoints (Module 9).
import { z } from 'zod';
import { PERIODS } from '../utils/period.js';

const ymd = (label) => z.string({ error: `Choose the ${label} day.` }).regex(/^\d{4}-\d{2}-\d{2}$/, `Choose the ${label} day.`).refine((v) => !Number.isNaN(Date.parse(`${v}T00:00:00Z`)), `Choose the ${label} day.`);

export const periodQuery = z.object({
  period: z.enum(PERIODS).default('month'),
  from: ymd('first').optional(),
  to: ymd('last').optional(),
  channel: z.enum(['all', 'store', 'whatsapp', 'online']).default('all'),
}).refine((v) => v.period !== 'custom' || (v.from && v.to), 'Choose the first and last day.');

export const personParams = z.object({ id: z.uuid('Unknown person.') });
