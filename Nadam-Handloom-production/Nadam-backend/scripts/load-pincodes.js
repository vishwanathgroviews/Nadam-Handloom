// Website W1: loads India Post's pincode directory into the Pincode table, so the
// website can fill in city and state from a pincode. Safe to run again: new
// pincodes are added and changed ones updated; nothing is deleted unless --prune.
//   node scripts/load-pincodes.js                (shows what it would do)
//   node scripts/load-pincodes.js --yes          (writes)
//   node scripts/load-pincodes.js --yes --prune  (also deletes pincodes no longer in the file)
// Source: prisma/data/india-pincodes.csv (see prisma/data/README.md).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { prisma, disconnectDatabase } from '../src/config/database.js';
import { parsePincodeCsv } from '../src/utils/csv.js';

const write = process.argv.includes('--yes');
const prune = process.argv.includes('--prune');
const file = path.join(path.dirname(fileURLToPath(import.meta.url)), '../prisma/data/india-pincodes.csv');

const rows = parsePincodeCsv(fs.readFileSync(file, 'utf8'));
const before = await prisma.pincode.count();
console.log(`${rows.length} pincodes in the file; ${before} in the database now.`);
if (write) {
  const BATCH = 1000;
  for (let i = 0; i < rows.length; i += BATCH) {
    const part = rows.slice(i, i + BATCH);
    await prisma.$executeRaw`
      INSERT INTO "Pincode" ("pincode", "area", "city", "state", "updatedAt")
      SELECT * , now() FROM unnest(${part.map((r) => r.pincode)}::text[], ${part.map((r) => r.area)}::text[], ${part.map((r) => r.city)}::text[], ${part.map((r) => r.state)}::text[])
      ON CONFLICT ("pincode") DO UPDATE SET "area" = EXCLUDED."area", "city" = EXCLUDED."city", "state" = EXCLUDED."state", "updatedAt" = now()
      WHERE ("Pincode"."area", "Pincode"."city", "Pincode"."state") IS DISTINCT FROM (EXCLUDED."area", EXCLUDED."city", EXCLUDED."state")`;
  }
  if (prune) {
    const gone = await prisma.pincode.deleteMany({ where: { pincode: { notIn: rows.map((r) => r.pincode) } } });
    console.log(`Removed ${gone.count} pincodes that are no longer in the file.`);
  }
  console.log(`Done: ${await prisma.pincode.count()} pincodes in the database.`);
} else {
  console.log('Nothing written. Run again with --yes to load them.');
}
await disconnectDatabase();
