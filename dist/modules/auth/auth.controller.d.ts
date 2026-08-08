import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../middleware/jwt.middleware';
export declare class AuthController {
    static register(req: Request, res: Response, next: NextFunction): Promise<void>;
    static adminProvision(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
    static login(req: Request, res: Response, next: NextFunction): Promise<void>;
    static refresh(req: Request, res: Response, next: NextFunction): Promise<void>;
    static logout(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
    static otpVerify(req: Request, res: Response, next: NextFunction): Promise<void>;
    static otpResend(req: Request, res: Response, next: NextFunction): Promise<void>;
    static passwordResetRequest(req: Request, res: Response, next: NextFunction): Promise<void>;
    static passwordResetConfirm(req: Request, res: Response, next: NextFunction): Promise<void>;
}
//# sourceMappingURL=auth.controller.d.ts.map