-- CreateTable
CREATE TABLE "AppConfig" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "maintenanceEnabled" BOOLEAN NOT NULL DEFAULT false,
    "maintenanceMessage" TEXT NOT NULL DEFAULT '',
    "webMaintenanceEnabled" BOOLEAN NOT NULL DEFAULT false,
    "webMaintenanceMessage" TEXT NOT NULL DEFAULT '',
    "androidLatestBuild" INTEGER NOT NULL DEFAULT 0,
    "androidMinBuild" INTEGER NOT NULL DEFAULT 0,
    "androidForceUpdate" BOOLEAN NOT NULL DEFAULT false,
    "androidUpdateUrl" TEXT NOT NULL DEFAULT '',
    "iosLatestBuild" INTEGER NOT NULL DEFAULT 0,
    "iosMinBuild" INTEGER NOT NULL DEFAULT 0,
    "iosForceUpdate" BOOLEAN NOT NULL DEFAULT false,
    "iosUpdateUrl" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "AppConfig_pkey" PRIMARY KEY ("id")
);
