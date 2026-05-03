-- CreateEnum
CREATE TYPE "ProfileStatusType" AS ENUM ('SEASON_CHAMPION', 'SEASON_VICE_CHAMPION', 'SEASON_BRONZE');

-- CreateEnum
CREATE TYPE "ProfileStatusTone" AS ENUM ('GOLD', 'PURPLE', 'BLUE', 'GREEN', 'GRAY');

-- CreateEnum
CREATE TYPE "ProfileStatusApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "UserProfileStatus" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "seasonId" TEXT,
    "type" "ProfileStatusType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "tone" "ProfileStatusTone" NOT NULL DEFAULT 'GRAY',
    "sourceRank" INTEGER,
    "approvalStatus" "ProfileStatusApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "selectedOrder" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "approvedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,

    CONSTRAINT "UserProfileStatus_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserProfileStatus_userId_seasonId_type_key" ON "UserProfileStatus"("userId", "seasonId", "type");

-- CreateIndex
CREATE INDEX "UserProfileStatus_userId_approvalStatus_selectedOrder_idx" ON "UserProfileStatus"("userId", "approvalStatus", "selectedOrder");

-- CreateIndex
CREATE INDEX "UserProfileStatus_approvalStatus_createdAt_idx" ON "UserProfileStatus"("approvalStatus", "createdAt");

-- CreateIndex
CREATE INDEX "UserProfileStatus_seasonId_sourceRank_idx" ON "UserProfileStatus"("seasonId", "sourceRank");

-- AddForeignKey
ALTER TABLE "UserProfileStatus" ADD CONSTRAINT "UserProfileStatus_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserProfileStatus" ADD CONSTRAINT "UserProfileStatus_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserProfileStatus" ADD CONSTRAINT "UserProfileStatus_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
