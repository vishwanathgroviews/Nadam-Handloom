import { Request, Response } from 'express';
import { prisma } from '../../config/prisma';
import { env, isProduction } from '../../config/env';
import { parseDurationMs } from '../../utils/duration';
import { UnauthorizedError } from '../../utils/errors';
import { generateAccessToken, generateRefreshToken, hashRefreshToken } from './token.service';
import { getRolesAndPermissions } from './permission.service';
import { logAuthEvent } from './auditLog.service';

export type Platform = 'web' | 'ios' | 'android';

const REFRESH_TOKEN_COOKIE = 'refreshToken';
const REFRESH_TOKEN_TTL_MS = () => parseDurationMs(env.JWT_REFRESH_EXPIRES_IN);

interface IssueSessionInput {
  authAccountId: string;
  securityStamp: string;
  req: Request;
  res: Response;
  platform: Platform;
  deviceName?: string | undefined;
}

export interface SessionTokens {
  accessToken: string;
  refreshToken?: string;
}

const setRefreshCookie = (res: Response, token: string) => {
  res.cookie(REFRESH_TOKEN_COOKIE, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'strict',
    path: '/api/v1/auth',
    maxAge: REFRESH_TOKEN_TTL_MS(),
  });
};

export const clearRefreshCookie = (res: Response) => {
  res.clearCookie(REFRESH_TOKEN_COOKIE, { path: '/api/v1/auth' });
};

/** Issues an access token + a new session-backed refresh token for the given account. */
export const issueSession = async ({
  authAccountId,
  securityStamp,
  req,
  res,
  platform,
  deviceName,
}: IssueSessionInput): Promise<SessionTokens> => {
  const { roles, permissions } = await getRolesAndPermissions(authAccountId);
  const { token: refreshToken, hash } = generateRefreshToken();

  await prisma.session.create({
    data: {
      authAccountId,
      refreshTokenHash: hash,
      platform,
      deviceName: deviceName ?? null,
      ipAddress: req.ip ?? null,
      userAgent: req.headers['user-agent'] ?? null,
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS()),
    },
  });

  const accessToken = generateAccessToken({
    sub: authAccountId,
    securityStamp,
    roles,
    permissions,
  });

  if (platform === 'web') {
    setRefreshCookie(res, refreshToken);
    return { accessToken };
  }

  return { accessToken, refreshToken };
};

const getRawRefreshToken = (req: Request): string | undefined => {
  return req.cookies?.[REFRESH_TOKEN_COOKIE] || req.body?.refreshToken;
};

/**
 * Rotates a refresh token: revokes the presented session and issues a new one.
 * Detects reuse of an already-revoked token (a strong signal of theft) and, on
 * detection, revokes every session for the account and flags them compromised.
 */
export const rotateSession = async (req: Request, res: Response): Promise<SessionTokens> => {
  const rawToken = getRawRefreshToken(req);
  if (!rawToken) throw new UnauthorizedError('Missing refresh token');

  const hash = hashRefreshToken(rawToken);
  const session = await prisma.session.findUnique({
    where: { refreshTokenHash: hash },
    include: { authAccount: true },
  });

  if (!session) throw new UnauthorizedError('Invalid refresh token');

  if (session.revokedAt) {
    await prisma.session.updateMany({
      where: { authAccountId: session.authAccountId, revokedAt: null },
      data: { revokedAt: new Date(), isCompromised: true },
    });
    await logAuthEvent({
      authAccountId: session.authAccountId,
      eventType: 'refresh_token_reuse_detected',
      source: session.platform === 'web' ? 'customer_web' : 'staff_app',
      req,
    });
    throw new UnauthorizedError('Session invalidated, please log in again');
  }

  if (session.expiresAt < new Date() || session.authAccount.deletedAt) {
    throw new UnauthorizedError('Session expired');
  }

  await prisma.session.update({
    where: { id: session.id },
    data: { revokedAt: new Date() },
  });

  // A refresh always preserves the session's original platform — the client
  // cannot switch a cookie-based web session into a body-token mobile one or vice versa.
  const platform = (session.platform as Platform) ?? 'web';

  return issueSession({
    authAccountId: session.authAccountId,
    securityStamp: session.authAccount.securityStamp,
    req,
    res,
    platform,
    deviceName: session.deviceName ?? undefined,
  });
};

export const revokeCurrentSession = async (req: Request, res: Response) => {
  const rawToken = getRawRefreshToken(req);
  if (rawToken) {
    const hash = hashRefreshToken(rawToken);
    await prisma.session.updateMany({
      where: { refreshTokenHash: hash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
  clearRefreshCookie(res);
};

export const revokeAllSessionsForAccount = async (authAccountId: string) => {
  await prisma.session.updateMany({
    where: { authAccountId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
};
