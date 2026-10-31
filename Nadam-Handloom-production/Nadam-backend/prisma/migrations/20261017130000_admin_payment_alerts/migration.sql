-- Admin app: online payments list and payment notifications (additive only).

-- A refund Razorpay refused: tried again later and later; the owners are told once.
ALTER TABLE "PaymentAttempt" ADD COLUMN "refundTries" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "PaymentAttempt" ADD COLUMN "refundError" TEXT;
ALTER TABLE "PaymentAttempt" ADD COLUMN "nextRefundAt" TIMESTAMP(3);
ALTER TABLE "PaymentAttempt" ADD COLUMN "alertedAt" TIMESTAMP(3);

-- The admin app's notification token, one per signed-in phone.
CREATE TABLE "StaffPushToken" (
    "id" TEXT NOT NULL,
    "trustedDeviceId" TEXT NOT NULL,
    "authAccountId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "payments" BOOLEAN NOT NULL DEFAULT true,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffPushToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StaffPushToken_trustedDeviceId_key" ON "StaffPushToken"("trustedDeviceId");
CREATE UNIQUE INDEX "StaffPushToken_token_key" ON "StaffPushToken"("token");
CREATE INDEX "StaffPushToken_authAccountId_idx" ON "StaffPushToken"("authAccountId");

ALTER TABLE "StaffPushToken" ADD CONSTRAINT "StaffPushToken_trustedDeviceId_fkey" FOREIGN KEY ("trustedDeviceId") REFERENCES "TrustedDevice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StaffPushToken" ADD CONSTRAINT "StaffPushToken_authAccountId_fkey" FOREIGN KEY ("authAccountId") REFERENCES "AuthAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
