-- Barcode rework: every physical unit is now individually barcoded by an
-- external device before it's received into the app (see Piece model).
-- Label Studio (in-app barcode generation/printing) is removed entirely.

-- Rename, not drop+add: preserves existing Piece.serialCode values as barcode.
ALTER TABLE "Piece" RENAME COLUMN "serialCode" TO "barcode";

-- Only ever tracked Label Studio print counts — no longer meaningful.
ALTER TABLE "Piece" DROP COLUMN "printedCount";

-- Drop child table before parent (FK: PrintJob.templateId -> LabelTemplate.id).
DROP TABLE "PrintJob";
DROP TABLE "LabelTemplate";

-- Subcategory images (own S3 folder, admin-uploadable) — mirrors Category.
ALTER TABLE "Subcategory" ADD COLUMN "imageUrl" TEXT;
ALTER TABLE "Subcategory" ADD COLUMN "storageKey" TEXT;
