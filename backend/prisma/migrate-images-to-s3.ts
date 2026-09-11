// One-off migration: rewrite Category/Product image URLs that still point at
// the old local /images/... paths (served from customer-web's public/ folder)
// to the real S3 objects uploaded under site/... (same filenames, mirrored
// layout — see the `aws s3 sync` migration this pairs with). Safe to re-run:
// only rows still pointing at a local path are touched.
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const S3_BASE = `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.S3_REGION}.amazonaws.com`;

const toS3 = (localUrl: string) => {
  const key = `site${localUrl.replace(/^\/images/, '')}`; // "/images/products/x.jpg" -> "site/products/x.jpg"
  return { url: `${S3_BASE}/${key}`, key };
};

async function main() {
  const categories = await prisma.category.findMany({ where: { imageUrl: { startsWith: '/images/' } } });
  for (const category of categories) {
    const { url, key } = toS3(category.imageUrl);
    await prisma.category.update({ where: { id: category.id }, data: { imageUrl: url, storageKey: key } });
    console.log(`category ${category.slug}: ${category.imageUrl} -> ${url}`);
  }

  const images = await prisma.productImage.findMany({ where: { url: { startsWith: '/images/' } } });
  for (const image of images) {
    const { url, key } = toS3(image.url);
    await prisma.productImage.update({ where: { id: image.id }, data: { url, storageKey: key } });
    console.log(`productImage ${image.id}: ${image.url} -> ${url}`);
  }

  console.log(`Migrated ${categories.length} categories and ${images.length} product images to S3.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
