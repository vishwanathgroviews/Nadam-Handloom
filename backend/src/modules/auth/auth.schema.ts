import { z } from 'zod';

const TRIVIAL_MPINS = new Set([
  '0000', '1111', '2222', '3333', '4444', '5555', '6666', '7777', '8888', '9999',
  '1234', '4321', '0123', '000000', '111111', '222222', '333333', '444444',
  '555555', '666666', '777777', '888888', '999999', '123456', '654321', '012345',
]);

export const mpinSchema = z
  .string()
  .regex(/^(\d{4}|\d{6})$/, 'MPIN must be 4 or 6 digits')
  .refine((v) => !TRIVIAL_MPINS.has(v), 'This MPIN is too easy to guess, please choose another');

const nameSchema = z.string().trim().min(2, 'Name is required').max(100);
const mobileSchema = z.string().regex(/^\d{10}$/, 'Mobile number must be 10 digits');
const platformSchema = z.enum(['web', 'ios', 'android']).default('web');

// --- Customer (web) ---
// Self-registration, phone + MPIN — no password, no email requirement (email
// stays on AuthAccount as an optional field for later, but registration only
// asks for what the customer flow actually needs: name, contact, location).

export const customerRegisterSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required').max(60),
  lastName: z.string().trim().min(1, 'Last name is required').max(60),
  phone: mobileSchema,
  state: z.string().trim().min(1, 'State is required'),
  pincode: z.string().regex(/^\d{6}$/, 'Pincode must be 6 digits'),
});

export const customerOtpVerifySchema = z.object({
  phone: mobileSchema,
  code: z.string().length(6, 'Code must be 6 digits'),
});

export const customerOtpResendSchema = z.object({
  phone: mobileSchema,
});

export const customerMpinSetupSchema = z
  .object({
    setupToken: z.string().min(1),
    mpin: mpinSchema,
    confirmMpin: z.string(),
    platform: platformSchema,
    deviceName: z.string().optional(),
  })
  .refine((data) => data.mpin === data.confirmMpin, {
    message: 'MPIN and confirmation do not match',
    path: ['confirmMpin'],
  });

export const customerLoginSchema = z.object({
  phone: mobileSchema,
  mpin: z.string().min(4).max(6),
  platform: platformSchema,
  deviceName: z.string().optional(),
});

export const customerMpinForgotSchema = z.object({
  phone: mobileSchema,
});

export const customerMpinResetSchema = z
  .object({
    phone: mobileSchema,
    code: z.string().length(6, 'Code must be 6 digits'),
    newMpin: mpinSchema,
    confirmNewMpin: z.string(),
  })
  .refine((data) => data.newMpin === data.confirmNewMpin, {
    message: 'MPIN and confirmation do not match',
    path: ['confirmNewMpin'],
  });

// --- App (mobile, ADMIN + STAFF) ---
// There is no self-registration here — an ADMIN provisions the account
// (name/email/role) via POST /admin/users first; this just activates it.

export const appActivationSchema = z.object({
  mobile: mobileSchema,
});

export const appOtpVerifySchema = z.object({
  mobile: mobileSchema,
  code: z.string().length(6, 'Code must be 6 digits'),
});

export const appMpinSetupSchema = z
  .object({
    setupToken: z.string().min(1),
    mpin: mpinSchema,
    confirmMpin: z.string(),
    platform: z.enum(['ios', 'android']).default('android'),
    deviceName: z.string().optional(),
  })
  .refine((data) => data.mpin === data.confirmMpin, {
    message: 'MPIN and confirmation do not match',
    path: ['confirmMpin'],
  });

export const appLoginSchema = z.object({
  mobile: mobileSchema,
  mpin: z.string().min(4).max(6),
  platform: z.enum(['ios', 'android']).default('android'),
  deviceName: z.string().optional(),
});

export const appMpinForgotSchema = z.object({
  mobile: mobileSchema,
});

export const appMpinResetSchema = z
  .object({
    mobile: mobileSchema,
    code: z.string().length(6, 'Code must be 6 digits'),
    newMpin: mpinSchema,
    confirmNewMpin: z.string(),
  })
  .refine((data) => data.newMpin === data.confirmNewMpin, {
    message: 'MPIN and confirmation do not match',
    path: ['confirmNewMpin'],
  });

// --- Shared ---

export const refreshTokenSchema = z.object({
  refreshToken: z.string().optional(),
});
