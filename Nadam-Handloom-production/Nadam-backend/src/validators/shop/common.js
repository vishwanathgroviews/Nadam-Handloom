// Shared field rules for the website APIs (W1). Messages are plain English the website
// shows next to the field.
import { z } from 'zod';
import { SHOP, INDIAN_STATES, LANGUAGES, ADDRESS_LABELS } from '../../config/constants.js';
import { normalizeMobile } from '../../utils/phone.js';

const squash = (v) => String(v ?? '').trim().replace(/\s+/g, ' ');

export const mobile = z
  .string({ error: 'Enter your mobile number.' })
  .transform((v) => normalizeMobile(v))
  .refine((v) => v !== null, 'Enter a 10-digit mobile number starting with 6, 7, 8 or 9.');

export const code = z.string({ error: 'Enter the 6-digit code.' }).trim().regex(/^\d{6}$/, 'Enter the 6-digit code from the SMS.');

export const fullName = z
  .string({ error: 'Enter your full name.' })
  .transform(squash)
  .refine((v) => v.length >= SHOP.NAME_MIN, 'Enter your full name.')
  .refine((v) => v.length <= SHOP.NAME_MAX, `Use ${SHOP.NAME_MAX} characters or fewer.`)
  .refine((v) => /^[\p{L}\p{M}][\p{L}\p{M} .'-]*$/u.test(v), 'Use letters only (spaces, dots and hyphens are fine).');

export const email = z
  .string({ error: 'Enter your email address.' })
  .trim()
  .toLowerCase()
  .max(254, 'This email address is too long.')
  .pipe(z.email('Enter a valid email address, like name@example.com.'));

export const pincode = z.string({ error: 'Enter your 6-digit pincode.' }).trim().regex(/^[1-9]\d{5}$/, 'Enter a valid 6-digit pincode.');

export const city = z
  .string()
  .transform(squash)
  .refine((v) => v.length >= 2 && v.length <= 60, 'Enter your city or town.')
  .refine((v) => /^[\p{L}\p{M}0-9][\p{L}\p{M}0-9 .,'()-]*$/u.test(v), 'Use letters only for the city.');

export const state = z.enum(INDIAN_STATES, { error: 'Choose your state.' });
export const language = z.enum(Object.keys(LANGUAGES), { error: 'Choose a language.' });
export const label = z.enum(ADDRESS_LABELS, { error: 'Choose Home, Office or Other.' });

// "YYYY-MM-DD", a real calendar date.
export const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a valid date.')
  .refine((v) => {
    const d = new Date(`${v}T00:00:00.000Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
  }, 'Use a valid date.');

const ageOn = (iso, today = new Date()) => {
  const d = new Date(`${iso}T00:00:00.000Z`);
  let age = today.getUTCFullYear() - d.getUTCFullYear();
  const m = today.getUTCMonth() - d.getUTCMonth();
  if (m < 0 || (m === 0 && today.getUTCDate() < d.getUTCDate())) age -= 1;
  return age;
};

export const dateOfBirth = isoDate.refine((v) => {
  const a = ageOn(v);
  return a >= 13 && a <= 110;
}, 'Enter your real date of birth (you must be 13 or older).');

export const anniversary = isoDate.refine((v) => v >= '1940-01-01' && new Date(`${v}T00:00:00.000Z`) <= new Date(), 'The anniversary can\'t be in the future.');

const text = (max) => z.string().transform(squash).refine((v) => v.length <= max, `Use ${max} characters or fewer.`);

// Where the customer came from (first visit): utm values and the referring site.
export const attribution = z
  .object({
    source: text(100).optional(),
    medium: text(100).optional(),
    campaign: text(100).optional(),
    referrer: text(200).optional(),
  })
  .partial()
  .optional()
  .catch(undefined);

export const uuidParam = z.object({ id: z.uuid('This item was not found.') });

// A Firebase Cloud Messaging token: long, URL-safe characters and colons.
export const pushToken = z.string({ error: 'Missing notification token.' }).trim().min(20).max(4096).regex(/^[A-Za-z0-9_:.-]+$/, 'Invalid notification token.');
