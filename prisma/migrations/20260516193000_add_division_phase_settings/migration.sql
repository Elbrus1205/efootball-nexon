ALTER TABLE "DivisionSettings" ADD COLUMN "phaseStartsAt" TIMESTAMP(3);
ALTER TABLE "DivisionSettings" ADD COLUMN "phaseEndsAt" TIMESTAMP(3);
ALTER TABLE "DivisionSettings" ADD COLUMN "rulesText" TEXT;