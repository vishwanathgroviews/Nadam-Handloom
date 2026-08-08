import { Request, Response } from 'express';
interface AccountForSession {
    id: string;
    securityStamp: string;
}
export interface AccessTokenPayload {
    id: string;
    roles: string[];
    permissions: string[];
    securityStamp: string;
}
export declare const buildAccessTokenPayload: (account: AccountForSession, roles: string[], permissions: string[]) => AccessTokenPayload;
export interface IssueSessionOptions {
    platform?: string | undefined;
    deviceName?: string | undefined;
}
export interface IssuedSession {
    accessToken: string;
    refreshToken: string;
}
/**
 * Issues a fresh access token + rotated/created refresh-token session, and sets the
 * HttpOnly refresh cookie. Used by login (direct success), otpVerify (post-MFA success),
 * and refresh (rotation).
 */
export declare const issueSession: (account: AccountForSession, roles: string[], permissions: string[], req: Request, res: Response, options?: IssueSessionOptions) => Promise<IssuedSession>;
export declare const revokeAllSessionsForAccount: (authAccountId: string) => Promise<void>;
export {};
//# sourceMappingURL=session.service.d.ts.map