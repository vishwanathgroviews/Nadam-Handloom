// Request shapes for /api/v2/shop/auth.
import { z } from 'zod';
import { mobile, code, fullName, email, pincode, city, state, attribution, pushToken } from './common.js';

// trap: the hidden bot field (people never fill it).
export const codeBody = z.object({ mobile, trap: z.string().max(200).optional() });
export const verifyBody = z.object({ mobile, code });
export const completeBody = z.object({
  stepToken: z.string({ error: 'This step timed out. Please enter your mobile number again.' }).min(20).max(2000),
  fullName,
  email,
  pincode,
  city: city.optional(),
  state: state.optional(),
  marketingOptIn: z.boolean().default(false),
  attribution,
});
export const logoutBody = z.object({ pushToken: pushToken.optional().catch(undefined) });
