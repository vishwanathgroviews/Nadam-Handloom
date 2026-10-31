-- Module 2 (Roles and team). Additive only: the old backend ignores these columns.
-- The main owner is NOT chosen here. It is set once at switch-over with
-- scripts/set-main-owner.js, using the number the shop owner confirms.

-- AlterTable
ALTER TABLE "AdminProfile" ADD COLUMN     "invitedAt" TIMESTAMP(3),
ADD COLUMN     "invitedById" TEXT,
ADD COLUMN     "isMainOwner" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "removedAt" TIMESTAMP(3),
ADD COLUMN     "removedById" TEXT;

-- At most one main owner, enforced by the database as well as the service.
CREATE UNIQUE INDEX "AdminProfile_one_main_owner" ON "AdminProfile" ("isMainOwner") WHERE "isMainOwner" = true;
