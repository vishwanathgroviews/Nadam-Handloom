// Gives every saree its subcategory's name, once, at switch-over (Module 4, decision 6.2).
// The old app copied the name once, so some listings show an old name on the website.
//   node scripts/fix-product-names.js          show how many would change, with examples
//   node scripts/fix-product-names.js --csv names.csv   also write the full list, for the owner to check
//   node scripts/fix-product-names.js --yes    do it
// Check the list first: a different name can also mean the saree sits in the wrong
// subcategory (then move it in the app instead; its price comes from the subcategory).
// Web addresses (slugs) and SKUs don't change. Deleted sarees are left as they were.
import fs from 'node:fs';
import { prisma, disconnectDatabase } from '../src/config/database.js';
import { audit } from '../src/services/audit.service.js';

const confirm = process.argv.includes('--yes');
const csvAt = process.argv.indexOf('--csv');
const stale = await prisma.$queryRaw`
  SELECT p.id, p.sku, p.name AS old, s.name AS new FROM "Product" p JOIN "Subcategory" s ON s.id = p."subcategoryId"
  WHERE p."deletedAt" IS NULL AND p.name <> s.name ORDER BY p.sku`;
console.log(`${stale.length} sarees show a name that isn't their subcategory's.`);
for (const r of stale.slice(0, 8)) console.log(`  ${r.sku}: "${r.old}" → "${r.new}"`);
if (csvAt > 0 && process.argv[csvAt + 1]) {
  const q = (v) => `"${String(v).replace(/"/g, '""')}"`;
  fs.writeFileSync(process.argv[csvAt + 1], ['SKU,Name now,Subcategory (new name)', ...stale.map((r) => [r.sku, r.old, r.new].map(q).join(','))].join('\n'));
  console.log(`Full list written to ${process.argv[csvAt + 1]}`);
}
if (!confirm) {
  console.log('Dry run. Add --yes to make the change.');
} else {
  const n = await prisma.$executeRaw`
    UPDATE "Product" p SET name = s.name, "updatedAt" = now() FROM "Subcategory" s
    WHERE s.id = p."subcategoryId" AND p."deletedAt" IS NULL AND p.name <> s.name`;
  await audit('product_names_synced', { metadata: { count: n, script: 'fix-product-names' } });
  console.log(`Done: ${n} names now match their subcategory.`);
}
await disconnectDatabase();
