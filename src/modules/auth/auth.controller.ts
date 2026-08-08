import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { prisma } from '../../config/prisma';
import { AuthService } from './auth.service';
import { createOtp, verifyOtp, resendOtp, OtpResendCooldownError } from './otpCode.service';
import { sendOtpEmail, sendInviteEmail, sendPasswordResetEmail } from './email.service';
import { hashRefreshToken } from './token.service';
import { issueSession, revokeAllSessionsForAccount } from './session.service';
import { generateMfaToken, verifyMfaToken } from './mfaToken.service';
import {
  generateResetToken,
  validateResetToken,
  consumeResetTokenAndSetPassword,
} from './passwordReset.service';
import { getRolesAndPermissions } from './permission.service';
import { logAuthEvent } from './auditLog.service';
import { AuthenticatedRequest } from '../../middleware/jwt.middleware';

const MAX_FAILED_LOGIN_ATTEMPTS = 5;
const ACCOUNT_LOCK_MS = 15 * 60 * 1000;

class AuthError extends Error {
  constructor(message = 'Invalid credentials') {
    super(message);
    this.name = 'AuthError';
  }
}

const respondWithSession = (
  res: Response,
  platform: string | undefined,
  session: { accessToken: string; refreshToken: string }
) => {
  const body: Record<string, unknown> = { accessToken: session.accessToken };
  if (platform && platform !== 'web') {
    body.refreshToken = session.refreshToken;
  }
  return res.status(200).json(body);
};

