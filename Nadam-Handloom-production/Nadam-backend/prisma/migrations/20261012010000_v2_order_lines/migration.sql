-- Module 5 fix: a bill's lines keep the order they were scanned in (invoice, sale page).
-- Empty for lines made by the old app. Additive only: the old backend ignores it.
ALTER TABLE "OrderItem" ADD COLUMN "lineNo" INTEGER;
