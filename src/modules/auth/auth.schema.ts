import { z } from 'zod';

// Password policy: Min 8 chars, 1 uppercase, 1 lowercase, 1 number, 1 special char
const passwordSchema = z.string()
  .min(8, 'Password must be at least 8 characters long')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[\W_]/, 'Password must contain at least one special character');

export const registerSchema = z.object({
  body: z.object({
    email: z.email(),
    phone: z.string().optional(),
    password: passwordSchema,
    firstName: z.string().min(2),
    lastName: z.string().min(2),
  })
});

export const adminProvisionSchema = z.object({
  body: z.object({
    email: z.email().optional(),
    phone: z.string().optional(),
    firstName: z.string().min(2),
    lastName: z.string().min(2),
    roleId: z.uuid(),
    employeeId: z.string().optional(),
    department: z.string().optional(),
    jobTitle: z.string().optional(),
  }).refine(d => d.email || d.phone, { message: 'email or phone required', path: ['email'] })
});

export const loginSchema = z.object({
  body: z.object({
    email: z.email().optional(),
    phone: z.string().optional(),
    password: z.string(),
    platform: z.string().optional(),
    deviceName: z.string().optional()
  }).refine(d => d.email || d.phone, { message: 'email or phone required', path: ['email'] })
});

export const refreshSchema = z.object({
  body: z.object({
    refreshToken: z.string().optional(),
  })
});

export const otpVerifySchema = z.object({
  body: z.object({
    email: z.email().optional(),
    mfaToken: z.string().optional(),
    code: z.string().length(6),
  }).refine(d => d.email || d.mfaToken, { message: 'email or mfaToken required', path: ['email'] })
});

export const otpResendSchema = z.object({
  body: z.object({
    email: z.email().optional(),
    mfaToken: z.string().optional(),
  }).refine(d => d.email || d.mfaToken, { message: 'email or mfaToken required', path: ['email'] })
});

export const passwordResetRequestSchema = z.object({
  body: z.object({
    email: z.email().optional(),
    phone: z.string().optional(),
  }).refine(d => d.email || d.phone, { message: 'email or phone required', path: ['email'] })
});

export const passwordResetConfirmSchema = z.object({
  body: z.object({
    token: z.string().min(20),
    newPassword: passwordSchema,
  })
});
