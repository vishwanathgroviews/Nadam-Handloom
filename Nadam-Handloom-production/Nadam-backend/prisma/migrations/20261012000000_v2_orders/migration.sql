-- Module 7 (Orders and shipping). Additive only: the old backend ignores these.
-- deliveredAt / deliveredById: "Mark delivered" (decision 6.8); shippedById: who shipped.
-- A tracking number (AWB) can be on one order only (decision 6.5): the new server checks
-- that itself, under a lock. There is NO database rule for it: the old app, which keeps
-- running beside the new one, lets staff reuse a number (13 orders shipped with one number
-- on 2026-10-13), and a database rule would fail on that data and start refusing the old app.
ALTER TABLE "Shipment" ADD COLUMN "shippedById" TEXT;
ALTER TABLE "Shipment" ADD COLUMN "deliveredAt" TIMESTAMP(3);
ALTER TABLE "Shipment" ADD COLUMN "deliveredById" TEXT;
