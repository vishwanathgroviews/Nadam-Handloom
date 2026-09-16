import { Request, Response } from 'express';
import { prisma } from '../../config/prisma';
import { AppError, BadRequestError, ConflictError, NotFoundError, UnauthorizedError } from '../../utils/errors';
import { smsProvider } from '../../providers/sms';
import { createOtp, verifyOtp, devOtpEcho } from './otp.service';
import { issueSession, SessionTokens } from './session.service';
import { logAuthEvent } from './auditLog.service';
import { generatePurposeToken, verifyPurposeToken } from './token.service';
import { setMpin, verifyMpin, resetMpin } from './mpin.service';
import { getRolesAndPermissions } from './permission.service';

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

const MOBILE_NOT_REGISTERED = 'Please use the registered mobile number';

// This app is for the shop's own people only. A customer who signed up on
// the storefront has an AuthAccount with a phone number just like a staff
// member does, so without this gate they could activate and sign in here and
// see the whole back office. Membership is decided purely by role — the only
// way to get one is an ADMIN invite (admin.service.ts -> provisionUser).
const STAFF_APP_ROLES = ['ADMIN', 'STAFF'];

const toPublicUser = async (account: { id: string; email: string | null; phone: string | null }) => {
  const { roles } = await getRolesAndPermissions(account.id);
  return { id: account.id, email: account.email, phone: account.phone, roles };
};

/**
 * True only for accounts an ADMIN has invited into the staff app.
 * Deliberately reports the same "not registered" outcome as an unknown
 * number rather than "you're a customer, not staff": telling an outsider
 * that their number exists but lacks access is an account-enumeration leak,
 * and there is nothing a customer could usefully do with the distinction.
 */
const hasStaffAppAccess = async (authAccountId: string): Promise<boolean> => {
  const staffRole = await prisma.userRole.findFirst({
    where: { authAccountId, role: { is: { name: { in: STAFF_APP_ROLES } } } },
    select: { roleId: true },
  });
  return staffRole !== null;
};

const findRegisteredAccount = async (mobile: string) => {
  const account = await prisma.authAccount.findUnique({ where: { phone: mobile } });
  if (!account || account.deletedAt || account.status === 'deleted') {
    throw new NotFoundError(MOBILE_NOT_REGISTERED);
  }
  if (!(await hasStaffAppAccess(account.id))) {
    throw new NotFoundError(MOBILE_NOT_REGISTERED);
  }
  return account;
};

// Staff/admin accounts are provisioned by an ADMIN (see admin.service.ts ->
// provisionUser), never self-registered. This just sends the first-login OTP
// for an account that's already pending activation.
export const requestAppActivation = async (data: { mobile: string }, req: Request) => {
  const account = await findRegisteredAccount(data.mobile);

  if (account.mpinHash) {
    throw new ConflictError('This account is already activated — please sign in with your MPIN.');
  }

  const { code } = await createOtp(account.id, 'signup_verify');
  await smsProvider.sendOtp(data.mobile, code);
  await logAuthEvent({ authAccountId: account.id, eventType: 'app_activation_requested', source: 'staff_app', req });

  return { mobile: data.mobile, ...devOtpEcho(code) };
};

export const verifyAppActivationOtp = async (mobile: string, code: string, req: Request) => {
  const account = await findRegisteredAccount(mobile);

  await verifyOtp(account.id, 'signup_verify', code);
  await prisma.authAccount.update({
    where: { id: account.id },
    data: { phoneVerifiedAt: new Date() },
  });
  await logAuthEvent({ authAccountId: account.id, eventType: 'app_phone_verified', source: 'staff_app', req });

  return { setupToken: generatePurposeToken(account.id, 'mpin_setup') };
};

export const setupAppMpin = async (
  data: { setupToken: string; mpin: string; platform: 'ios' | 'android'; deviceName?: string },
  req: Request,
  res: Response
): Promise<{ tokens: SessionTokens; user: Awaited<ReturnType<typeof toPublicUser>> }> => {
  const payload = verifyPurposeToken(data.setupToken, 'mpin_setup');
  const account = await prisma.authAccount.findUnique({ where: { id: payload.sub } });

  if (!account || !account.phoneVerifiedAt) {
    throw new BadRequestError('Phone number not verified yet');
  }
  if (!(await hasStaffAppAccess(account.id))) {
    throw new AppError('This account does not have access to the staff app.', 403, 'NOT_STAFF');
  }
  if (account.status === 'active') {
    throw new ConflictError('Registration already completed, please log in');
  }

  await setMpin(account.id, data.mpin);
  await logAuthEvent({ authAccountId: account.id, eventType: 'app_mpin_setup', source: 'staff_app', req });

  const tokens = await issueSession({
    authAccountId: account.id,
    securityStamp: account.securityStamp,
    req,
    res,
    platform: data.platform,
    deviceName: data.deviceName,
  });

  return { tokens, user: await toPublicUser(account) };
};

export const loginAppUser = async (
  data: { mobile: string; mpin: string; platform: 'ios' | 'android'; deviceName?: string },
  req: Request,
  res: Response
): Promise<{ tokens: SessionTokens; user: Awaited<ReturnType<typeof toPublicUser>> }> => {
  const account = await prisma.authAccount.findUnique({ where: { phone: data.mobile } });

  if (!account || account.deletedAt || account.status === 'deleted') {
    throw new NotFoundError(MOBILE_NOT_REGISTERED);
  }

  // Customers are refused here even with a correct MPIN — a storefront
  // account carries no staff role, and this app has no read-only mode.
  if (!(await hasStaffAppAccess(account.id))) {
    await logAuthEvent({ authAccountId: account.id, eventType: 'login_denied_not_staff', source: 'staff_app', req });
    throw new NotFoundError(MOBILE_NOT_REGISTERED);
  }

  if (!account.mpinHash) {
    throw new AppError(
      'Account not activated yet — verify the OTP sent to your mobile number first.',
      403,
      'ACCOUNT_NOT_ACTIVATED'
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
    await logAuthEvent({ authAccountId: account.id, eventType: 'login_failed', source: 'staff_app', req });
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

  await logAuthEvent({ authAccountId: account.id, eventType: 'login_success', source: 'staff_app', req });

  return { tokens, user: await toPublicUser(account) };
};

export const requestAppMpinReset = async (mobile: string) => {
  const account = await findRegisteredAccount(mobile);

  if (!account.mpinHash) {
    throw new AppError(
      'Account not activated yet — verify the OTP sent to your mobile number first.',
      403,
      'ACCOUNT_NOT_ACTIVATED'
    );
  }

  const { code } = await createOtp(account.id, 'mpin_reset');
  await smsProvider.sendOtp(mobile, code);

  return devOtpEcho(code);
};

export const confirmAppMpinReset = async (
  mobile: string,
  code: string,
  newMpin: string,
  req: Request
) => {
  const account = await findRegisteredAccount(mobile);

  await verifyOtp(account.id, 'mpin_reset', code);
  await resetMpin(account.id, newMpin);
  await logAuthEvent({ authAccountId: account.id, eventType: 'app_mpin_reset', source: 'staff_app', req });
};
