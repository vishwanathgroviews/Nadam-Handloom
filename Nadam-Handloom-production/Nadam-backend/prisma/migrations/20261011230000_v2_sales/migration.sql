-- Module 5 (Scan to sell). Additive only: the old backend ignores these.
-- clientRef: the phone's own id for each bill, so a repeated "Complete sale" returns
-- the sale already made. paymentMethod: cash, upi or card (decision 6.1).
-- cancelled*: who cancelled a sale, when and why (decision 6.2). Invoice.cancelledAt:
-- a cancelled sale's invoice is marked, never deleted, so its number is never reused.
ALTER TABLE "Order" ADD COLUMN "clientRef" TEXT;
ALTER TABLE "Order" ADD COLUMN "paymentMethod" TEXT;
ALTER TABLE "Order" ADD COLUMN "cancelledAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN "cancelledById" TEXT;
ALTER TABLE "Order" ADD COLUMN "cancelReason" TEXT;
CREATE UNIQUE INDEX "Order_clientRef_key" ON "Order"("clientRef");
ALTER TABLE "Invoice" ADD COLUMN "cancelledAt" TIMESTAMP(3);
