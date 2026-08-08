import { describe, it, expect } from 'vitest';
import { generateMfaToken, verifyMfaToken } from './mfaToken.service';
import { generateAccessToken } from './token.service';

describe('mfaToken.service', () => {
  it('round-trips an MFA token to its account id', () => {
    const token = generateMfaToken('acc-42');
    expect(verifyMfaToken(token)).toBe('acc-42');
  });

  it('rejects a regular access token (missing typ: mfa)', () => {
    const accessToken = generateAccessToken({ id: 'acc-42' });
    expect(() => verifyMfaToken(accessToken)).toThrow('Invalid MFA token');
  });

  it('rejects a tampered token', () => {
    const token = generateMfaToken('acc-42');
    expect(() => verifyMfaToken(token + 'x')).toThrow();
  });
});
