-- The user requested deletion of dates of birth and representative data.
ALTER TABLE "User"
  DROP COLUMN "dateOfBirth",
  DROP COLUMN "guardianFullName",
  DROP COLUMN "guardianEmail",
  DROP COLUMN "guardianConsentAt",
  DROP COLUMN "guardianConsentVersion",
  DROP COLUMN "guardianConsentIp",
  DROP COLUMN "guardianConsentUserAgent",
  ADD COLUMN "crossBorderConsentAt" TIMESTAMP(3),
  ADD COLUMN "crossBorderConsentVersion" TEXT,
  ADD COLUMN "crossBorderConsentIp" TEXT,
  ADD COLUMN "crossBorderConsentUserAgent" TEXT;

-- Existing users are not assumed to have accepted the new consent.
ALTER TABLE "SecuritySession" ADD COLUMN "expiresAt" TIMESTAMP(3);
UPDATE "SecuritySession" SET "expiresAt" = "lastActiveAt" + INTERVAL '30 days';
DELETE FROM "SecuritySession" WHERE "revokedAt" IS NOT NULL OR "expiresAt" <= CURRENT_TIMESTAMP;
ALTER TABLE "SecuritySession" ALTER COLUMN "expiresAt" SET NOT NULL;
CREATE INDEX "SecuritySession_userId_expiresAt_idx" ON "SecuritySession"("userId", "expiresAt");
