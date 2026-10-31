// Request shapes for the sale endpoints (Module 5). Messages are plain English for the app.
import { z } from 'zod';
import { normalizeMobile } from '../utils/phone.js';
import { PAYMENT_METHODS, LIMITS } from '../services/sale.service.js';

const ref = z.string({ error: 'Unknown bill.' }).min(6, 'Unknown bill.').max(64, 'Unknown bill.').regex(/^[A-Za-z0-9_-]+$/, 'Unknown bill.');
const paise = (v) => Math.abs(Math.round(v * 100) - v * 100) < 1e-6;
const price = z.number({ error: 'Type the price.' })
  .positive('The price must be more than ₹0.')
  .max(LIMITS.maxPrice, 'The price can be at most ₹10,00,000.')
  .refine(paise, 'Use at most two digits after the point.')
  .transform((v) => Math.round(v * 100) / 100);
const text = (max, msg) => z.string().trim().max(max, msg).optional().transform((v) => (v ? v.replace(/\s+/g, ' ') : undefined));

export const idParams = z.object({ id: z.uuid('Unknown sale.') });
export const lookupBody = z.object({ code: z.string({ error: 'Scan or type the tag.' }).min(1, 'Scan or type the tag.').max(80) });

export const sellBody = z.object({
  clientRef: ref,
  lines: z.array(z.object({
    pieceId: z.uuid('Unknown saree on the bill.'),
    price,
    storePrice: z.number().min(0).max(LIMITS.maxPrice),
    // An owner chose "Sell anyway" for this saree: its online checkout is cancelled.
    sellHeld: z.boolean().default(false),
  }), { error: 'Scan at least one saree.' })
    .min(1, 'Scan at least one saree.')
    .max(LIMITS.linesPerBill, `A bill can have up to ${LIMITS.linesPerBill} sarees. Complete this one and start another.`)
    .refine((ls) => new Set(ls.map((l) => l.pieceId)).size === ls.length, 'The same saree is on this bill twice. Remove one.'),
  channel: z.enum(['store', 'whatsapp'], { error: 'Choose where: at the counter or a WhatsApp order.' }),
  paymentMethod: z.enum(PAYMENT_METHODS, { error: 'Choose how the customer paid: Cash, UPI or Card.' }),
  invoice: z.boolean({ error: 'Choose whether the customer wants an invoice.' }),
  customer: z.object({
    name: text(60, 'Keep the name under 60 characters.'),
    mobile: z.string().trim().max(20).optional(),
    // The delivery address keeps its lines (Module 7's ship-to card); spaces inside a line are tidied.
    address: z.string().trim().max(600, 'Keep the address under 600 characters.').optional()
      .transform((v) => (v ? v.split(/\r?\n/).map((l) => l.trim().replace(/\s+/g, ' ')).filter(Boolean).join('\n') : undefined)),
  }).default({}),
}).transform((v, ctx) => {
  const c = v.customer;
  const mobile = c.mobile ? normalizeMobile(c.mobile) : null;
  if (c.mobile && !mobile) ctx.addIssue({ code: 'custom', path: ['customer', 'mobile'], message: 'Enter a 10-digit mobile number.' });
  if (v.channel === 'whatsapp') {
    if (!c.name || c.name.length < 2) ctx.addIssue({ code: 'custom', path: ['customer', 'name'], message: 'Type the customer\'s name for a WhatsApp order.' });
    if (!c.mobile) ctx.addIssue({ code: 'custom', path: ['customer', 'mobile'], message: 'Type the customer\'s mobile number for a WhatsApp order.' });
    if (!c.address || c.address.length < 10) ctx.addIssue({ code: 'custom', path: ['customer', 'address'], message: 'Type the full delivery address for a WhatsApp order.' });
  }
  return { ...v, customer: { name: c.name ?? null, mobile, address: v.channel === 'whatsapp' ? c.address ?? null : null } };
});

export const cancelBody = z.object({
  reason: z.string({ error: 'Choose or type a reason.' }).trim().min(3, 'Choose or type a reason.').max(200, 'Keep the reason under 200 characters.'),
});
