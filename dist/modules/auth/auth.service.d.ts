export declare class AuthService {
    static hashPassword(password: string): Promise<string>;
    static verifyPassword(password: string, hash: string): Promise<boolean>;
    static registerCustomer(data: any): Promise<{
        roles: ({
            role: {
                id: string;
                name: string;
                isSystem: boolean;
                createdAt: Date;
                updatedAt: Date;
            };
        } & {
            authAccountId: string;
            roleId: string;
            assignedAt: Date;
        })[];
        userProfile: {
            id: string;
            authAccountId: string;
            firstName: string;
            lastName: string;
            displayName: string | null;
            avatarUrl: string | null;
            preferences: import("@prisma/client/runtime/client").JsonValue | null;
            createdAt: Date;
            updatedAt: Date;
            deletedAt: Date | null;
        } | null;
    } & {
        id: string;
        email: string | null;
        phone: string | null;
        passwordHash: string;
        status: string;
        emailVerifiedAt: Date | null;
        phoneVerifiedAt: Date | null;
        securityStamp: string;
        failedLoginAttempts: number;
        lockedUntil: Date | null;
        mfaEnabled: boolean;
        isCompromised: boolean;
        passwordChangedAt: Date | null;
        createdAt: Date;
        updatedAt: Date;
        deletedAt: Date | null;
    }>;
}
//# sourceMappingURL=auth.service.d.ts.map