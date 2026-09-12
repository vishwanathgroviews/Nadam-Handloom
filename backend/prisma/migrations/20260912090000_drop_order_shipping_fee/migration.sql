-- Nandam Handlooms never charges a shipping fee. The application stopped
-- reading or writing this column some time ago (an order's total is exactly
-- the sum of its line items), leaving it as a vestigial NOT NULL DEFAULT 0
-- that new code had to keep ignoring. This drops it for good.
--
-- Any non-zero value still stored here is a historical breakdown line only:
-- Order.total already includes it, so removing the column changes no order's
-- total and no invoice's arithmetic.
ALTER TABLE "Order" DROP COLUMN IF EXISTS "shippingFee";