export class AuthController {
  static async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, phone, password, firstName, lastName } = req.body;

      const existingUser = await prisma.authAccount.findFirst({
        where: { OR: [{ email }, { phone }], deletedAt: null },
      });

      if (existingUser) {
        res.status(400).json({ error: 'Account with this email or phone already exists' });
        return;
      }

      const account = await AuthService.registerCustomer({ email, phone, password, firstName, lastName });

      const code = await createOtp(account.id, 'email_verify');
      await sendOtpEmail(email, code);

      res.status(201).json({
        message: 'Registration successful. Please verify your email with the OTP sent.',
        accountId: account.id,
      });
    } catch (error) {
      next(error);
    }
  }

  static async adminProvision(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, phone, firstName, lastName, roleId, employeeId, department, jobTitle } = req.body;

      const existingUser = await prisma.authAccount.findFirst({
        where: { OR: [{ email }, { phone }], deletedAt: null },
      });

      if (existingUser) {
        res.status(400).json({ error: 'Account already exists' });
        return;
      }

      // Never-transmitted throwaway password; the real credential is set via the invite's reset link.
      const throwawayPassword = crypto.randomBytes(32).toString('hex');
      const passwordHash = await AuthService.hashPassword(throwawayPassword);

      const account = await prisma.$transaction(async (tx) => {
        return await tx.authAccount.create({
          data: {
            email,
            phone,
            passwordHash,
            roles: { create: { roleId } },
            adminProfile: {
              create: { firstName, lastName, employeeId, department, jobTitle },
            },
          },
        });
      });

      if (email) {
        const resetToken = await generateResetToken(account.id);
        await sendInviteEmail(email, resetToken);
      } else {
        console.warn(`[adminProvision] Account ${account.id} has no email; invite link was not sent.`);
      }

      await logAuthEvent({
        accountId: account.id,
        eventType: 'user_provisioned',
        req,
        metadata: { roleId, employeeId },
      });

      res.status(201).json({ message: 'User provisioned successfully', accountId: account.id });
    } catch (error) {
      next(error);
    }
  }

  static async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, phone, password, platform, deviceName } = req.body;

      const account = await prisma.authAccount.findFirst({
        where: {
          OR: [...(email ? [{ email }] : []), ...(phone ? [{ phone }] : [])],
          deletedAt: null,
        },
      });

      if (!account) {
        await logAuthEvent({ accountId: null, eventType: 'login_failure', req, metadata: { reason: 'not_found' } });
        throw new AuthError();
      }

      if (account.status !== 'active') {
        await logAuthEvent({
          accountId: account.id,
          eventType: 'login_failure',
          req,
          metadata: { reason: `status_${account.status}` },
        });
        res.status(403).json({ error: 'Account is not active. Please contact support.' });
        return;
      }

      if (account.lockedUntil && account.lockedUntil > new Date()) {
        await logAuthEvent({ accountId: account.id, eventType: 'login_failure', req, metadata: { reason: 'locked' } });
        res.status(403).json({ error: 'Account locked due to multiple failed login attempts.' });
        return;
      }

      const isMatch = await AuthService.verifyPassword(password, account.passwordHash);

      if (!isMatch) {
        const attempts = account.failedLoginAttempts + 1;
        const lockedUntil = attempts >= MAX_FAILED_LOGIN_ATTEMPTS ? new Date(Date.now() + ACCOUNT_LOCK_MS) : null;

        await prisma.authAccount.update({
          where: { id: account.id },
          data: { failedLoginAttempts: attempts, lockedUntil },
        });

        await logAuthEvent({
          accountId: account.id,
          eventType: 'login_failure',
          req,
          metadata: { reason: 'bad_password' },
        });
        throw new AuthError();
      }

      await prisma.authAccount.update({
        where: { id: account.id },
        data: { failedLoginAttempts: 0, lockedUntil: null },
      });

      const { roles, permissions } = await getRolesAndPermissions(account.id);
      const mfaRequired = roles.includes('ADMIN') || roles.includes('STAFF') || account.mfaEnabled;

      if (mfaRequired) {
        const code = await createOtp(account.id, 'login_mfa');
        if (account.email) {
          await sendOtpEmail(account.email, code);
        } else {
          console.log(`[login_mfa] OTP for account ${account.id} (no email on file): ${code}`);
        }

        const mfaToken = generateMfaToken(account.id);
        await logAuthEvent({ accountId: account.id, eventType: 'login_mfa_challenge', req });

        res.status(200).json({ mfaRequired: true, mfaToken });
        return;
      }

      const session = await issueSession(account, roles, permissions, req, res, { platform, deviceName });
      await logAuthEvent({ accountId: account.id, eventType: 'login_success', req });

      respondWithSession(res, platform, session);
    } catch (error) {
      next(error);
    }
  }

  static async refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;
      if (!refreshToken) {
        res.status(401).json({ error: 'No refresh token provided' });
        return;
      }

      const tokenHash = hashRefreshToken(refreshToken);
      const session = await prisma.session.findUnique({
        where: { refreshTokenHash: tokenHash },
        include: { authAccount: true },
      });

      if (!session || session.authAccount.deletedAt || session.authAccount.status !== 'active') {
        res.status(401).json({ error: 'Invalid or expired refresh token' });
        return;
      }

      if (session.revokedAt) {
        // A previously-rotated refresh token was replayed: treat as compromise.
        await revokeAllSessionsForAccount(session.authAccountId);
        await prisma.session.updateMany({
          where: { authAccountId: session.authAccountId },
          data: { isCompromised: true },
        });
        await logAuthEvent({
          accountId: session.authAccountId,
          eventType: 'refresh_token_reuse_detected',
          req,
        });
        res.status(401).json({ error: 'Invalid or expired refresh token' });
        return;
      }

      if (session.isCompromised || session.expiresAt < new Date()) {
        res.status(401).json({ error: 'Invalid or expired refresh token' });
        return;
      }

      // Rotate: revoke the old session before issuing a new one.
      await prisma.session.update({
        where: { id: session.id },
        data: { revokedAt: new Date() },
      });

      const { roles, permissions } = await getRolesAndPermissions(session.authAccountId);
      const newSession = await issueSession(session.authAccount, roles, permissions, req, res, {
        platform: session.platform ?? undefined,
        deviceName: session.deviceName ?? undefined,
      });

      await logAuthEvent({ accountId: session.authAccountId, eventType: 'token_refresh', req });

      res.status(200).json({ accessToken: newSession.accessToken });
    } catch (error) {
      next(error);
    }
  }

  static async logout(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;
      if (refreshToken) {
        const tokenHash = hashRefreshToken(refreshToken);
        await prisma.session.updateMany({
          where: { refreshTokenHash: tokenHash },
          data: { revokedAt: new Date() },
        });
      }

      await logAuthEvent({ accountId: req.user?.id ?? null, eventType: 'logout', req });

      res.clearCookie('refreshToken');
      res.status(200).json({ message: 'Logged out successfully' });
    } catch (error) {
      next(error);
    }
  }

  static async otpVerify(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, mfaToken, code } = req.body;

      if (mfaToken) {
        let accountId: string;
        try {
          accountId = verifyMfaToken(mfaToken);
        } catch {
          res.status(400).json({ error: 'Invalid or expired OTP' });
          return;
        }

        const isValid = await verifyOtp(accountId, 'login_mfa', code);
        if (!isValid) {
          await logAuthEvent({ accountId, eventType: 'otp_verify_failed', req });
          res.status(400).json({ error: 'Invalid or expired OTP' });
          return;
        }

        const account = await prisma.authAccount.findUnique({ where: { id: accountId } });
        if (!account) {
          res.status(400).json({ error: 'Invalid or expired OTP' });
          return;
        }

        const { roles, permissions } = await getRolesAndPermissions(account.id);
        const session = await issueSession(account, roles, permissions, req, res, {});
        await logAuthEvent({ accountId: account.id, eventType: 'login_success', req });

        res.status(200).json({ accessToken: session.accessToken, refreshToken: session.refreshToken });
        return;
      }

      const account = await prisma.authAccount.findFirst({ where: { email, deletedAt: null } });
      if (!account) {
        res.status(400).json({ error: 'Invalid or expired OTP' });
        return;
      }

      const isValid = await verifyOtp(account.id, 'email_verify', code);
      if (!isValid) {
        await logAuthEvent({ accountId: account.id, eventType: 'otp_verify_failed', req });
        res.status(400).json({ error: 'Invalid or expired OTP' });
        return;
      }

      await prisma.authAccount.update({
        where: { id: account.id },
        data: { emailVerifiedAt: new Date() },
      });
      await logAuthEvent({ accountId: account.id, eventType: 'email_verified', req });

      res.status(200).json({ message: 'OTP verified successfully' });
    } catch (error) {
      next(error);
    }
  }

  static async otpResend(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, mfaToken } = req.body;

      let accountId: string;
      let purpose: string;
      let destinationEmail: string | null;

      if (mfaToken) {
        try {
          accountId = verifyMfaToken(mfaToken);
        } catch {
          res.status(400).json({ error: 'Invalid or expired session' });
          return;
        }
        purpose = 'login_mfa';
        const account = await prisma.authAccount.findUnique({ where: { id: accountId } });
        destinationEmail = account?.email ?? null;
      } else {
        const account = await prisma.authAccount.findFirst({ where: { email, deletedAt: null } });
        if (!account) {
          // Anti-enumeration: respond as if it succeeded.
          res.status(200).json({ message: 'If an account exists, a new OTP has been sent.' });
          return;
        }
        accountId = account.id;
        purpose = 'email_verify';
        destinationEmail = account.email;
      }

      const code = await resendOtp(accountId, purpose);
      if (destinationEmail) {
        await sendOtpEmail(destinationEmail, code);
      }

      await logAuthEvent({ accountId, eventType: 'otp_resend', req, metadata: { purpose } });

      res.status(200).json({ message: 'A new OTP has been sent.' });
    } catch (error) {
      if (error instanceof OtpResendCooldownError) {
        res.status(429).json({ error: error.message, retryAfterSeconds: error.retryAfterSeconds });
        return;
      }
      next(error);
    }
  }

  static async passwordResetRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, phone } = req.body;

      const account = await prisma.authAccount.findFirst({
        where: {
          OR: [...(email ? [{ email }] : []), ...(phone ? [{ phone }] : [])],
          deletedAt: null,
        },
      });

      if (account) {
        const resetToken = await generateResetToken(account.id);
        if (account.email) {
          await sendPasswordResetEmail(account.email, resetToken);
        }
      }

      // Anti-enumeration: always return the same generic response.
      await logAuthEvent({ accountId: account?.id ?? null, eventType: 'password_reset_requested', req });
      res.status(200).json({ message: 'If an account exists, password reset instructions have been sent.' });
    } catch (error) {
      next(error);
    }
  }

  static async passwordResetConfirm(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { token, newPassword } = req.body;

      const tokenRow = await validateResetToken(token);
      if (!tokenRow) {
        res.status(400).json({ error: 'Invalid or expired token' });
        return;
      }

      await consumeResetTokenAndSetPassword(tokenRow, newPassword);
      await logAuthEvent({ accountId: tokenRow.authAccountId, eventType: 'password_reset_completed', req });

      res.status(200).json({ message: 'Password has been reset successfully. Please log in again.' });
    } catch (error) {
      next(error);
    }
  }
}
