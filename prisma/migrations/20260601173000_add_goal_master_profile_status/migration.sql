ALTER TYPE "ProfileStatusType" ADD VALUE IF NOT EXISTS 'GOAL_MASTER';

ALTER TABLE "UserProfileStatus" ADD COLUMN "expiresAt" TIMESTAMP(3);
ALTER TABLE "UserProfileStatus" ADD COLUMN "expiredNotifiedAt" TIMESTAMP(3);

CREATE INDEX "UserProfileStatus_approvalStatus_expiresAt_expiredNotifiedAt_idx"
ON "UserProfileStatus"("approvalStatus", "expiresAt", "expiredNotifiedAt");
