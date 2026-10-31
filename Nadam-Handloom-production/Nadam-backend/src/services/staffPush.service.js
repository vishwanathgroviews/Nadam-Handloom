// The admin app's notifications on this phone: the phone sends its token after sign-in;
// owners choose whether this phone gets a notification for each online payment.
import * as StaffPush from '../models/staffPush.model.js';
import { can, PERMISSION } from '../config/permissions.js';
import { alertFor, sendTo } from './ownerAlerts.service.js';
import { iosPushReady } from './push/index.js';
import { conflict } from '../utils/errors.js';

const present = (row, role, platform) => ({
  registered: !!row,
  payments: !!row?.payments && can(role, PERMISSION.PAYMENTS_VIEW),
  canGetPayments: can(role, PERMISSION.PAYMENTS_VIEW),
  // iPhones need the shop's Apple push key on the server (set once).
  ready: (row?.platform || platform) === 'ios' ? iosPushReady() : true,
});

export async function status({ device, role }) {
  return { push: present(await StaffPush.forDevice(device.id), role, device.platform) };
}

export async function register({ device, accountId, role, token, platform, payments }) {
  const owner = can(role, PERMISSION.PAYMENTS_VIEW);
  const had = await StaffPush.forDevice(device.id);
  const row = await StaffPush.save({ trustedDeviceId: device.id, authAccountId: accountId, token, platform, payments: owner && (payments ?? had?.payments ?? true) });
  return { push: present(row, role) };
}

export async function setPayments({ device, role, payments }) {
  if (!can(role, PERMISSION.PAYMENTS_VIEW)) throw conflict('OWNERS_ONLY', 'Payment notifications are for owners.');
  const done = await StaffPush.setPayments(device.id, payments);
  if (!done.count) throw conflict('NOT_REGISTERED', 'Turn on notifications for this app in the phone\'s settings first.');
  return status({ device, role });
}

export async function remove({ device, role }) {
  await StaffPush.removeForDevice(device.id);
  return { push: present(null, role, device.platform) };
}

// "Send a test notification" to this phone.
export async function test({ device, role }) {
  const row = await StaffPush.forDevice(device.id);
  if (!row) throw conflict('NOT_REGISTERED', 'Turn on notifications for this app in the phone\'s settings first.');
  const r = await sendTo([row], alertFor.test());
  if (!r.sent) throw conflict('NOT_SENT', row.platform === 'ios' && !iosPushReady() ? 'iPhone notifications aren\'t set up on the server yet.' : 'The notification couldn\'t be sent. Try again in a minute.');
  return { sent: true, ...(await status({ device, role })) };
}
