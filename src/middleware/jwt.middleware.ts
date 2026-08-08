import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/prisma';

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_please_change_in_production';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    roles: string[];
    permissions: string[];
  };
}

export const authenticateJWT = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized: Missing or invalid Bearer token' });
    return;
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    res.status(401).json({ error: 'Unauthorized: Missing or invalid Bearer token' });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;

    // MFA-pending tokens are single-purpose (for /otp/verify only) and must never
    // be accepted as a real access token.
    if (decoded.typ === 'mfa') {
      res.status(401).json({ error: 'Unauthorized: Token expired or invalid' });
      return;
    }

    // Enforce the security stamp against the DB so password resets (which regenerate
    // it) immediately invalidate every access token issued before the reset, even
    // though the JWT itself hasn't expired yet.
    const account = await prisma.authAccount.findUnique({
      where: { id: decoded.id },
      select: { securityStamp: true, status: true, deletedAt: true },
    });

    if (
      !account ||
      account.deletedAt ||
      account.status !== 'active' ||
      account.securityStamp !== decoded.securityStamp
    ) {
      res.status(401).json({ error: 'Unauthorized: Token expired or invalid' });
      return;
    }

    req.user = {
      id: decoded.id,
      roles: decoded.roles ?? [],
      permissions: decoded.permissions ?? [],
    };

    next();
  } catch (error) {
    res.status(401).json({ error: 'Unauthorized: Token expired or invalid' });
  }
};
