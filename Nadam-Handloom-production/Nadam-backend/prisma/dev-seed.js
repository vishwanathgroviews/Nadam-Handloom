// Adds the sample test accounts to a LOCAL database copy (never the live one).
// Re-running resets them to a clean state: no locks, no sessions, no trusted devices.
//   90000 00001  Lakshmi (test)  Owner  PIN 246810
//   90000 00002  Ravi (test)     Staff  old 4-digit PIN 1357
//   90000 00003  Suresh (test)   Staff  invited, not set up yet
//   90000 00004  Kiran (test)    access removed (no Owner/Staff role)
//   90000 00005  Priya (test)    Owner  PIN 135790   (Module 2: a second owner)
//   90000 00006  Anil (test)     Staff  PIN 802461   (Module 2)
// Lakshmi is the main owner.
import { env } from '../src/config/env.js';
import { prisma, disconnectDatabase } from '../src/config/database.js';
import { hashPin } from '../src/services/pin.service.js';

if (!/@(localhost|127\.0\.0\.1)[:/]/.test(env.DATABASE_URL)) {
  console.error('Refusing to seed: DATABASE_URL is not a local database.');
  process.exit(1);
}

const people = [
  { phone: '9000000001', first: 'Lakshmi', role: 'ADMIN', status: 'active', pin: '246810' },
  { phone: '9000000002', first: 'Ravi', role: 'STAFF', status: 'active', pin: '1357' },
  { phone: '9000000003', first: 'Suresh', role: 'STAFF', status: 'pending', pin: null },
  { phone: '9000000004', first: 'Kiran', role: 'CUSTOMER', status: 'pending', pin: null, removed: true },
  { phone: '9000000005', first: 'Priya', role: 'ADMIN', status: 'active', pin: '135790' },
  { phone: '9000000006', first: 'Anil', role: 'STAFF', status: 'active', pin: '802461' },
];
let lakshmi = null; // set when Lakshmi is created below (first in the list)
await prisma.adminProfile.updateMany({ where: { isMainOwner: true }, data: { isMainOwner: false } });

const roles = Object.fromEntries((await prisma.role.findMany()).map((r) => [r.name, r.id]));

for (const p of people) {
  const mpinHash = p.pin ? await hashPin(p.pin) : null;
  const account = await prisma.authAccount.upsert({
    where: { phone: p.phone },
    create: { phone: p.phone, status: p.status, mpinHash, mpinSetAt: mpinHash ? new Date() : null, phoneVerifiedAt: mpinHash ? new Date() : null },
    update: { status: p.status, mpinHash, mpinSetAt: mpinHash ? new Date() : null, failedLoginAttempts: 0, lockCount: 0, lockedUntil: null, deletedAt: null, securityStamp: crypto.randomUUID() },
  });
  await prisma.userRole.deleteMany({ where: { authAccountId: account.id } });
  await prisma.userRole.create({ data: { authAccountId: account.id, roleId: roles[p.role] } });
  await prisma.adminProfile.upsert({
    where: { authAccountId: account.id },
    create: { authAccountId: account.id, firstName: p.first, lastName: '(test)' },
    update: { firstName: p.first, lastName: '(test)', isMainOwner: false, invitedAt: null, invitedById: null, removedAt: null, removedById: null },
  });
  if (p.first === 'Lakshmi') lakshmi = account;
  if (p.first === 'Lakshmi') await prisma.adminProfile.update({ where: { authAccountId: account.id }, data: { isMainOwner: true } });
  if (p.status === 'pending' && !p.removed && lakshmi) await prisma.adminProfile.update({ where: { authAccountId: account.id }, data: { invitedAt: new Date(), invitedById: lakshmi.id } });
  if (p.removed && lakshmi) await prisma.adminProfile.update({ where: { authAccountId: account.id }, data: { removedAt: new Date(), removedById: lakshmi.id } });
  await prisma.deviceToken.deleteMany({ where: { authAccountId: account.id } });
  await prisma.session.deleteMany({ where: { authAccountId: account.id } });
  await prisma.trustedDevice.deleteMany({ where: { authAccountId: account.id } });
  await prisma.otpCode.deleteMany({ where: { authAccountId: account.id } });
  await prisma.rateLimitHit.deleteMany({ where: { bucketKey: { contains: p.phone } } });
  console.log(`ready: ${p.phone} ${p.first} (${p.role}, ${p.status}${p.pin ? `, PIN ${p.pin}` : ''})`);
}
await disconnectDatabase();
