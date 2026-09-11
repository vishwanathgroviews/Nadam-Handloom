import jwt from 'jsonwebtoken';
import { env } from '../../config/env';
import { generateOpaqueToken, sha256 } from '../../utils/crypto';
import { parseDurationMs } from '../../utils/duration';
import { UnauthorizedError } from '../../utils/errors';

export interface AccessTokenPayload {
  sub: string;
  securityStamp: string;
  roles: string[];
  permissions: string[];
  typ: 'access';
}

export interface PurposeTokenPayload {
  sub: string;
  typ: 'mpin_setup' | 'mfa';
}

export const generateAccessToken = (
  payload: Omit<AccessTokenPayload, 'typ'>
): string => {
  return jwt.sign({ ...payload, typ: 'access' }, env.JWT_ACCESS_SECRET, {
    expiresIn: parseDurationMs(env.JWT_ACCESS_EXPIRES_IN) / 1000,
  });
};

export const verifyAccessToken = (token: string): AccessTokenPayload => {
  const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenPayload;
  if (payload.typ !== 'access') throw new UnauthorizedError('Invalid token type');
  return payload;
};

/** Short-lived (5m) single-purpose token bridging a multi-step flow, e.g. OTP-verify -> MPIN setup. */
export const generatePurposeToken = (sub: string, typ: PurposeTokenPayload['typ']): string => {
  return jwt.sign({ sub, typ }, env.JWT_ACCESS_SECRET, { expiresIn: 5 * 60 });
};

export const verifyPurposeToken = (
  token: string,
  expectedTyp: PurposeTokenPayload['typ']
): PurposeTokenPayload => {
  let payload: PurposeTokenPayload;
  try {
    payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as PurposeTokenPayload;
  } catch {
    throw new UnauthorizedError('Invalid or expired token');
  }
  if (payload.typ !== expectedTyp) throw new UnauthorizedError('Invalid token type');
  return payload;
};

/** Opaque refresh token: raw value goes to the client, only its SHA-256 hash is stored. */
export const generateRefreshToken = (): { token: string; hash: string } => {
  const token = generateOpaqueToken(64);
  return { token, hash: sha256(token) };
};

export const hashRefreshToken = (token: string): string => sha256(token);
