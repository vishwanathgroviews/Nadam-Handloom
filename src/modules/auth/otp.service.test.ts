import { describe, it, expect } from 'vitest';
import { generateOtp, hashOtp } from './otp.service';

describe('otp.service', () => {
  it('generates a 6-digit numeric code', () => {
    const code = generateOtp();
    expect(code).toMatch(/^\d{6}$/);
  });

  it('hashOtp is deterministic for the same input', () => {
    expect(hashOtp('123456')).toBe(hashOtp('123456'));
  });

  it('hashOtp differs for different inputs', () => {
    expect(hashOtp('123456')).not.toBe(hashOtp('654321'));
  });
});
