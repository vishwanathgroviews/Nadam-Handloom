-- Website module W1 (customer sign-in and account), docs/modules/web-01-sign-in.md section 7.
-- Additive only: new optional columns, columns with defaults and new tables. The old
-- backend, the old website and the admin app keep working unchanged.
--   UserProfile: delivery and analytics details, consent dates, delete-account request.
--   Address: label (home / office / other) and landmark.
--   Session.kind: "staff" (admin app, old app; every existing row) or "customer" (new website).
--   Session.parentId / startedAt: a renewed website sign-in remembers the one it replaced, so
--     a renewal whose reply was lost (slow mobile data) can be repeated within 10 seconds
--     without signing the customer out; startedAt keeps the first sign-in time.
--   PhoneCode: website SMS codes, keyed by mobile (a new customer has no account yet).
--   Pincode: India Post's directory, filled by scripts/load-pincodes.js.
--   PushToken, Notification: Firebase web push.

-- AlterTable
ALTER TABLE "Address" ADD COLUMN     "label" TEXT,
ADD COLUMN     "landmark" TEXT;

-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "kind" TEXT NOT NULL DEFAULT 'staff',
ADD COLUMN     "parentId" TEXT,
ADD COLUMN     "startedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "UserProfile" ADD COLUMN     "anniversary" DATE,
ADD COLUMN     "avatarKey" TEXT,
ADD COLUMN     "city" TEXT,
ADD COLUMN     "dateOfBirth" DATE,
ADD COLUMN     "deleteRequestedAt" TIMESTAMP(3),
ADD COLUMN     "language" TEXT,
ADD COLUMN     "lastSeenAt" TIMESTAMP(3),
ADD COLUMN     "marketingOptIn" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "marketingOptInAt" TIMESTAMP(3),
ADD COLUMN     "pincode" TEXT,
ADD COLUMN     "privacyAcceptedAt" TIMESTAMP(3),
ADD COLUMN     "profileCompletedAt" TIMESTAMP(3),
ADD COLUMN     "signupCampaign" TEXT,
ADD COLUMN     "signupDevice" TEXT,
ADD COLUMN     "signupMedium" TEXT,
ADD COLUMN     "signupReferrer" TEXT,
ADD COLUMN     "signupSource" TEXT,
ADD COLUMN     "state" TEXT;

-- CreateTable
CREATE TABLE "PhoneCode" (
    "id" TEXT NOT NULL,
    "mobile" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "authAccountId" TEXT,
    "codeHash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "usedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PhoneCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pincode" (
    "pincode" TEXT NOT NULL,
    "area" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Pincode_pkey" PRIMARY KEY ("pincode")
);

-- CreateTable
CREATE TABLE "PushToken" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "authAccountId" TEXT,
    "topics" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "userAgent" TEXT,
    "browser" TEXT,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "removedAt" TIMESTAMP(3),
    "removedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PushToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "authAccountId" TEXT,
    "channel" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "link" TEXT,
    "data" JSONB,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "sentCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "sentAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PhoneCode_mobile_purpose_createdAt_idx" ON "PhoneCode"("mobile", "purpose", "createdAt");

-- CreateIndex
CREATE INDEX "PhoneCode_ipAddress_createdAt_idx" ON "PhoneCode"("ipAddress", "createdAt");

-- CreateIndex
CREATE INDEX "PhoneCode_createdAt_idx" ON "PhoneCode"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PushToken_token_key" ON "PushToken"("token");

-- CreateIndex
CREATE INDEX "PushToken_authAccountId_idx" ON "PushToken"("authAccountId");

-- CreateIndex
CREATE INDEX "PushToken_removedAt_idx" ON "PushToken"("removedAt");

-- CreateIndex
CREATE INDEX "Notification_authAccountId_createdAt_idx" ON "Notification"("authAccountId", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_type_createdAt_idx" ON "Notification"("type", "createdAt");

-- CreateIndex
CREATE INDEX "Session_parentId_idx" ON "Session"("parentId");

-- CreateIndex
CREATE INDEX "UserProfile_deleteRequestedAt_idx" ON "UserProfile"("deleteRequestedAt");

-- AddForeignKey
ALTER TABLE "PhoneCode" ADD CONSTRAINT "PhoneCode_authAccountId_fkey" FOREIGN KEY ("authAccountId") REFERENCES "AuthAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PushToken" ADD CONSTRAINT "PushToken_authAccountId_fkey" FOREIGN KEY ("authAccountId") REFERENCES "AuthAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_authAccountId_fkey" FOREIGN KEY ("authAccountId") REFERENCES "AuthAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

