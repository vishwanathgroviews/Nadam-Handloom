import { z } from 'zod';

/**
 * Normalizes and formats an Indian mobile phone number.
 * Accepts:
 *   - 10 digits starting with 6, 7, 8, or 9 (e.g. 7382968566)
 *   - Optional +91 or 91 country code (e.g. +917382968566, 917382968566)
 *   - Optional leading 0 (e.g. 07382968566)
 *   - Formatted strings with spaces or dashes (e.g. +91 73829 68566)
 */
export const normalizeStorePhone = (input: string): { phone: string; displayPhone: string; tel: string } => {
  if (!input || typeof input !== 'string') {
    throw new Error('Store phone number is required');
  }

  const cleaned = input.trim();
  const digits = cleaned.replace(/\D/g, '');
  let tenDigits = digits;

  if (digits.length === 12 && digits.startsWith('91')) {
    tenDigits = digits.slice(2);
  } else if (digits.length === 11 && digits.startsWith('0')) {
    tenDigits = digits.slice(1);
  }

  if (tenDigits.length !== 10 || !/^[6-9]/.test(tenDigits)) {
    throw new Error('Please enter a valid 10-digit Indian mobile number (e.g. +91 73829 68566 or 7382968566)');
  }

  const phone = `+91${tenDigits}`;
  const displayPhone = `+91 ${tenDigits.slice(0, 5)} ${tenDigits.slice(5)}`;
  const tel = `+91${tenDigits}`;

  return { phone, displayPhone, tel };
};

export const updateStorePhoneSchema = z.object({
  phone: z
    .string()
    .trim()
    .min(10, 'Phone number must be at least 10 digits')
    .max(25, 'Phone number looks too long')
    .refine(
      (val) => {
        try {
          normalizeStorePhone(val);
          return true;
        } catch {
          return false;
        }
      },
      { message: 'Enter a valid 10-digit Indian phone number (e.g. +91 73829 68566 or 7382968566)' }
    ),
});
