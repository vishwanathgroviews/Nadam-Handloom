// Request shapes for the Settings endpoints (Module 11).
import { z } from 'zod';
import { normalizeMobile } from '../utils/phone.js';

const part = z.object({ on: z.boolean().optional(), message: z.string().max(400).optional() }).strict();
export const maintenanceBody = z.object({ staff: part.optional(), website: part.optional() }).strict()
  .refine((v) => v.staff || v.website, 'Nothing to change.');

const build = z.number({ error: 'Type a whole number.' }).int('Type a whole number.').min(0).max(1000000);
export const updatesBody = z.object({
  platform: z.enum(['android', 'ios']),
  newest: build.optional(),
  oldest: build.optional(),
  required: z.boolean().optional(),
  link: z.string().max(300).optional(),
  requireThisPhone: z.boolean().optional(),
  tellThisPhone: z.boolean().optional(),
}).strict();

export const shopBody = z.object({
  name: z.string().trim().min(2, 'Type the shop name.').max(60, 'Keep the name under 60 characters.'),
  address: z.string().trim().min(10, 'Type the full address.').max(200, 'Keep the address under 200 characters.'),
  mobile: z.string().trim().max(20),
  gstin: z.string().trim().max(20),
  website: z.string().trim().max(120).optional().default(''),
}).strict().transform((v, ctx) => {
  const mobile = normalizeMobile(v.mobile);
  if (!mobile) ctx.addIssue({ code: 'custom', path: ['mobile'], message: 'Type a 10-digit mobile number.' });
  return { ...v, mobile: mobile || v.mobile };
});
