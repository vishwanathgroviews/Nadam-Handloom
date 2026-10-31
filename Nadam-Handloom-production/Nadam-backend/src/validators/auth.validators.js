// Request shapes for every sign-in endpoint. Messages are plain English for the app.
import { z } from 'zod';
import { normalizeMobile } from '../utils/phone.js';

export const mobile = z
  .string({ error: 'Enter your mobile number.' })
  .transform((v) => normalizeMobile(v))
  .refine((v) => v !== null, 'Enter a 10-digit mobile number starting with 6, 7, 8 or 9.');

export const deviceId = z.string().min(8).max(100).regex(/^[A-Za-z0-9._:-]+$/, 'Invalid device id.');

export const device = z.object({
  id: deviceId,
  name: z.string().trim().min(1).max(80),
  platform: z.enum(['ios', 'android']),
});

const loginPin = z.string().regex(/^(\d{4}|\d{6})$/, 'Enter your PIN.');
const newPin = z.string().regex(/^\d{6}$/, 'The PIN must be exactly 6 digits.');
const code = z.string().regex(/^\d{4,8}$/, 'Enter the code from the SMS.');
const stepToken = z.string().min(20).max(2000);

export const requestCodeBody = z.object({ mobile });
export const verifyCodeBody = z.object({ mobile, code, deviceId });
export const setPinBody = z.object({ stepToken, pin: newPin, device });
export const loginBody = z.object({ mobile, pin: loginPin, device });
export const deviceCodeRequestBody = z.object({ stepToken });
export const deviceCodeVerifyBody = z.object({ stepToken, code, device });
export const refreshBody = z.object({ refreshToken: z.string().min(20).max(200) });
export const logoutBody = refreshBody;
export const biometricChallengeBody = z.object({ mobile, deviceId });
export const biometricLoginBody = z.object({
  challengeId: z.uuid(),
  signature: z.string().min(40).max(300),
  device,
});

export const verifyPinBody = z.object({ pin: loginPin });
export const changePinBody = z.object({ changeToken: stepToken, newPin, signOutOthers: z.boolean().default(false) });
export const enableBiometricBody = z.object({ publicKey: z.string().min(80).max(400), pin: loginPin.optional() });
export const deviceRowParams = z.object({ id: z.uuid() });
