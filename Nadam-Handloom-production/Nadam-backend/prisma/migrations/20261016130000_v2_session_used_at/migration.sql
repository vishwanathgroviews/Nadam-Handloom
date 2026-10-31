-- Admin app (16 Oct 2026): when a sign-in was first used, so a renewal whose reply was lost
-- (weak shop Wi-Fi) can be told apart from a copied key. Nullable: the old app ignores it.
ALTER TABLE "Session" ADD COLUMN "usedAt" TIMESTAMP(3);
