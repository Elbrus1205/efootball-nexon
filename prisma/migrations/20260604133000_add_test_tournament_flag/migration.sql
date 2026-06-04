ALTER TABLE "Tournament"
ADD COLUMN "isTest" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "Tournament_isTest_status_idx" ON "Tournament"("isTest", "status");
