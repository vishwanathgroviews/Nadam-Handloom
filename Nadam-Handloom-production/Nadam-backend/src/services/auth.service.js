// The sign-in journeys (docs section 4): first-time setup, Forgot PIN, daily
// sign-in, the new-phone check and the one-time 4-digit PIN upgrade.
import crypto from 'node:crypto';
import { prisma } from '../config/database.js';
import { AUTH, CODE_PURPOSE, STEP, REVOKE } from '../config/constants.js';
import * as Account from '../models/authAccount.model.js';
import * as Device from '../models/trustedDevice.model.js';
import * as Session from '../models/session.model.js';
import * as lock from './lock.service.js';
import * as codes from './code.service.js';
import { hashPin, verifyPin, spendCheckTime } from './pin.service.js';
import { signStep, verifyStep } from './token.service.js';
import { startSession } from './session.service.js';
import { trustDevice } from './device.service.js';
import { audit } from './audit.service.js';
import { pinProblems, PIN_PROBLEM_TEXT } from '../utils/pin.js';
import { maskMobile } from '../utils/phone.js';
import { badRequest, unauthorized } from '../utils/errors.js';

const stepExpired = () => badRequest('STEP_EXPIRED', 'This step timed out. Please start again.');
export const pinVersion = (account) => (account.mpinSetAt ? account.mpinSetAt.toISOString() : 'none');

export function stepFor(purpose, account, deviceId, extra = {}, minutes) {
  return signStep(purpose, { sub: account.id, dev: deviceId, stamp: account.securityStamp, pinv: pinVersion(account), ...extra }, minutes);
}

// A step token is good only for the same account state it was issued for:
// any PIN change or security-stamp change in between makes it stale.
async function loadStep(stepToken, purposes, deviceId) {
  const p = verifyStep(stepToken, purposes);
  const account = await Account.findById(p.sub);
  if (!account || !Account.hasAppAccess(account)) throw stepExpired();
  if (account.securityStamp !== p.stamp || pinVersion(account) !== p.pinv) throw stepExpired();
  if (deviceId && p.dev !== deviceId) throw stepExpired();
  return { p, account };
}

export function assertNewPin(pin, account) {
  const problems = pinProblems(pin, account.phone);
  if (problems.length) throw badRequest('WEAK_PIN', PIN_PROBLEM_TEXT[problems[0]], { problems });
}

const canSetUp = (a) => (a && (a.status === 'pending' || a.status === 'active') ? a : null);
const canReset = (a) => (a && a.status === 'active' && a.mpinHash ? a : null);

/* ---------- First-time setup ---------- */
export async function requestSetupCode({ mobile, ctx }) {
  const account = canSetUp(await Account.findAppAccountByMobile(mobile));
  const reply = await codes.requestCode({ mobile, purpose: CODE_PURPOSE.SETUP, account });
  if (account) await audit('app_activation_requested', { accountId: account.id, ctx });
  return reply;
}

export async function verifySetupCode({ mobile, code, deviceId, ctx }) {
  const account = canSetUp(await Account.findAppAccountByMobile(mobile));
  await codes.verifyCode({ mobile, purpose: CODE_PURPOSE.SETUP, account, code });
  const fresh = await Account.findById(account.id);
  await audit('app_phone_verified', { accountId: fresh.id, ctx });
  if (fresh.status === 'active' && fresh.mpinHash) {
    // Revealed only now, after the code proved this person holds the phone.
    return { next: 'already_set_up', stepToken: stepFor(STEP.SET_PIN_RESET, fresh, deviceId), mobileMasked: maskMobile(fresh.phone) };
  }
  return { next: 'set_pin', stepToken: stepFor(STEP.SET_PIN_SETUP, fresh, deviceId) };
}

/* ---------- Forgot PIN ---------- */
export async function requestResetCode({ mobile, ctx }) {
  const account = canReset(await Account.findAppAccountByMobile(mobile));
  const reply = await codes.requestCode({ mobile, purpose: CODE_PURPOSE.RESET, account });
  if (account) await audit('mpin_reset_requested', { accountId: account.id, ctx });
  return reply;
}

export async function verifyResetCode({ mobile, code, deviceId, ctx }) {
  const account = canReset(await Account.findAppAccountByMobile(mobile));
  await codes.verifyCode({ mobile, purpose: CODE_PURPOSE.RESET, account, code });
  const fresh = await Account.findById(account.id);
  await audit('app_phone_verified', { accountId: fresh.id, ctx, metadata: { purpose: 'reset' } });
  return { next: 'set_pin', stepToken: stepFor(STEP.SET_PIN_RESET, fresh, deviceId) };
}

