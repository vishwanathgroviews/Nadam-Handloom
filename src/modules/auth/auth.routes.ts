import { Router, Request, Response, NextFunction } from 'express';
import { ZodType } from 'zod';
import { AuthController } from './auth.controller';
import {
  registerSchema,
  loginSchema,
  otpVerifySchema,
  otpResendSchema,
  passwordResetRequestSchema,
  passwordResetConfirmSchema,
} from './auth.schema';
import { rateLimiter } from '../../middleware/rateLimiter';
import { authenticateJWT } from '../../middleware/jwt.middleware';

const router = Router();

// Zod validation middleware
const validate = (schema: ZodType) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      next();
    } catch (error) {
      res.status(400).json(error);
    }
  };
};

/**
 * @openapi
 * /auth/register:
 *   post:
 *     summary: Customer self sign-up
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password, firstName, lastName]
 *             properties:
 *               email: { type: string, format: email }
 *               phone: { type: string }
 *               password: { type: string, description: "8+ chars, upper, lower, number, special" }
 *               firstName: { type: string }
 *               lastName: { type: string }
 *     responses:
 *       201: { description: Registered, OTP email sent }
 *       400: { description: Validation error or account already exists }
 */
router.post('/register', validate(registerSchema), AuthController.register);

/**
 * @openapi
 * /auth/login:
 *   post:
 *     summary: Universal login (email or phone). Returns tokens directly, or an mfaToken if MFA is required.
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [password]
 *             properties:
 *               email: { type: string, format: email }
 *               phone: { type: string }
 *               password: { type: string }
 *               platform: { type: string, example: web }
 *               deviceName: { type: string }
 *     responses:
 *       200:
 *         description: Either { accessToken } (refresh cookie set), or { mfaRequired: true, mfaToken } when MFA is required
 *       401: { description: Invalid credentials }
 *       403: { description: Account locked or inactive }
 *       429: { description: Rate limited }
 */
router.post('/login', rateLimiter, validate(loginSchema), AuthController.login);

/**
 * @openapi
 * /auth/refresh:
 *   post:
 *     summary: Rotate a refresh token (from cookie or body) for a new access token
 *     tags: [Auth]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               refreshToken: { type: string }
 *     responses:
 *       200: { description: New access token issued, refresh cookie rotated }
 *       401: { description: Invalid, expired, or reused refresh token }
 */
router.post('/refresh', AuthController.refresh);

/**
 * @openapi
 * /auth/otp/verify:
 *   post:
 *     summary: Verify a 6-digit OTP. Provide `email` for registration verification, or `mfaToken` for login MFA.
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [code]
 *             properties:
 *               email: { type: string, format: email }
 *               mfaToken: { type: string }
 *               code: { type: string, minLength: 6, maxLength: 6 }
 *     responses:
 *       200: { description: OTP verified (tokens issued for the MFA-login case) }
 *       400: { description: Invalid or expired OTP }
 *       429: { description: Rate limited }
 */
router.post('/otp/verify', rateLimiter, validate(otpVerifySchema), AuthController.otpVerify);

/**
 * @openapi
 * /auth/otp/resend:
 *   post:
 *     summary: Resend an OTP, subject to a resend cooldown
 *     tags: [Auth]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email: { type: string, format: email }
 *               mfaToken: { type: string }
 *     responses:
 *       200: { description: OTP resent }
 *       429: { description: Resend cooldown not yet elapsed, or rate limited }
 */
router.post('/otp/resend', rateLimiter, validate(otpResendSchema), AuthController.otpResend);

/**
 * @openapi
 * /auth/password-reset/request:
 *   post:
 *     summary: Request a password reset token by email or phone (always returns a generic 200)
 *     tags: [Auth]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email: { type: string, format: email }
 *               phone: { type: string }
 *     responses:
 *       200: { description: Generic confirmation, regardless of whether the account exists }
 *       429: { description: Rate limited }
 */
router.post(
  '/password-reset/request',
  rateLimiter,
  validate(passwordResetRequestSchema),
  AuthController.passwordResetRequest
);

/**
 * @openapi
 * /auth/password-reset/confirm:
 *   post:
 *     summary: Confirm a password reset with the emailed token; invalidates all existing sessions
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token, newPassword]
 *             properties:
 *               token: { type: string }
 *               newPassword: { type: string }
 *     responses:
 *       200: { description: Password reset }
 *       400: { description: Invalid or expired token }
 *       429: { description: Rate limited }
 */
router.post(
  '/password-reset/confirm',
  rateLimiter,
  validate(passwordResetConfirmSchema),
  AuthController.passwordResetConfirm
);

/**
 * @openapi
 * /auth/logout:
 *   post:
 *     summary: Revoke the current session and clear the refresh cookie
 *     tags: [Auth]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Logged out }
 *       401: { description: Unauthorized }
 */
router.post('/logout', authenticateJWT, AuthController.logout);

export const authRoutes = router;
