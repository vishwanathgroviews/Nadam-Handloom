// Adds one person to the team from the server, for the moment when no owner has the new
// app yet and so nobody can use Team → Invite (the first iPhone build, 2026-10-13).
// The result is the same as an invite from the app: the person opens the app, enters
// their mobile, gets an SMS code and chooses their own PIN. Run on the server:
//   node scripts/invite-member.js 98XXXXXXXX "Full Name" owner          show what it would do
//   node scripts/invite-member.js 98XXXXXXXX "Full Name" owner --yes    do it
// Only for a number with no account at all. Anyone else is invited from the app, which
// knows the rules for removed members and website customers.
import { prisma, disconnectDatabase } from '../src/config/database.js';
import { normalizeMobile } from '../src/utils/phone.js';
import * as Team from '../src/models/team.model.js';
import { splitName } from '../src/services/team.service.js';
import { audit } from '../src/services/audit.service.js';

const [mobileArg, nameArg, roleArg] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const confirm = process.argv.includes('--yes');
const mobile = normalizeMobile(mobileArg);
const name = (nameArg ?? '').trim();
const roleName = { owner: 'ADMIN', staff: 'STAFF' }[roleArg];
if (!mobile || !name || !roleName) {
  console.error('Usage: node scripts/invite-member.js <10-digit mobile> "<name>" <owner|staff> [--yes]');
  process.exit(1);
}

const existing = await Team.findMemberByMobile(mobile);
if (existing) {
  console.error(`That number already has an account (${existing.status}). Invite them from the app (Team → Invite). Nothing changed.`);
  await disconnectDatabase();
  process.exit(1);
}
const { firstName, lastName } = splitName(name);
console.log(`Will invite: ${name} (${mobile}) as ${roleArg === 'owner' ? 'Owner' : 'Staff'}`);
if (!confirm) {
  console.log('Dry run. Add --yes to make the change.');
} else {
  const id = await prisma.$transaction(async (tx) => {
    await Team.lockTeam(tx);
    const created = await tx.authAccount.create({
      data: { phone: mobile, status: 'pending', adminProfile: { create: { firstName, lastName, invitedAt: new Date() } } },
    });
    await Team.setAppRole(created.id, roleName, tx);
    return created.id;
  });
  await audit('admin_provisioned_user', { accountId: id, ctx: {}, metadata: { role: roleName, by: 'invite-member script' } });
  console.log('Done. They sign in with their mobile number, get an SMS code and choose a PIN.');
}
await disconnectDatabase();
