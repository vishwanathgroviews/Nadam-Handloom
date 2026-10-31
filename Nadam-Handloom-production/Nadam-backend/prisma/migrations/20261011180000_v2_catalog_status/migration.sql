-- Module 3 (Categories and subcategories). Additive for the old backend:
-- "delete" sets status = 'inactive' and nothing is ever erased.

-- AlterTable
ALTER TABLE "Category" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'active';
ALTER TABLE "Subcategory" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'active';

-- A deleted (inactive) subcategory's name can be used again, so the old
-- "same name in a category" rule now applies to active ones only, ignoring
-- capital letters and extra spaces. The old backend never looks rows up by it.
DROP INDEX IF EXISTS "Subcategory_categoryId_name_key";
CREATE UNIQUE INDEX "Subcategory_active_name_key" ON "Subcategory" ("categoryId", lower(regexp_replace(btrim("name"), '\s+', ' ', 'g'))) WHERE "status" = 'active';

-- Category names: unique among active categories, the same way (new rule).
CREATE UNIQUE INDEX "Category_active_name_key" ON "Category" (lower(regexp_replace(btrim("name"), '\s+', ' ', 'g'))) WHERE "status" = 'active';

-- Lists filter on status first.
CREATE INDEX "Category_status_sortOrder_idx" ON "Category" ("status", "sortOrder");
CREATE INDEX "Subcategory_categoryId_status_sortOrder_idx" ON "Subcategory" ("categoryId", "status", "sortOrder");
