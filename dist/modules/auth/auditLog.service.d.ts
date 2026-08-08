import { Request } from 'express';
export interface LogAuthEventParams {
    accountId: string | null;
    eventType: string;
    req: Request;
    metadata?: Record<string, unknown>;
}
export declare const logAuthEvent: ({ accountId, eventType, req, metadata }: LogAuthEventParams) => Promise<void>;
//# sourceMappingURL=auditLog.service.d.ts.map