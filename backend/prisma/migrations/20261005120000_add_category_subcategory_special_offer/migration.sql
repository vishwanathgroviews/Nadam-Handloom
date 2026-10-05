-- AlterTable
ALTER TABLE "Category" ADD COLUMN "isOfferActive" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Subcategory" ADD COLUMN "isOfferActive" BOOLEAN NOT NULL DEFAULT false;
