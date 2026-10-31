-- Module 10 (decision 6.3): each sale line keeps the store price it was sold against,
-- so bargains no longer depend on the activity log. Empty for online lines and for
-- old lines until scripts/copy-store-prices.js fills them. Additive only.
ALTER TABLE "OrderItem" ADD COLUMN "storePrice" DECIMAL(10,2);

-- The Activity screen filters by date, and by kind and date.
CREATE INDEX IF NOT EXISTS "AuthEvent_createdAt_idx" ON "AuthEvent"("createdAt");
CREATE INDEX IF NOT EXISTS "AuthEvent_eventType_createdAt_idx" ON "AuthEvent"("eventType", "createdAt");
