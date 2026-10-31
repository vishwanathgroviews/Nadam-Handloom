-- Website W5 (16 Oct 2026): a signed-in customer's bag, one row per saree. Additive only: a new
-- table, its two links and two indexes; no existing table or column changes.
CREATE TABLE "BagItem" (
    "id" TEXT NOT NULL,
    "authAccountId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "priceSeen" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BagItem_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "BagItem_quantity_check" CHECK ("quantity" BETWEEN 1 AND 50),
    CONSTRAINT "BagItem_priceSeen_check" CHECK ("priceSeen" >= 0)
);

CREATE UNIQUE INDEX "BagItem_authAccountId_productId_key" ON "BagItem"("authAccountId", "productId");
CREATE INDEX "BagItem_updatedAt_idx" ON "BagItem"("updatedAt");

ALTER TABLE "BagItem" ADD CONSTRAINT "BagItem_authAccountId_fkey" FOREIGN KEY ("authAccountId") REFERENCES "AuthAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BagItem" ADD CONSTRAINT "BagItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
