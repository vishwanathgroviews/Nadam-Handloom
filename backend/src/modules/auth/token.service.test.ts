import { describe, expect, it } from 'vitest';
import {
  generateAccessToken,
  verifyAccessToken,
  generatePurposeToken,
  verifyPurposeToken,
  generateRefreshToken,
  hashRefreshToken,
} from './token.service';

describe('token.service', () => {
  it('round-trips an access token with roles/permissions/securityStamp', () => {
    const token = generateAccessToken({
      sub: 'acc_1',
      securityStamp: 'stamp_1',
      roles: ['ADMIN'],
      permissions: ['users:read'],
    });

    const payload = verifyAccessToken(token);
    expect(payload.sub).toBe('acc_1');
    expect(payload.securityStamp).toBe('stamp_1');
    expect(payload.roles).toEqual(['ADMIN']);
    expect(payload.permissions).toEqual(['users:read']);
    expect(payload.typ).toBe('access');
  });

  it('rejects a tampered access token', () => {
    const token = generateAccessToken({ sub: 'a', securityStamp: 's', roles: [], permissions: [] });
    expect(() => verifyAccessToken(token.slice(0, -2) + 'xx')).toThrow();
  });

  it('round-trips a purpose token and rejects the wrong purpose', () => {
    const token = generatePurposeToken('acc_2', 'mpin_setup');
    const payload = verifyPurposeToken(token, 'mpin_setup');
    expect(payload.sub).toBe('acc_2');
    expect(() => verifyPurposeToken(token, 'mfa')).toThrow();
  });

  it('generates a refresh token whose hash matches hashRefreshToken', () => {
    const { token, hash } = generateRefreshToken();
    expect(hashRefreshToken(token)).toBe(hash);
    expect(token).not.toBe(hash);
  });
});
