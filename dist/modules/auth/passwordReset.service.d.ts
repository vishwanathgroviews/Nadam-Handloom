export declare const generateResetToken: (authAccountId: string) => Promise<string>;
export declare const validateResetToken: (rawToken: string) => Promise<{
    id: string;
    authAccountId: string;
    tokenHash: string;
    used: boolean;
    expiresAt: Date;
    usedAt: Date | null;
    createdAt: Date;
} | null>;
export declare const consumeResetTokenAndSetPassword: (tokenRow: {
    id: string;
    authAccountId: string;
}, newPassword: string) => Promise<void>;
//# sourceMappingURL=passwordReset.service.d.ts.map