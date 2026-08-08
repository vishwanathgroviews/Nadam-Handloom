import { Request, Response, NextFunction } from 'express';
export interface AuthenticatedRequest extends Request {
    user?: {
        id: string;
        roles: string[];
        permissions: string[];
    };
}
export declare const authenticateJWT: (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void>;
//# sourceMappingURL=jwt.middleware.d.ts.map