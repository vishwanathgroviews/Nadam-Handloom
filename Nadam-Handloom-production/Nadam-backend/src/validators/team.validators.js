// Request shapes for the team endpoints. Messages are plain English for the app.
import { z } from 'zod';
import { pageFields } from '../utils/page.js';
import { mobile } from './auth.validators.js';

const name = z
  .string({ error: 'Enter their full name.' })
  .transform((v) => v.trim().replace(/\s+/g, ' '))
  .pipe(
    z.string()
      .min(2, 'Enter their full name (at least 2 letters).')
      .max(80, 'Keep the name under 80 characters.')
      .refine((v) => /\p{L}/u.test(v), 'Enter a name with letters in it.')
      .refine((v) => !/[\p{Cc}<>]/u.test(v), 'Remove the < > characters from the name.'),
  );
const role = z.enum(['owner', 'staff'], { error: 'Choose Owner or Staff.' });

export const listQuery = z.object({
  tab: z.enum(['team', 'removed']).default('team'),
  q: z.string().max(80).default(''),
  ...pageFields,
});
export const memberParams = z.object({ id: z.uuid('Unknown team member.') });
export const memberDeviceParams = z.object({ id: z.uuid('Unknown team member.'), deviceId: z.uuid('Unknown phone.') });
export const inviteBody = z.object({ name, mobile, role });
export const renameBody = z.object({ name });
export const roleBody = z.object({ role });
export const reinviteBody = z.object({ role: role.default('staff') });
