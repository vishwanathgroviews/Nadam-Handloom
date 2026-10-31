-- CreateTable
CREATE TABLE "CategoryCatalogPdf" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "productCount" INTEGER NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "generatedBy" TEXT NOT NULL,

    CONSTRAINT "CategoryCatalogPdf_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CategoryCatalogPdf_categoryId_key" ON "CategoryCatalogPdf"("categoryId");

-- AddForeignKey
ALTER TABLE "CategoryCatalogPdf" ADD CONSTRAINT "CategoryCatalogPdf_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;
