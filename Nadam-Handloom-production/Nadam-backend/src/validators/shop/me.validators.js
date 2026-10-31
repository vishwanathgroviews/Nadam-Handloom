// Request shapes for /api/v2/shop/me.
import { z } from 'zod';
import { mobile, code, fullName, email, pincode, city, state, language, dateOfBirth, anniversary, label } from './common.js';

export const updateBody = z
  .object({
    fullName,
    email,
    pincode,
    city,
    state,
    dateOfBirth: dateOfBirth.nullable(),
    anniversary: anniversary.nullable(),
    language: language.nullable(),
    marketingOptIn: z.boolean(),
  })
  .partial()
  .strict('Some details can\'t be changed here.')
  .refine((v) => Object.keys(v).length > 0, 'Nothing to change.');

export const mobileCodeBody = z.object({ mobile });
export const mobileVerifyBody = z.object({ mobile, code });

export const deleteRequestBody = z.object({ reason: z.string().trim().max(300).optional() }).catch({});

const addressFields = {
  label,
  fullName,
  mobile,
  line1: z.string({ error: 'Enter the house or flat number and building.' }).trim().min(3, 'Enter the house or flat number and building.').max(120, 'Use 120 characters or fewer.'),
  line2: z.string().trim().max(120, 'Use 120 characters or fewer.'),
  landmark: z.string().trim().max(80, 'Use 80 characters or fewer.'),
  pincode,
  city,
  state,
  isDefault: z.boolean(),
};

export const addressBody = z.object({
  ...addressFields,
  label: label.default('home'),
  line2: addressFields.line2.optional(),
  landmark: addressFields.landmark.optional(),
  city: city.optional(),
  state: state.optional(),
  isDefault: z.boolean().default(false),
});

export const addressPatch = z
  .object(addressFields)
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Nothing to change.');
