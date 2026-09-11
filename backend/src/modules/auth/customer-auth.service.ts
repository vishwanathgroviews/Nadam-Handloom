import { Request, Response } from 'express';
import { prisma } from '../../config/prisma';
import { AppError, BadRequestError, ConflictError, NotFoundError, UnauthorizedError } from '../../utils/errors';
import { smsProvider } from '../../providers/sms';
import { createOtp, resendOtp, verifyOtp, devOtpEcho } from './otp.service';
import { issueSession, SessionTokens } from './session.service';
import { logAuthEvent } from './auditLog.service';
import { generatePurposeToken, verifyPurposeToken } from './token.service';
import { setMpin, verifyMpin, resetMpin } from './mpin.service';

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

const toPublicUser = (account: { id: string; email: string | null; phone: string | null }) => ({
  id: account.id,
  email: account.email,
  phone: account.phone,
});

// Self-registration (unlike the staff/admin app, where an ADMIN provisions
// the account first) — phone + MPIN, no password. Re-registering the same
// phone while still `pending` (never completed OTP+MPIN) just resends the
// OTP against the existing row instead of erroring.
export const registerCustomer = async (
  data: { firstName: string; lastName: string; phone: string; state: string; pincode: string },
  req: Request
) => {
  const existing = await prisma.authAccount.findUnique({ where: { phone: data.phone } });

  if (existing && existing.status === 'active') {
    throw new ConflictError('Phone number already in use');
  }

  const preferences = { state: data.state, pincode: data.pincode };

  const account = existing
    ? await prisma.authAccount.update({
        where: { id: existing.id },
        data: {
          userProfile: {
            upsert: {
              create: { firstName: data.firstName, lastName: data.lastName, displayName: data.firstName, preferences },
              update: { firstName: data.firstName, lastName: data.lastName, displayName: data.firstName, preferences },
            },
          },
        },
      })
    : await prisma.$transaction(async (tx) => {
        const created = await tx.authAccount.create({
          data: {
            phone: data.phone,
            status: 'pending',
            userProfile: { create: { firstName: data.firstName, lastName: data.lastName, displayName: data.firstName, preferences } },
          },
        });
        const role = await tx.role.findUniqueOrThrow({ where: { name: 'CUSTOMER' } });
        await tx.userRole.create({ data: { authAccountId: created.id, roleId: role.id } });
        return created;
      });

  const { code } = await createOtp(account.id, 'signup_verify');
  await smsProvider.sendOtp(data.phone, code);
  await logAuthEvent({ authAccountId: account.id, eventType: 'customer_register', source: 'customer_web', req });

  return { phone: data.phone, ...devOtpEcho(code) };
};

export const verifyCustomerOtp = async (phone: string, code: string, req: Request) => {
  const account = await prisma.authAccount.findUnique({ where: { phone } });
  if (!account) throw new BadRequestError('Invalid or expired verification code');

  await verifyOtp(account.id, 'signup_verify', code);
  await prisma.authAccount.update({
    where: { id: account.id },
    data: { phoneVerifiedAt: new Date() },
  });
  await logAuthEvent({ authAccountId: account.id, eventType: 'customer_phone_verified', source: 'customer_web', req });

  return { setupToken: generatePurposeToken(account.id, 'mpin_setup') };
};

export const resendCustomerOtp = async (phone: string) => {
  const account = await prisma.authAccount.findUnique({ where: { phone } });
  if (!account || account.phoneVerifiedAt) return {};

  const { code } = await resendOtp(account.id, 'signup_verify');
  await smsProvider.sendOtp(phone, code);
  return devOtpEcho(code);
};

export const setupCustomerMpin = async (
  data: { setupToken: string; mpin: string; platform: 'web' | 'ios' | 'android'; deviceName?: string },
  req: Request,
  res: Response
): Promise<{ tokens: SessionTokens; user: ReturnType<typeof toPublicUser> }> => {
  const payload = verifyPurposeToken(data.setupToken, 'mpin_setup');
  const account = await prisma.authAccount.findUnique({ where: { id: payload.sub } });

  if (!account || !account.phoneVerifiedAt) {
    throw new BadRequestError('Phone number not verified yet');
  }
  if (account.status === 'active') {
    throw new ConflictError('Registration already completed, please log in');
  }

  await setMpin(account.id, data.mpin);
  await logAuthEvent({ authAccountId: account.id, eventType: 'customer_mpin_setup', source: 'customer_web', req });

  const tokens = await issueSession({
    authAccountId: account.id,
    securityStamp: account.securityStamp,
    req,
    res,
    platform: data.platform,
    deviceName: data.deviceName,
  });

  return { tokens, user: toPublicUser(account) };
};

export const loginCustomer = async (
  data: { phone: string; mpin: string; platform: 'web' | 'ios' | 'android'; deviceName?: string },
  req: Request,
  res: Response
): Promise<{ tokens: SessionTokens; user: ReturnType<typeof toPublicUser> }> => {
  const account = await prisma.authAccount.findUnique({ where: { phone: data.phone } });

  if (!account || account.deletedAt || account.status === 'deleted') {
    throw new UnauthorizedError('Invalid credentials');
  }

  if (!account.mpinHash) {
    throw new AppError(
      'Please verify your account. Check your phone for the verification code.',
      403,
      'ACCOUNT_NOT_VERIFIED',
      { phone: account.phone }
    );
  }

  if (account.lockedUntil && account.lockedUntil > new Date()) {
    throw new UnauthorizedError('Account temporarily locked due to multiple failed attempts. Try again later.');
  }

  const valid = await verifyMpin(account.mpinHash, data.mpin);
  if (!valid) {
    const failedLoginAttempts = account.failedLoginAttempts + 1;
    const lockedUntil = failedLoginAttempts >= MAX_FAILED_ATTEMPTS ? new Date(Date.now() + LOCKOUT_MS) : null;
    await prisma.authAccount.update({
      where: { id: account.id },
      data: { failedLoginAttempts, lockedUntil },
    });
    await logAuthEvent({ authAccountId: account.id, eventType: 'login_failed', source: 'customer_web', req });
    throw new UnauthorizedError('Incorrect MPIN. Please try again.');
  }

  await prisma.authAccount.update({
    where: { id: account.id },
    data: { failedLoginAttempts: 0, lockedUntil: null },
  });

  const tokens = await issueSession({
    authAccountId: account.id,
    securityStamp: account.securityStamp,
    req,
    res,
    platform: data.platform,
    deviceName: data.deviceName,
  });

  await logAuthEvent({ authAccountId: account.id, eventType: 'login_success', source: 'customer_web', req });

  return { tokens, user: toPublicUser(account) };
};

// Deliberately silent on an unknown phone number — unlike the internal
// staff app, this is a public-facing endpoint anyone can call, so it must
// not reveal whether a given number has an account.
export const requestCustomerMpinReset = async (phone: string) => {
  const account = await prisma.authAccount.findUnique({ where: { phone } });
  if (!account || !account.mpinHash) return {};

  const { code } = await createOtp(account.id, 'mpin_reset');
  await smsProvider.sendOtp(phone, code);
  return devOtpEcho(code);
};

export const confirmCustomerMpinReset = async (phone: string, code: string, newMpin: string, req: Request) => {
  const account = await prisma.authAccount.findUnique({ where: { phone } });
  if (!account) throw new NotFoundError('Invalid or expired verification code');

  await verifyOtp(account.id, 'mpin_reset', code);
  await resetMpin(account.id, newMpin);
  await logAuthEvent({ authAccountId: account.id, eventType: 'customer_mpin_reset', source: 'customer_web', req });
};
