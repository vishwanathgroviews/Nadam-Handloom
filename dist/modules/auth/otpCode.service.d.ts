export declare class OtpResendCooldownError extends Error {
    retryAfterSeconds: number;
    constructor(retryAfterSeconds: number);
}
/**
 * Postgres (OtpCode) is authoritative for attempts/used/resend-cooldown/purpose.
 * Redis just caches the hash with a matching TTL as an optional fast-path; it is
 * never treated as more authoritative than the DB row, and a Redis failure is non-fatal.
 */
export declare const createOtp: (accountId: string, purpose: string) => Promise<string>;
export declare const verifyOtp: (accountId: string, purpose: string, code: string) => Promise<boolean>;
export declare const resendOtp: (accountId: string, purpose: string) => Promise<string>;
//# sourceMappingURL=otpCode.service.d.ts.map