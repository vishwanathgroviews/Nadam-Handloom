-- Category-level pricing: price/description move from Product to Category.
-- Every product under a category sells at that category's price.

-- AlterTable: add new Category pricing columns (nullable first, backfilled below)
ALTER TABLE "Category" ADD COLUMN "onlinePrice" DECIMAL(10,2);
ALTER TABLE "Category" ADD COLUMN "storePrice" DECIMAL(10,2);
ALTER TABLE "Category" ADD COLUMN "mrp" DECIMAL(10,2);

-- Backfill from existing product prices in that category (seed/demo data —
-- real prices are re-entered via the admin app's category screen afterwards).
UPDATE "Category" c
SET
  "onlinePrice" = COALESCE((SELECT MIN(p."price") FROM "Product" p WHERE p."categoryId" = c.id), 0),
  "storePrice"  = COALESCE((SELECT MIN(p."price") FROM "Product" p WHERE p."categoryId" = c.id), 0);

ALTER TABLE "Category" ALTER COLUMN "onlinePrice" SET NOT NULL;
ALTER TABLE "Category" ALTER COLUMN "storePrice" SET NOT NULL;

-- description was optional; it's now the single source of product description
UPDATE "Category" SET "description" = '' WHERE "description" IS NULL;
ALTER TABLE "Category" ALTER COLUMN "description" SET NOT NULL;

-- AlterTable: Product loses its own price/mrp/description (category-sourced now)
ALTER TABLE "Product" DROP COLUMN "description";
ALTER TABLE "Product" DROP COLUMN "mrp";
ALTER TABLE "Product" DROP COLUMN "price";

-- AlterTable: Product gains channel visibility + stock tracking mode
ALTER TABLE "Product" ADD COLUMN "channelVisibility" TEXT NOT NULL DEFAULT 'both';
ALTER TABLE "Product" ADD COLUMN "trackingMode" TEXT NOT NULL DEFAULT 'quantity';
