-- DropForeignKey
ALTER TABLE "Product" DROP CONSTRAINT "Product_subcategoryId_fkey";

-- AlterTable
ALTER TABLE "Category" DROP COLUMN "mrp",
DROP COLUMN "onlinePrice",
DROP COLUMN "storePrice";

-- AlterTable
ALTER TABLE "Product" DROP COLUMN "subCategory",
ALTER COLUMN "subcategoryId" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_subcategoryId_fkey" FOREIGN KEY ("subcategoryId") REFERENCES "Subcategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