/* ---------- Set a PIN (setup, reset or 4-digit upgrade) ---------- */
export async function setPin({ stepToken, pin, device, ctx }) {
  const { p, account } = await loadStep(stepToken, [STEP.SET_PIN_SETUP, STEP.SET_PIN_RESET, STEP.UPGRADE_PIN], device.id);
  assertNewPin(pin, account);
  const mpinHash = await hashPin(pin);

  if (p.purpose === STEP.SET_PIN_SETUP) {
    if (account.status === 'active' && account.mpinHash) throw stepExpired();
    await Account.setPin(account.id, { mpinHash, activate: true, rotateStamp: true, newStamp: crypto.randomUUID() });
    const fresh = await Account.findById(account.id);
    const trusted = await trustDevice(fresh, device, ctx);
    await audit('app_mpin_setup', { accountId: fresh.id, ctx });
    return startSession({ account: fresh, device: trusted, ctx });
  }

  if (p.purpose === STEP.SET_PIN_RESET) {
    // A forgotten PIN may mean someone else knows it: every other device is
    // signed out and must pass the SMS check again, and all Face ID keys go.
    let othersSignedOut = 0;
    await prisma.$transaction(async (tx) => {
      await Account.setPin(account.id, { mpinHash, rotateStamp: true, newStamp: crypto.randomUUID() }, tx);
      for (const d of await Device.listActive(account.id, tx)) {
        if (d.deviceId !== device.id) {
          await Device.revoke(d.id, tx);
          othersSignedOut += 1;
        }
      }
      await Session.revokeWhere({ authAccountId: account.id }, REVOKE.PIN_RESET, {}, tx);
      await Device.clearBiometricForAccount(account.id, tx);
    });
    const fresh = await Account.findById(account.id);
    const trusted = await Device.trust(fresh.id, device); // the SMS code was verified on this phone
    await audit('app_mpin_reset', { accountId: fresh.id, ctx, metadata: { othersSignedOut } });
    return { ...(await startSession({ account: fresh, device: trusted, ctx })), othersSignedOut };
  }

  // 4-digit PIN upgrade: other devices stay signed in.
  const trusted = await Device.findActive(account.id, device.id);
  if (!trusted) throw stepExpired();
  await Account.setPin(account.id, { mpinHash });
  const fresh = await Account.findById(account.id);
  await audit('pin_upgraded', { accountId: fresh.id, ctx });
  return startSession({ account: fresh, device: trusted, ctx });
}

/* ---------- Daily sign-in ---------- */
export async function login({ mobile, pin, device, ctx }) {
  const account = await Account.findAppAccountByMobile(mobile);
  const taken = await lock.takeTry(mobile, account); // counted before the PIN is checked

  const usable = account && account.status === 'active' && account.mpinHash;
  let ok = false;
  if (usable) ok = await verifyPin(account.mpinHash, pin);
  else await spendCheckTime(pin);

  if (!ok) {
    const r = await lock.failedTry(mobile, account, taken);
    await audit(r.lockError ? 'login_locked' : 'login_failed', {
      accountId: account?.id ?? null, ctx, metadata: account ? {} : { mobileMasked: maskMobile(mobile) },
    });
    if (r.lockError) throw r.lockError;
    throw unauthorized('INVALID_CREDENTIALS', 'That mobile number and PIN don\'t match.', { triesLeft: r.triesLeft, nextLockMinutes: r.nextLockMinutes });
  }

  await lock.recordSuccess(account);
  const fresh = await Account.findById(account.id);
  const legacy = pin.length === AUTH.LEGACY_PIN_LENGTH;
  const trusted = await Device.findActive(fresh.id, device.id);
  if (!trusted) {
    return { status: 'verify_device', stepToken: stepFor(STEP.DEVICE_CHECK, fresh, device.id, { legacy }), mobileMasked: maskMobile(fresh.phone) };
  }
  if (legacy) return { status: 'upgrade_pin', stepToken: stepFor(STEP.UPGRADE_PIN, fresh, device.id) };
  await audit('login_success', { accountId: fresh.id, ctx, metadata: { method: 'pin' } });
  const touched = await Device.touch(trusted.id, { name: device.name, platform: device.platform });
  return startSession({ account: fresh, device: touched, ctx });
}

/* ---------- New-phone check ---------- */
export async function requestDeviceCode({ stepToken, ctx }) {
  const { account } = await loadStep(stepToken, [STEP.DEVICE_CHECK]);
  const reply = await codes.requestCode({ mobile: account.phone, purpose: CODE_PURPOSE.DEVICE, account });
  await audit('device_check_code_sent', { accountId: account.id, ctx });
  return { ...reply, mobileMasked: maskMobile(account.phone) };
}

export async function verifyDeviceCode({ stepToken, code, device, ctx }) {
  const { p, account } = await loadStep(stepToken, [STEP.DEVICE_CHECK], device.id);
  await codes.verifyCode({ mobile: account.phone, purpose: CODE_PURPOSE.DEVICE, account, code });
  const fresh = await Account.findById(account.id);
  const trusted = await trustDevice(fresh, device, ctx);
  if (p.legacy) return { status: 'upgrade_pin', stepToken: stepFor(STEP.UPGRADE_PIN, fresh, device.id) };
  await audit('login_success', { accountId: fresh.id, ctx, metadata: { method: 'pin+sms' } });
  return startSession({ account: fresh, device: trusted, ctx });
}
