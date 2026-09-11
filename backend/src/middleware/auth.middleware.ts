import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../modules/auth/token.service';
import { prisma } from '../config/prisma';
import { UnauthorizedError } from '../utils/errors';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    roles: string[];
    permissions: string[];
  };
}

export const authenticate = async (
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedError('Missing bearer token');
    }

    const token = authHeader.slice('Bearer '.length);
    const payload = verifyAccessToken(token);

    const account = await prisma.authAccount.findUnique({ where: { id: payload.sub } });

    if (
      !account ||
      account.deletedAt ||
      account.status !== 'active' ||
      account.securityStamp !== payload.securityStamp
    ) {
      throw new UnauthorizedError('Session no longer valid, please log in again');
    }

    req.user = { id: account.id, roles: payload.roles, permissions: payload.permissions };
    next();
  } catch (error) {
    if (error instanceof UnauthorizedError) return next(error);
    next(new UnauthorizedError('Invalid or expired access token'));
  }
};
