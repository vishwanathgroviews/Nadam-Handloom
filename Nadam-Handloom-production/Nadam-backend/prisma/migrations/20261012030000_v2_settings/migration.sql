-- Module 11 (Settings). Additive only: the old backend and the old website keep
-- reading the same AppConfig row and ignore these columns.
-- Shop details and the website address (6.5, 6.7); empty = the server settings.
ALTER TABLE "AppConfig" ADD COLUMN "shopName" TEXT;
ALTER TABLE "AppConfig" ADD COLUMN "shopAddress" TEXT;
ALTER TABLE "AppConfig" ADD COLUMN "shopMobile" TEXT;
ALTER TABLE "AppConfig" ADD COLUMN "shopGstin" TEXT;
ALTER TABLE "AppConfig" ADD COLUMN "websiteUrl" TEXT;
-- Who turned maintenance on, and since when (6.2).
ALTER TABLE "AppConfig" ADD COLUMN "maintenanceSince" TIMESTAMP(3);
ALTER TABLE "AppConfig" ADD COLUMN "maintenanceBy" TEXT;
ALTER TABLE "AppConfig" ADD COLUMN "webMaintenanceSince" TIMESTAMP(3);
ALTER TABLE "AppConfig" ADD COLUMN "webMaintenanceBy" TEXT;
-- "Last changed by" for each section.
ALTER TABLE "AppConfig" ADD COLUMN "maintenanceChangedAt" TIMESTAMP(3);
ALTER TABLE "AppConfig" ADD COLUMN "maintenanceChangedBy" TEXT;
ALTER TABLE "AppConfig" ADD COLUMN "updatesChangedAt" TIMESTAMP(3);
ALTER TABLE "AppConfig" ADD COLUMN "updatesChangedBy" TEXT;
ALTER TABLE "AppConfig" ADD COLUMN "shopChangedAt" TIMESTAMP(3);
ALTER TABLE "AppConfig" ADD COLUMN "shopChangedBy" TEXT;
-- The app version each phone last used ("2.0.0 (26)"), for the update warning (6.4).
ALTER TABLE "TrustedDevice" ADD COLUMN "appVersion" TEXT;
