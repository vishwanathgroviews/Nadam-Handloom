import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../config/prisma', async () => {
  const { createFakePrisma } = await import('../../test/fakePrisma');
  const fake = createFakePrisma();
  return { prisma: fake.client, __fake: fake };
});

import * as prismaModule from '../../config/prisma';
import { createOtp, verifyOtp, resendOtp } from './otp.service';
import { TooManyRequestsError, BadRequestError } from '../../utils/errors';

const fake = (prismaModule as any).__fake;

beforeEach(() => {
  for (const key of Object.keys(fake.db)) fake.db[key] = [];
});

describe('otp.service', () => {
  it('creates and verifies a correct OTP', async () => {
    const { code } = await createOtp('acc_1', 'signup_verify');
    await expect(verifyOtp('acc_1', 'signup_verify', code)).resolves.toBeUndefined();
  });

  it('rejects an incorrect code and locks out after 3 attempts', async () => {
    const { code } = await createOtp('acc_2', 'signup_verify');
    const wrong = code === '000000' ? '111111' : '000000';

    await expect(verifyOtp('acc_2', 'signup_verify', wrong)).rejects.toThrow(BadRequestError);
    await expect(verifyOtp('acc_2', 'signup_verify', wrong)).rejects.toThrow(BadRequestError);
    await expect(verifyOtp('acc_2', 'signup_verify', wrong)).rejects.toThrow(BadRequestError);

    // 4th attempt: the code is now invalidated even though attempts alone would allow one more try.
    await expect(verifyOtp('acc_2', 'signup_verify', code)).rejects.toThrow('Invalid or expired verification code');
  });

  it('supersedes a previous unused code when a new one is created', async () => {
    const first = await createOtp('acc_3', 'signup_verify');
    const second = await createOtp('acc_3', 'signup_verify');

    await expect(verifyOtp('acc_3', 'signup_verify', first.code)).rejects.toThrow();
    await expect(verifyOtp('acc_3', 'signup_verify', second.code)).resolves.toBeUndefined();
  });

  it('enforces the resend cooldown', async () => {
    await createOtp('acc_4', 'signup_verify');
    await expect(resendOtp('acc_4', 'signup_verify')).rejects.toThrow(TooManyRequestsError);
  });
});
