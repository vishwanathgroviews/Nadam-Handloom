// Trusted devices: trusting a phone after the SMS check, listing, signing out.
import { prisma } from '../config/database.js';
import { REVOKE } from '../config/constants.js';
import * as Device from '../models/trustedDevice.model.js';
import * as Session from '../models/session.model.js';
import { presentDevice } from '../utils/present.js';
import { audit } from './audit.service.js';
import { badRequest, notFound } from '../utils/errors.js';

export async function trustDevice(account, deviceInfo, ctx) {
  const before = await Device.findActive(account.id, deviceInfo.id);
  const device = await Device.trust(account.id, deviceInfo);
  if (!before) await audit('device_trusted', { accountId: account.id, ctx, metadata: { device: device.name } });
  return device;
}

export async function listDevices(accountId, currentDeviceRowId) {
  const devices = await Device.listActive(accountId);
  return devices.map((d) => presentDevice(d, d.id === currentDeviceRowId)).sort((a, b) => Number(b.isCurrent) - Number(a.isCurrent));
}

// Signs one device out: its sessions end and it must pass the SMS check again.
export async function signOutDevice({ accountId, deviceRowId, currentDeviceRowId, ctx }) {
  if (deviceRowId === currentDeviceRowId) throw badRequest('CANNOT_SIGN_OUT_THIS_DEVICE', 'Use Log out to sign out this device.');
  const device = await Device.findById(deviceRowId);
  if (!device || device.authAccountId !== accountId || device.revokedAt) throw notFound('DEVICE_NOT_FOUND', 'That device is no longer signed in.');
  await prisma.$transaction(async (tx) => {
    await Device.revoke(device.id, tx);
    await Session.revokeWhere({ trustedDeviceId: device.id }, REVOKE.DEVICE_SIGNED_OUT, {}, tx);
  });
  await audit('device_signed_out', { accountId, ctx, metadata: { device: device.name } });
  return { signedOut: presentDevice(device) };
}

// Signs out every device except the current one, including sign-ins from the old app.
export async function signOutOtherDevices({ accountId, currentSessionId, currentDeviceRowId, reason = REVOKE.OTHERS_SIGNED_OUT, ctx, tx: outer }) {
  const run = async (tx) => {
    const others = (await Device.listActive(accountId, tx)).filter((d) => d.id !== currentDeviceRowId);
    for (const d of others) await Device.revoke(d.id, tx);
    const sessionsEnded = await Session.revokeWhere({ authAccountId: accountId, NOT: currentSessionId ? { id: currentSessionId } : undefined }, reason, {}, tx);
    return { devicesSignedOut: others.length, sessionsEnded };
  };
  const result = outer ? await run(outer) : await prisma.$transaction(run);
  if (!outer) await audit('devices_signed_out_others', { accountId, ctx, metadata: result });
  return result;
}
