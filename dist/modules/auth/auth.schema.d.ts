import { z } from 'zod';
export declare const registerSchema: z.ZodObject<{
    body: z.ZodObject<{
        email: z.ZodEmail;
        phone: z.ZodOptional<z.ZodString>;
        password: z.ZodString;
        firstName: z.ZodString;
        lastName: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const adminProvisionSchema: z.ZodObject<{
    body: z.ZodObject<{
        email: z.ZodOptional<z.ZodEmail>;
        phone: z.ZodOptional<z.ZodString>;
        firstName: z.ZodString;
        lastName: z.ZodString;
        roleId: z.ZodUUID;
        employeeId: z.ZodOptional<z.ZodString>;
        department: z.ZodOptional<z.ZodString>;
        jobTitle: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const loginSchema: z.ZodObject<{
    body: z.ZodObject<{
        email: z.ZodOptional<z.ZodEmail>;
        phone: z.ZodOptional<z.ZodString>;
        password: z.ZodString;
        platform: z.ZodOptional<z.ZodString>;
        deviceName: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const refreshSchema: z.ZodObject<{
    body: z.ZodObject<{
        refreshToken: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const otpVerifySchema: z.ZodObject<{
    body: z.ZodObject<{
        email: z.ZodOptional<z.ZodEmail>;
        mfaToken: z.ZodOptional<z.ZodString>;
        code: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const otpResendSchema: z.ZodObject<{
    body: z.ZodObject<{
        email: z.ZodOptional<z.ZodEmail>;
        mfaToken: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const passwordResetRequestSchema: z.ZodObject<{
    body: z.ZodObject<{
        email: z.ZodOptional<z.ZodEmail>;
        phone: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const passwordResetConfirmSchema: z.ZodObject<{
    body: z.ZodObject<{
        token: z.ZodString;
        newPassword: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>;
//# sourceMappingURL=auth.schema.d.ts.map