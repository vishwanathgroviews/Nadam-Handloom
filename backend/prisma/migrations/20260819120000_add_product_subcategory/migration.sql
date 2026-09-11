-- AlterTable
ALTER TABLE "Product" ADD COLUMN "subCategory" TEXT;

-- CreateIndex
CREATE INDEX "Product_categoryId_subCategory_idx" ON "Product"("categoryId", "subCategory");
