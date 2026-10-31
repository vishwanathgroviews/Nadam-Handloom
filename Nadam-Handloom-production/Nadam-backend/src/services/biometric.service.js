// Face ID / Touch ID / fingerprint (docs section 8.3).
// The phone keeps a private EC P-256 key in its security chip (Secure Enclave or
// Android Keystore), usable only after a biometric check. We store the public key
// and verify a signature over a one-time challenge.
import crypto from 'node:crypto';
import { AUTH } from '../config/constants.js';
import { env } from '../config/env.js';
import * as Device from '../models/trustedDevice.model.js';
import * as Challenge from '../models/authChallenge.model.js';
import * as Account from '../models/authAccount.model.js';
import { assertNotLocked } from './lock.service.js';
import { startSession } from './session.service.js';
import { confirmPin } from './me.service.js';
import { audit } from './audit.service.js';
import { randomToken } from '../utils/crypto.js';
import { badRequest, notFound, unauthorized } from '../utils/errors.js';

const PAYLOAD_PREFIX = 'nandam-biometric-v1';
export const challengePayload = ({ id, nonce }, deviceId) => `${PAYLOAD_PREFIX}:${id}:${nonce}:${deviceId}`;

// Accepts only an EC P-256 public key in SPKI (DER, base64) form.
export function parsePublicKey(publicKeyB64) {
  try {
    const key = crypto.createPublicKey({ key: Buffer.from(publicKeyB64, 'base64'), format: 'der', type: 'spki' });
    if (key.asymmetricKeyType !== 'ec' || key.asymmetricKeyDetails?.namedCurve !== 'prime256v1') throw new Error('not P-256');
    return key;
  } catch {
    throw badRequest('INVALID_PUBLIC_KEY', 'This phone sent a key we can\'t use. Turn Face ID off and on again.');
  }
}

export function verifySignature(publicKeyB64, payload, signatureB64) {
  try {
    const key = parsePublicKey(publicKeyB64);
    return crypto.verify('sha256', Buffer.from(payload, 'utf8'), { key, dsaEncoding: 'der' }, Buffer.from(signatureB64, 'base64'));
  } catch {
    return false;
  }
}

// Turning on Face ID / fingerprint: with the PIN (the app since 16 Oct 2026 asks for it), so a
// copied 15-minute key alone can't add someone else's Face ID. BIOMETRIC_NEEDS_PIN makes it
// required once every phone has that version.
export const rules = { needsPin: env.biometricNeedsPin }; // read at call time (tests change it)

export async function enable({ auth, deviceRowId, accountId, publicKey, pin, ctx }) {
  parsePublicKey(publicKey);
  if (pin !== undefined) await confirmPin({ auth, pin, ctx });
  else if (rules.needsPin) throw badRequest('PIN_NEEDED', 'Enter your PIN to turn on Face ID or fingerprint. If the app doesn\'t ask for it, update the app.');
  const device = await Device.setBiometricKey(deviceRowId, publicKey);
  await audit('biometric_enabled', { accountId, ctx, metadata: { device: device.name } });
  return { biometricEnabled: true };
}

export async function disable({ deviceRowId, accountId, ctx }) {
  const device = await Device.setBiometricKey(deviceRowId, null);
  await audit('biometric_disabled', { accountId, ctx, metadata: { device: device.name } });
  return { biometricEnabled: false };
}

const unavailableErr = () => notFound('BIOMETRIC_UNAVAILABLE', 'Face ID / fingerprint isn\'t set up for this phone. Sign in with your PIN.');

export async function createChallenge({ mobile, deviceId }) {
  const account = await Account.findAppAccountByMobile(mobile);
  if (!account || account.status !== 'active') throw unavailableErr();
  await assertNotLocked(mobile, account); // a locked account can't sign in any way
  const device = await Device.findActive(account.id, deviceId);
  if (!device?.biometricPublicKey) throw unavailableErr();
  const nonce = randomToken(32);
  const challenge = await Challenge.create({
    trustedDeviceId: device.id,
    nonce,
    expiresAt: new Date(Date.now() + AUTH.BIOMETRIC_CHALLENGE_SECONDS * 1000),
  });
  return { challengeId: challenge.id, payload: challengePayload(challenge, deviceId), expiresInSeconds: AUTH.BIOMETRIC_CHALLENGE_SECONDS };
}

export async function login({ challengeId, signature, device: deviceInfo, ctx }) {
  const invalid = () => unauthorized('BIOMETRIC_INVALID', 'Face ID / fingerprint sign-in didn\'t work. Sign in with your PIN.');
  const challenge = await Challenge.findWithDevice(challengeId);
  if (!challenge || challenge.usedAt || challenge.expiresAt <= new Date()) throw invalid();
  const device = challenge.trustedDevice;
  if (!device || device.revokedAt || !device.biometricPublicKey || device.deviceId !== deviceInfo.id) throw invalid();
  const ok = verifySignature(device.biometricPublicKey, challengePayload(challenge, device.deviceId), signature);
  if (!ok || !(await Challenge.consume(challenge.id))) {
    await audit('biometric_login_failed', { accountId: device.authAccountId, ctx });
    throw invalid();
  }
  const account = await Account.findById(device.authAccountId);
  if (!Account.hasAppAccess(account) || account.status !== 'active') throw invalid();
  await assertNotLocked(account.phone, account);
  const fresh = await Device.touch(device.id, { name: deviceInfo.name, platform: deviceInfo.platform });
  await audit('login_success', { accountId: account.id, ctx, metadata: { method: 'biometric' } });
  return startSession({ account, device: fresh, ctx });
}
