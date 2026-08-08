"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.passwordResetConfirmSchema = exports.passwordResetRequestSchema = exports.otpResendSchema = exports.otpVerifySchema = exports.refreshSchema = exports.loginSchema = exports.adminProvisionSchema = exports.registerSchema = void 0;
const zod_1 = require("zod");
// Password policy: Min 8 chars, 1 uppercase, 1 lowercase, 1 number, 1 special char
const passwordSchema = zod_1.z.string()
    .min(8, 'Password must be at least 8 characters long')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[\W_]/, 'Password must contain at least one special character');
exports.registerSchema = zod_1.z.object({
    body: zod_1.z.object({
        email: zod_1.z.email(),
        phone: zod_1.z.string().optional(),
        password: passwordSchema,
        firstName: zod_1.z.string().min(2),
        lastName: zod_1.z.string().min(2),
    })
});
exports.adminProvisionSchema = zod_1.z.object({
    body: zod_1.z.object({
        email: zod_1.z.email().optional(),
        phone: zod_1.z.string().optional(),
        firstName: zod_1.z.string().min(2),
        lastName: zod_1.z.string().min(2),
        roleId: zod_1.z.uuid(),
        employeeId: zod_1.z.string().optional(),
        department: zod_1.z.string().optional(),
        jobTitle: zod_1.z.string().optional(),
    }).refine(d => d.email || d.phone, { message: 'email or phone required', path: ['email'] })
});
exports.loginSchema = zod_1.z.object({
    body: zod_1.z.object({
        email: zod_1.z.email().optional(),
        phone: zod_1.z.string().optional(),
        password: zod_1.z.string(),
        platform: zod_1.z.string().optional(),
        deviceName: zod_1.z.string().optional()
    }).refine(d => d.email || d.phone, { message: 'email or phone required', path: ['email'] })
});
exports.refreshSchema = zod_1.z.object({
    body: zod_1.z.object({
        refreshToken: zod_1.z.string().optional(),
    })
});
exports.otpVerifySchema = zod_1.z.object({
    body: zod_1.z.object({
        email: zod_1.z.email().optional(),
        mfaToken: zod_1.z.string().optional(),
        code: zod_1.z.string().length(6),
    }).refine(d => d.email || d.mfaToken, { message: 'email or mfaToken required', path: ['email'] })
});
exports.otpResendSchema = zod_1.z.object({
    body: zod_1.z.object({
        email: zod_1.z.email().optional(),
        mfaToken: zod_1.z.string().optional(),
    }).refine(d => d.email || d.mfaToken, { message: 'email or mfaToken required', path: ['email'] })
});
exports.passwordResetRequestSchema = zod_1.z.object({
    body: zod_1.z.object({
        email: zod_1.z.email().optional(),
        phone: zod_1.z.string().optional(),
    }).refine(d => d.email || d.phone, { message: 'email or phone required', path: ['email'] })
});
exports.passwordResetConfirmSchema = zod_1.z.object({
    body: zod_1.z.object({
        token: zod_1.z.string().min(20),
        newPassword: passwordSchema,
    })
});
//# sourceMappingURL=auth.schema.js.map