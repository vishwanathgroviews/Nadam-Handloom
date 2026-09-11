-- CreateTable
CREATE TABLE "LabelTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isPreset" BOOLEAN NOT NULL DEFAULT false,
    "pageWidthMm" DECIMAL(6,2) NOT NULL DEFAULT 210,
    "pageHeightMm" DECIMAL(6,2) NOT NULL DEFAULT 297,
    "rows" INTEGER NOT NULL,
    "cols" INTEGER NOT NULL,
    "labelWidthMm" DECIMAL(6,2) NOT NULL,
    "labelHeightMm" DECIMAL(6,2) NOT NULL,
    "marginTopMm" DECIMAL(6,2) NOT NULL,
    "marginLeftMm" DECIMAL(6,2) NOT NULL,
    "gutterXMm" DECIMAL(6,2) NOT NULL,
    "gutterYMm" DECIMAL(6,2) NOT NULL,
    "showName" BOOLEAN NOT NULL DEFAULT true,
    "showSku" BOOLEAN NOT NULL DEFAULT true,
    "priceMode" TEXT NOT NULL DEFAULT 'none',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LabelTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrintJob" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "items" JSONB NOT NULL,
    "pdfKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PrintJob_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "PrintJob" ADD CONSTRAINT "PrintJob_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "LabelTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
