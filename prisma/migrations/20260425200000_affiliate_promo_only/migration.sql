CREATE UNIQUE INDEX IF NOT EXISTS "AffiliateReferral_userId_unique_active"
ON "AffiliateReferral"("userId")
WHERE "userId" IS NOT NULL;
