import { describe, it, expect, vi } from 'vitest';

vi.mock('../../config/prisma', async () => {
  const { createFakePrisma } = await import('../../test/fakePrisma');
  const fake = createFakePrisma();
  return { prisma: fake.prisma, __fake: fake };
});

describe('otpCode.service', () => {
  it('verifies a freshly created code', async () => {
    const { createOtp, verifyOtp } = await import('./otpCode.service');
    const code = await createOtp('acc-1', 'email_verify');
    expect(await verifyOtp('acc-1', 'email_verify', code)).toBe(true);
  });

  it('rejects a wrong code without consuming the real one', async () => {
    const { createOtp, verifyOtp } = await import('./otpCode.service');
    const code = await createOtp('acc-2', 'email_verify');
    expect(await verifyOtp('acc-2', 'email_verify', '000000')).toBe(false);
    expect(await verifyOtp('acc-2', 'email_verify', code)).toBe(true);
  });

  it('rejects reuse of an already-verified code', async () => {
    const { createOtp, verifyOtp } = await import('./otpCode.service');
    const code = await createOtp('acc-3', 'email_verify');
    expect(await verifyOtp('acc-3', 'email_verify', code)).toBe(true);
    expect(await verifyOtp('acc-3', 'email_verify', code)).toBe(false);
  });

  it('caps attempts at 3, rejecting a correct code on the 4th try', async () => {
    const { createOtp, verifyOtp } = await import('./otpCode.service');
    const code = await createOtp('acc-4', 'email_verify');
    await verifyOtp('acc-4', 'email_verify', '000000');
    await verifyOtp('acc-4', 'email_verify', '000000');
    await verifyOtp('acc-4', 'email_verify', '000000');
    expect(await verifyOtp('acc-4', 'email_verify', code)).toBe(false);
  });

  it('rejects resend before the cooldown elapses', async () => {
    const { createOtp, resendOtp, OtpResendCooldownError } = await import('./otpCode.service');
    await createOtp('acc-5', 'email_verify');
    await expect(resendOtp('acc-5', 'email_verify')).rejects.toBeInstanceOf(OtpResendCooldownError);
  });

  it('tracks purposes independently for the same account', async () => {
    const { createOtp, verifyOtp } = await import('./otpCode.service');
    const emailCode = await createOtp('acc-6', 'email_verify');
    const mfaCode = await createOtp('acc-6', 'login_mfa');

    expect(await verifyOtp('acc-6', 'email_verify', emailCode)).toBe(true);
    // A failed attempt against the mfa purpose must not affect the (already-used) email_verify OTP.
    await verifyOtp('acc-6', 'login_mfa', '000000');
    expect(await verifyOtp('acc-6', 'login_mfa', mfaCode)).toBe(true);
  });
});
