// Request shapes for the invoice endpoints (Module 6). Messages are plain English for the app.
import { z } from 'zod';
import { normalizeMobile } from '../utils/phone.js';
import { CHANNELS } from '../services/salesSummary.service.js';
import { pageFields } from '../utils/page.js';

const ymd = (label) => z.string({ error: `Choose the ${label} day.` }).regex(/^\d{4}-\d{2}-\d{2}$/, `Choose the ${label} day.`).refine((v) => !Number.isNaN(Date.parse(`${v}T00:00:00Z`)), `Choose the ${label} day.`);
const flag = z.union([z.boolean(), z.enum(['true', 'false', '1', '0'])]).transform((v) => v === true || v === 'true' || v === '1');
const channelList = z.union([z.array(z.enum(CHANNELS)), z.string().transform((s) => s.split(',').map((x) => x.trim()).filter(Boolean)).pipe(z.array(z.enum(CHANNELS)))])
  .refine((a) => a.length > 0, 'Choose at least one channel.');

export const idParams = z.object({ id: z.uuid('Unknown invoice.') });

export const listQuery = z.object({
  q: z.string().max(80).default(''),
  from: ymd('first').optional(),
  to: ymd('last').optional(),
  channel: z.enum(['all', ...CHANNELS]).default('all'),
  cancelled: flag.default(false),
  ...pageFields,
}).refine((v) => v.q.trim() || (v.from && v.to), 'Choose the days to show.');

export const withoutQuery = z.object({
  from: ymd('first'),
  to: ymd('last'),
  channel: z.enum(['all', 'store', 'whatsapp']).default('all'),
  ...pageFields,
});

export const summaryBody = z.object({ from: ymd('first'), to: ymd('last'), channels: channelList });
export const summaryQuery = summaryBody;

export const customerBody = z.object({
  name: z.string().trim().max(60, 'Keep the name under 60 characters.').optional().transform((v) => (v ? v.replace(/\s+/g, ' ') : null)),
  mobile: z.string().trim().max(20).optional(),
}).transform((v, ctx) => {
  const mobile = v.mobile ? normalizeMobile(v.mobile) : null;
  if (v.mobile && !mobile) ctx.addIssue({ code: 'custom', path: ['mobile'], message: 'Enter a 10-digit mobile number, or leave it empty.' });
  return { name: v.name ?? null, mobile };
});
