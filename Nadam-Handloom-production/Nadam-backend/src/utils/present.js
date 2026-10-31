// The shapes the API sends to the app for a person and a device.
import { appRoleOf, displayNameOf } from '../models/authAccount.model.js';
import { permissionsFor } from '../config/permissions.js';
import { maskMobile } from './phone.js';

export const presentUser = (account) => {
  const role = appRoleOf(account);
  return {
    id: account.id,
    name: displayNameOf(account),
    role: role === 'ADMIN' ? 'owner' : 'staff',
    isMainOwner: !!account.adminProfile?.isMainOwner,
    permissions: permissionsFor(role),
    mobile: account.phone,
    mobileMasked: maskMobile(account.phone),
  };
};

export const presentDevice = (device, isCurrent = false) => ({
  id: device.id,
  deviceId: device.deviceId,
  name: device.name,
  platform: device.platform,
  biometricEnabled: !!device.biometricPublicKey,
  trustedAt: device.trustedAt.toISOString(),
  lastSeenAt: device.lastSeenAt.toISOString(),
  isCurrent,
});
