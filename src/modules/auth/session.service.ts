import { Request, Response } from 'express';
import { prisma } from '../../config/prisma';
import { generateAccessToken, generateRefreshToken } from './token.service';

const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

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

export const buildAccessTokenPayload = (
  account: AccountForSession,
  roles: string[],
  permissions: string[]
): AccessTokenPayload => ({
  id: account.id,
  roles,
  permissions,
  securityStamp: account.securityStamp,
});

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
export const issueSession = async (
  account: AccountForSession,
  roles: string[],
  permissions: string[],
  req: Request,
  res: Response,
  options: IssueSessionOptions = {}
): Promise<IssuedSession> => {
  const payload = buildAccessTokenPayload(account, roles, permissions);
  const accessToken = generateAccessToken(payload);

  const { token: refreshToken, hash: refreshHash } = generateRefreshToken();

  await prisma.session.create({
    data: {
      authAccountId: account.id,
      refreshTokenHash: refreshHash,
      platform: options.platform || 'web',
      deviceName: options.deviceName || 'unknown',
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
      ipAddress: req.ip ?? null,
      userAgent: (req.headers['user-agent'] as string | undefined) ?? null,
    },
  });

  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: REFRESH_TOKEN_TTL_MS,
  });

  return { accessToken, refreshToken };
};

export const revokeAllSessionsForAccount = async (authAccountId: string): Promise<void> => {
  await prisma.session.updateMany({
    where: { authAccountId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
};
