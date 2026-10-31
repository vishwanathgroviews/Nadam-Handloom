// TEST server only (2026-10-12): re-makes every invoice PDF from the test copy's blanked
// customer details, so no PDF shows a real customer. New files go under the test folder
// (S3_KEY_PREFIX); the live PDFs they replace are kept (the test server never deletes them).
// Refuses unless the database name contains "v2_test" and a test folder is set.
import { env } from '../src/config/env.js';
import { prisma, disconnectDatabase } from '../src/config/database.js';
import { remakePdf } from '../src/services/invoice.service.js';

const dbName = new URL(env.DATABASE_URL).pathname.replace(/^\//, '');
if (!/v2_test/.test(dbName) || !env.S3_KEY_PREFIX) {
  console.error('Refusing: only for the test database with a test folder (S3_KEY_PREFIX).');
  process.exit(1);
}
const invoices = await prisma.invoice.findMany({ select: { orderId: true, invoiceNumber: true }, orderBy: { generatedAt: 'asc' } });
let done = 0;
for (const inv of invoices) {
  try {
    await remakePdf(inv.orderId);
    done += 1;
  } catch (e) {
    console.error(`${inv.invoiceNumber}: ${e.message}`);
  }
}
console.log(`re-made ${done} of ${invoices.length} invoice PDFs under ${env.S3_KEY_PREFIX}/`);
await disconnectDatabase();
