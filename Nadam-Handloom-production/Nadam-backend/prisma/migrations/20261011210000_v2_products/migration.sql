-- Module 4 (Products and barcodes). Additive only: the old backend ignores these.
-- clientRef: the phone's own id for each new saree, so a repeated upload returns
-- the saree already made instead of a second copy. batchId: the batch it came in.
ALTER TABLE "Product" ADD COLUMN "clientRef" TEXT;
ALTER TABLE "Product" ADD COLUMN "batchId" TEXT;
CREATE UNIQUE INDEX "Product_clientRef_key" ON "Product"("clientRef");
CREATE INDEX "Product_batchId_idx" ON "Product"("batchId");
