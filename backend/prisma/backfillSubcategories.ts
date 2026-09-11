// One-time backfill: creates the real Subcategory rows (from Categories.md,
// via subcategorySeedData.ts) under each existing category, each inheriting
// that category's current price/description as a starting point, then
// points every existing Product at the right subcategory. Safe to re-run —
// it skips categories that already have subcategories and products that
// already have a subcategoryId.
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { SUBCATEGORIES_BY_CATEGORY_SLUG } from './subcategorySeedData';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const categories = await prisma.category.findMany();

  for (const category of categories) {
    const names = SUBCATEGORIES_BY_CATEGORY_SLUG[category.slug];
    if (!names) {
      console.log(`No canonical subcategory list for "${category.slug}", skipping.`);
      continue;
    }

    const existingCount = await prisma.subcategory.count({ where: { categoryId: category.id } });
    if (existingCount > 0) {
      console.log(`"${category.name}" already has ${existingCount} subcategories, skipping creation.`);
      continue;
    }

    for (let i = 0; i < names.length; i++) {
      await prisma.subcategory.create({
        data: {
          categoryId: category.id,
          name: names[i]!,
          description: category.description,
          onlinePrice: category.onlinePrice,
          storePrice: category.storePrice,
          mrp: category.mrp,
          sortOrder: i,
        },
      });
    }
    console.log(`Created ${names.length} subcategories under "${category.name}".`);
  }

  // Link existing products to a real subcategory.
  const products = await prisma.product.findMany({ where: { subcategoryId: null } });
  let matched = 0;
  let placeholder = 0;

  for (const product of products) {
    let subcategory = null;
    if (product.subCategory) {
      subcategory = await prisma.subcategory.findFirst({
        where: { categoryId: product.categoryId, name: product.subCategory },
      });
    }

    if (!subcategory) {
      // No tagged subCategory (e.g. the seeded Pattu Saree products, which
      // only used attribute filters) — fall back to that category's first
      // subcategory as an explicit placeholder. Flagged in the log below;
      // the admin should reassign these to the correct one via the app.
      subcategory = await prisma.subcategory.findFirst({
        where: { categoryId: product.categoryId },
        orderBy: { sortOrder: 'asc' },
      });
      if (subcategory) placeholder++;
    } else {
      matched++;
    }

    if (!subcategory) {
      console.warn(`No subcategory available at all for product "${product.name}" (category has none) — left unassigned.`);
      continue;
    }

    await prisma.product.update({ where: { id: product.id }, data: { subcategoryId: subcategory.id } });
  }

  console.log(`Linked ${matched} product(s) by matching subCategory name, ${placeholder} placeholder-assigned (please reassign via the app).`);

  const stillUnassigned = await prisma.product.count({ where: { subcategoryId: null } });
  if (stillUnassigned > 0) {
    console.warn(`${stillUnassigned} product(s) still have no subcategory — their category has zero subcategories.`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
