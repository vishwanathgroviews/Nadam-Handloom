import { describe, it, expect } from 'vitest';
import {
  generateAccessToken,
  verifyAccessToken,
  generateRefreshToken,
  hashRefreshToken,
} from './token.service';

describe('token.service', () => {
  it('signs and verifies an access token round-trip', () => {
    const token = generateAccessToken({ id: 'acc-1', roles: ['CUSTOMER'] });
    const decoded = verifyAccessToken(token) as any;
    expect(decoded.id).toBe('acc-1');
    expect(decoded.roles).toEqual(['CUSTOMER']);
  });

  it('rejects a tampered access token', () => {
    const token = generateAccessToken({ id: 'acc-1' });
    expect(() => verifyAccessToken(token + 'tampered')).toThrow();
  });

  it('generates a refresh token whose hash matches hashRefreshToken', () => {
    const { token, hash } = generateRefreshToken();
    expect(hashRefreshToken(token)).toBe(hash);
  });

  it('produces different refresh tokens on each call', () => {
    const a = generateRefreshToken();
    const b = generateRefreshToken();
    expect(a.token).not.toBe(b.token);
    expect(a.hash).not.toBe(b.hash);
  });
});
