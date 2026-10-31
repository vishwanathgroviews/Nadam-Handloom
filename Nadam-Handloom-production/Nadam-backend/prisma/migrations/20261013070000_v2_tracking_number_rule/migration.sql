-- Module 7 (decision 6.5), corrected 2026-10-13 before the live database was touched.
-- The first version of v2_orders made the tracking number unique in the database. The live
-- data turned out to have one number on 13 orders (shipped from the old app), and the old
-- app must keep working beside the new one. The new server keeps the rule itself (a lock,
-- then a check), so the database rule goes. Nothing to do where it was never made.
DROP INDEX IF EXISTS "Shipment_awbNumber_key";
