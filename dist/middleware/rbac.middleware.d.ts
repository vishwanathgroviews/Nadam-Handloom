import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './jwt.middleware';
export declare const requirePermissions: (requiredPermissions: string[]) => (req: AuthenticatedRequest, res: Response, next: NextFunction) => void;
export declare const requireRoles: (requiredRoles: string[]) => (req: AuthenticatedRequest, res: Response, next: NextFunction) => void;
//# sourceMappingURL=rbac.middleware.d.ts.map