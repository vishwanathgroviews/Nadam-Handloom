// Sets the main owner once, at switch-over (Module 2). Run on the server:
//   node scripts/set-main-owner.js 98XXXXXXXX          show who it would be
//   node scripts/set-main-owner.js 98XXXXXXXX --yes    do it
// The number must belong to an owner who can sign in. Any other main owner is cleared.
import { prisma, disconnectDatabase } from '../src/config/database.js';
import { normalizeMobile } from '../src/utils/phone.js';
import { appRoleOf, displayNameOf } from '../src/models/authAccount.model.js';
import * as Team from '../src/models/team.model.js';
import { audit } from '../src/services/audit.service.js';

const mobile = normalizeMobile(process.argv[2]);
const confirm = process.argv.includes('--yes');
if (!mobile) {
  console.error('Give the owner\'s 10-digit mobile number.');
  process.exit(1);
}

const account = await Team.findMemberByMobile(mobile);
if (!account || appRoleOf(account) !== 'ADMIN' || account.deletedAt || account.status !== 'active' || !account.mpinHash) {
  console.error('That number is not an owner who can sign in. Nothing changed.');
  await disconnectDatabase();
  process.exit(1);
}
const current = await prisma.adminProfile.findFirst({ where: { isMainOwner: true }, include: { authAccount: { include: { adminProfile: true, userProfile: true } } } });
console.log(`Main owner now: ${current ? `${displayNameOf(current.authAccount)} (${current.authAccount.phone})` : 'nobody'}`);
console.log(`Will become:    ${displayNameOf(account)} (${account.phone})`);
if (!confirm) {
  console.log('Dry run. Add --yes to make the change.');
} else {
  await prisma.$transaction(async (tx) => {
    await Team.lockTeam(tx);
    await Team.clearMainOwner(tx);
    await Team.upsertProfile(account.id, { isMainOwner: true }, tx);
  });
  await audit('admin_main_owner_changed', { accountId: account.id, ctx: {}, metadata: { by: 'set-main-owner script', from: current?.authAccountId ?? null } });
  console.log('Done.');
}
await disconnectDatabase();
