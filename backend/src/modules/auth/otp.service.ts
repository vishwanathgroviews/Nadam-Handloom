import { prisma } from '../../config/prisma';
import { generateOtpCode, sha256 } from '../../utils/crypto';
import { BadRequestError, TooManyRequestsError } from '../../utils/errors';
import { env, isProduction } from '../../config/env';

export type OtpPurpose = 'signup_verify' | 'mpin_reset';

// SMS_PROVIDER=console never delivers a real SMS (dev/test only — see
// providers/sms/console.provider.ts), so there is no other way to retrieve
// the code. Echoing it back in the API response lets registration/login
// flows work end-to-end before a real SMS gateway is configured; it stops
// happening the moment a real provider is set, and is disabled in
// production regardless of provider misconfiguration.
export const devOtpEcho = (code: string): { devOtp?: string } =>
  !isProduction && env.SMS_PROVIDER === 'console' ? { devOtp: code } : {};

const OTP_TTL_MS = 15 * 60 * 1000;
const OTP_RESEND_COOLDOWN_MS = 60 * 1000;
const OTP_MAX_ATTEMPTS = 3;

export const createOtp = async (
  authAccountId: string,
  purpose: OtpPurpose
): Promise<{ code: string; expiresAt: Date }> => {
  // Supersede any still-live codes for this account+purpose so only the latest is valid.
  await prisma.otpCode.updateMany({
    where: { authAccountId, purpose, used: false },
    data: { used: true },
  });

  const code = generateOtpCode();
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);

  await prisma.otpCode.create({
    data: {
      authAccountId,
      purpose,
      codeHash: sha256(code),
      expiresAt,
      resendAvailableAt: new Date(Date.now() + OTP_RESEND_COOLDOWN_MS),
    },
  });

  return { code, expiresAt };
};

export const resendOtp = async (
  authAccountId: string,
  purpose: OtpPurpose
): Promise<{ code: string; expiresAt: Date }> => {
  const latest = await prisma.otpCode.findFirst({
    where: { authAccountId, purpose },
    orderBy: { createdAt: 'desc' },
  });

  if (latest && latest.resendAvailableAt > new Date()) {
    throw new TooManyRequestsError('Please wait before requesting another code');
  }

  return createOtp(authAccountId, purpose);
};

export const verifyOtp = async (
  authAccountId: string,
  purpose: OtpPurpose,
  code: string
): Promise<void> => {
  const otpRecord = await prisma.otpCode.findFirst({
    where: { authAccountId, purpose, used: false, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
  });

  if (!otpRecord) throw new BadRequestError('Invalid or expired verification code');

  if (otpRecord.attempts >= OTP_MAX_ATTEMPTS) {
    await prisma.otpCode.update({ where: { id: otpRecord.id }, data: { used: true } });
    throw new BadRequestError('Too many incorrect attempts, please request a new code');
  }

  if (otpRecord.codeHash !== sha256(code)) {
    const attempts = otpRecord.attempts + 1;
    await prisma.otpCode.update({
      where: { id: otpRecord.id },
      data: { attempts, ...(attempts >= OTP_MAX_ATTEMPTS ? { used: true } : {}) },
    });
    throw new BadRequestError('Invalid verification code');
  }

  await prisma.otpCode.update({ where: { id: otpRecord.id }, data: { used: true } });
};
