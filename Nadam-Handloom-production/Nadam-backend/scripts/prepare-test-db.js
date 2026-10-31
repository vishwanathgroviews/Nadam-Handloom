// Prepares the TEST copy of the live data for the team's test server (2026-10-12).
// Refuses to run unless the database name contains "v2_test", so it can never touch live.
//   - Customers' details blanked: names, mobiles, emails, addresses, invoice customers,
//     IP addresses; mobiles inside activity records masked.
//   - Sign-ins, codes, push tokens and throttles from the live copy removed.
//   - Two shared test logins: Owner (test) and Staff (test); the owner is the main owner.
//   - App settings: maintenance off, the test app's build as the newest Android version.
// Run: DATABASE_URL=<test db> node scripts/prepare-test-db.js <android build of the test app>
import { env } from '../src/config/env.js';
import { prisma, disconnectDatabase } from '../src/config/database.js';
import { hashPin } from '../src/services/pin.service.js';

const dbName = new URL(env.DATABASE_URL).pathname.replace(/^\//, '');
if (!/v2_test/.test(dbName)) {
  console.error(`Refusing: the database "${dbName}" is not a test database (its name must contain v2_test).`);
  process.exit(1);
}
const build = Number(process.argv[2]);
if (!Number.isInteger(build) || build < 1) {
  console.error('Usage: node scripts/prepare-test-db.js <android build number of the test app>');
  process.exit(1);
}
const LOGINS = [
  { phone: '9000000001', first: 'Owner', role: 'ADMIN', pin: '246810', main: true },
  { phone: '9000000002', first: 'Staff', role: 'STAFF', pin: '135792' },
];
const run = (sql) => prisma.$executeRawUnsafe(sql);

// Customers = accounts with no team profile and no Owner/Staff role (former staff keep their names).
await run(`CREATE TEMP TABLE cust AS
  SELECT a.id, row_number() OVER (ORDER BY a."createdAt", a.id) AS n
  FROM "AuthAccount" a
  WHERE NOT EXISTS (SELECT 1 FROM "AdminProfile" p WHERE p."authAccountId" = a.id)
    AND NOT EXISTS (SELECT 1 FROM "UserRole" ur JOIN "Role" r ON r.id = ur."roleId" WHERE ur."authAccountId" = a.id AND r.name IN ('ADMIN', 'STAFF'))`);
const fake = (n) => `'00000' || lpad((${n})::text, 5, '0')`; // not a real Indian mobile
const counts = {};
counts.customers = await run(`UPDATE "AuthAccount" a SET phone = ${fake('c.n')}, email = NULL FROM cust c WHERE c.id = a.id`);
counts.profiles = await run(`UPDATE "UserProfile" u SET "firstName" = 'Customer', "lastName" = c.n::text, "displayName" = NULL, "avatarUrl" = NULL FROM cust c WHERE c.id = u."authAccountId"`);
counts.addresses = await run(`UPDATE "Address" ad SET "fullName" = 'Customer ' || c.n, phone = ${fake('c.n')}, line1 = 'Test address', line2 = NULL FROM cust c WHERE c.id = ad."authAccountId"`);
// A team member's saved address (e.g. from shopping on the website) is blanked too.
counts.teamAddresses = await run(`UPDATE "Address" SET "fullName" = 'Team member', phone = '0000099999', line1 = 'Test address', line2 = NULL WHERE phone ~ '[6-9][0-9]{9}'`);
// Each order's own copy of the address (online and WhatsApp orders).
await run(`CREATE TEMP TABLE ord AS SELECT o.id, c.n AS cn, row_number() OVER (ORDER BY o."placedAt", o.id) AS k FROM "Order" o LEFT JOIN cust c ON c.id = o."authAccountId"`);
counts.orders = await run(`UPDATE "Order" o SET "shippingAddress" = o."shippingAddress"
    || jsonb_build_object('fullName', CASE WHEN x.cn IS NOT NULL THEN 'Customer ' || x.cn ELSE 'Walk-in customer ' || x.k END,
                          'phone', CASE WHEN x.cn IS NOT NULL THEN ${fake('x.cn')} ELSE '00009' || lpad(x.k::text, 5, '0') END,
                          'line1', 'Test address', 'line2', NULL)
  FROM ord x WHERE x.id = o.id AND o."shippingAddress" ? 'fullName'`);
counts.invoices = await run(`UPDATE "Invoice" i SET
    "customerName" = CASE WHEN i."customerName" IS NULL THEN NULL ELSE COALESCE('Customer ' || x.cn, 'Walk-in customer ' || x.k) END,
    "customerMobile" = CASE WHEN i."customerMobile" IS NULL THEN NULL ELSE COALESCE(${fake('x.cn')}, '00009' || lpad(x.k::text, 5, '0')) END
  FROM ord x WHERE x.id = i."orderId"`);
// Activity: no IP addresses or phone details; corrected invoice customers removed; any mobile masked.
counts.activity = await run(`UPDATE "AuthEvent" SET "ipAddress" = NULL, "userAgent" = NULL,
    metadata = CASE WHEN "eventType" = 'invoice_customer_corrected'
      THEN (metadata - 'from' - 'to') || jsonb_build_object('summary', coalesce(metadata->>'invoiceNumber', 'Invoice') || ': customer corrected')
      ELSE regexp_replace(metadata::text, '(?<![0-9])[6-9][0-9]{9}(?![0-9])', '0000000000', 'g')::jsonb END
  WHERE metadata IS NOT NULL OR "ipAddress" IS NOT NULL OR "userAgent" IS NOT NULL`);
// Nothing from the live phones carries over: sign-ins, codes, push tokens, throttles, old events.
for (const t of ['Session', 'OtpCode', 'DeviceToken', 'PasswordResetToken', 'ApiToken', 'RateLimitHit', 'AuthChallenge', 'LoginThrottle', 'EventsOutbox']) {
  counts[t] = await run(`DELETE FROM "${t}"`);
}

// The shared test logins.
const roles = Object.fromEntries((await prisma.role.findMany()).map((r) => [r.name, r.id]));
await prisma.adminProfile.updateMany({ where: { isMainOwner: true }, data: { isMainOwner: false } });
for (const p of LOGINS) {
  const mpinHash = await hashPin(p.pin);
  const now = new Date();
  const account = await prisma.authAccount.upsert({
    where: { phone: p.phone },
    create: { phone: p.phone, status: 'active', mpinHash, mpinSetAt: now, phoneVerifiedAt: now },
    update: { status: 'active', mpinHash, mpinSetAt: now, failedLoginAttempts: 0, lockCount: 0, lockedUntil: null, deletedAt: null, securityStamp: crypto.randomUUID() },
  });
  await prisma.userRole.deleteMany({ where: { authAccountId: account.id } });
  await prisma.userRole.create({ data: { authAccountId: account.id, roleId: roles[p.role] } });
  await prisma.adminProfile.upsert({
    where: { authAccountId: account.id },
    create: { authAccountId: account.id, firstName: p.first, lastName: '(test)', isMainOwner: !!p.main },
    update: { firstName: p.first, lastName: '(test)', isMainOwner: !!p.main, invitedAt: null, invitedById: null, removedAt: null, removedById: null },
  });
  await prisma.trustedDevice.deleteMany({ where: { authAccountId: account.id } });
  console.log(`login: +91 ${p.phone} ${p.first} (test), ${p.role === 'ADMIN' ? 'Owner' : 'Staff'}, PIN ${p.pin}`);
}

// App settings for the test app.
await prisma.appConfig.upsert({
  where: { id: 'default' },
  create: { id: 'default', androidLatestBuild: build, androidMinBuild: 0, androidForceUpdate: false, maintenanceEnabled: false, webMaintenanceEnabled: false },
  update: { androidLatestBuild: build, androidMinBuild: 0, androidForceUpdate: false, maintenanceEnabled: false, maintenanceMessage: '', webMaintenanceEnabled: false, webMaintenanceMessage: '' },
});
console.log('changed rows:', JSON.stringify(counts));
await disconnectDatabase();
