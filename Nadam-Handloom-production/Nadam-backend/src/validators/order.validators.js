// Request shapes for the order endpoints (Module 7). Messages are plain English for the app.
import { z } from 'zod';
import { TABS } from '../services/order.service.js';
import { pageFields } from '../utils/page.js';

export const idParams = z.object({ id: z.uuid('Unknown order.') });
export const listQuery = z.object({
  tab: z.enum(TABS).default('to_ship'),
  q: z.string().max(80).default(''),
  ...pageFields,
});
export const trackingBody = z.object({
  carrier: z.string({ error: 'Choose the courier.' }).trim().min(2, 'Type the courier\'s name.').max(40, 'Keep the courier\'s name under 40 characters.').default('DTDC'),
  awb: z.string({ error: 'Scan the label, or type its number.' }).trim().min(1, 'Scan the label, or type its number.').max(40, 'Scan the label, or type its number: 8 to 20 letters and digits.'),
});
export const cancelBody = z.object({
  reason: z.string({ error: 'Choose or type a reason.' }).trim().min(3, 'Choose or type a reason.').max(200, 'Keep the reason under 200 characters.'),
});
