/*
  Warnings:

  - You are about to drop the column `lastSyncedAt` on the `Shipment` table. All the data in the column will be lost.
  - You are about to drop the column `trackingEvents` on the `Shipment` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Shipment" DROP COLUMN "lastSyncedAt",
DROP COLUMN "trackingEvents";
