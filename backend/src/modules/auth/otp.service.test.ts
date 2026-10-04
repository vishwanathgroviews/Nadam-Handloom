import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../config/prisma', async () => {
  const { createFakePrisma } = await import('../../test/fakePrisma');
  const fake = createFakePrisma();
  return { prisma: fake.client, __fake: fake };
});

vi.mock('../../providers/sms', () => ({ smsProvider: { sendOtp: vi.fn(), verifyOtp: vi.fn() } }));

import * as prismaModule from '../../config/prisma';
import { smsProvider } from '../../providers/sms';
import { createOtp, sendOtp, verifyOtp, resendOtp } from './otp.service';
import { TooManyRequestsError, BadRequestError } from '../../utils/errors';

const fake = (prismaModule as any).__fake;
const sendMock = smsProvider.sendOtp as ReturnType<typeof vi.fn>;
const providerVerifyMock = smsProvider.verifyOtp as ReturnType<typeof vi.fn>;

beforeEach(() => {
  for (const key of Object.keys(fake.db)) fake.db[key] = [];
  sendMock.mockReset();
  providerVerifyMock.mockReset();
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
    await expect(resendOtp('acc_4', 'signup_verify', '9876543210')).rejects.toThrow(TooManyRequestsError);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('delivers the code it created, which then verifies', async () => {
    const { code } = await sendOtp('acc_5', 'signup_verify', '9876543210');

    expect(sendMock).toHaveBeenCalledWith('9876543210', code);
    await expect(verifyOtp('acc_5', 'signup_verify', code)).resolves.toBeUndefined();
  });

  describe('with a gateway that generates the code itself', () => {
    beforeEach(() => {
      sendMock.mockResolvedValue({ reference: '4521' });
      providerVerifyMock.mockImplementation(async (_reference: string, code: string) => code === '654321');
    });

    it('has the gateway check the entry against the reference it returned', async () => {
      await sendOtp('acc_6', 'signup_verify', '9876543210');

      await expect(verifyOtp('acc_6', 'signup_verify', '654321')).resolves.toBeUndefined();
      expect(providerVerifyMock).toHaveBeenCalledWith('4521', '654321');
    });

    it('still locks out after 3 entries the gateway rejects', async () => {
      await sendOtp('acc_7', 'signup_verify', '9876543210');

      for (let i = 0; i < 3; i++) {
        await expect(verifyOtp('acc_7', 'signup_verify', '000000')).rejects.toThrow('Invalid verification code');
      }
      await expect(verifyOtp('acc_7', 'signup_verify', '654321')).rejects.toThrow('Invalid or expired verification code');
    });
  });
});
