-- CreateEnum
CREATE TYPE "DivisionMatchStatus" AS ENUM ('WAITING_GAME', 'WAITING_CONFIRMATION', 'DISPUTED', 'FINISHED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DivisionMatchResult" AS ENUM ('WIN', 'DRAW', 'LOSS');

-- CreateTable
CREATE TABLE "DivisionSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "betaEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DivisionSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DivisionPlayer" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "division" INTEGER NOT NULL DEFAULT 5,
    "points" INTEGER NOT NULL DEFAULT 0,
    "rating" INTEGER,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "draws" INTEGER NOT NULL DEFAULT 0,
    "losses" INTEGER NOT NULL DEFAULT 0,
    "winStreak" INTEGER NOT NULL DEFAULT 0,
    "bestWinStreak" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DivisionPlayer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DivisionQueueEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "group" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DivisionQueueEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DivisionMatch" (
    "id" TEXT NOT NULL,
    "playerOneId" TEXT NOT NULL,
    "playerTwoId" TEXT NOT NULL,
    "playerOneScore" INTEGER,
    "playerTwoScore" INTEGER,
    "status" "DivisionMatchStatus" NOT NULL DEFAULT 'WAITING_GAME',
    "deadlineAt" TIMESTAMP(3) NOT NULL,
    "finishedAt" TIMESTAMP(3),
    "autoResolved" BOOLEAN NOT NULL DEFAULT false,
    "adminNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DivisionMatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DivisionScoreSubmission" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "submittedById" TEXT NOT NULL,
    "playerOneScore" INTEGER NOT NULL,
    "playerTwoScore" INTEGER NOT NULL,
    "screenshotUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DivisionScoreSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DivisionMatchHistory" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "opponentId" TEXT NOT NULL,
    "result" "DivisionMatchResult" NOT NULL,
    "playerScore" INTEGER NOT NULL,
    "opponentScore" INTEGER NOT NULL,
    "divisionBefore" INTEGER NOT NULL,
    "divisionAfter" INTEGER NOT NULL,
    "pointsBefore" INTEGER,
    "pointsAfter" INTEGER,
    "ratingBefore" INTEGER,
    "ratingAfter" INTEGER,
    "delta" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DivisionMatchHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DivisionPlayer_userId_key" ON "DivisionPlayer"("userId");
CREATE INDEX "DivisionPlayer_division_points_idx" ON "DivisionPlayer"("division", "points");
CREATE INDEX "DivisionPlayer_division_rating_idx" ON "DivisionPlayer"("division", "rating");
CREATE INDEX "DivisionPlayer_wins_losses_idx" ON "DivisionPlayer"("wins", "losses");
CREATE UNIQUE INDEX "DivisionQueueEntry_userId_key" ON "DivisionQueueEntry"("userId");
CREATE INDEX "DivisionQueueEntry_group_createdAt_idx" ON "DivisionQueueEntry"("group", "createdAt");
CREATE INDEX "DivisionMatch_status_deadlineAt_idx" ON "DivisionMatch"("status", "deadlineAt");
CREATE INDEX "DivisionMatch_playerOneId_createdAt_idx" ON "DivisionMatch"("playerOneId", "createdAt");
CREATE INDEX "DivisionMatch_playerTwoId_createdAt_idx" ON "DivisionMatch"("playerTwoId", "createdAt");
CREATE UNIQUE INDEX "DivisionScoreSubmission_matchId_submittedById_key" ON "DivisionScoreSubmission"("matchId", "submittedById");
CREATE INDEX "DivisionScoreSubmission_matchId_createdAt_idx" ON "DivisionScoreSubmission"("matchId", "createdAt");
CREATE UNIQUE INDEX "DivisionMatchHistory_matchId_playerId_key" ON "DivisionMatchHistory"("matchId", "playerId");
CREATE INDEX "DivisionMatchHistory_playerId_createdAt_idx" ON "DivisionMatchHistory"("playerId", "createdAt");
CREATE INDEX "DivisionMatchHistory_createdAt_idx" ON "DivisionMatchHistory"("createdAt");

-- AddForeignKey
ALTER TABLE "DivisionPlayer" ADD CONSTRAINT "DivisionPlayer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DivisionQueueEntry" ADD CONSTRAINT "DivisionQueueEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DivisionMatch" ADD CONSTRAINT "DivisionMatch_playerOneId_fkey" FOREIGN KEY ("playerOneId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DivisionMatch" ADD CONSTRAINT "DivisionMatch_playerTwoId_fkey" FOREIGN KEY ("playerTwoId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DivisionScoreSubmission" ADD CONSTRAINT "DivisionScoreSubmission_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "DivisionMatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DivisionScoreSubmission" ADD CONSTRAINT "DivisionScoreSubmission_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DivisionMatchHistory" ADD CONSTRAINT "DivisionMatchHistory_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "DivisionMatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DivisionMatchHistory" ADD CONSTRAINT "DivisionMatchHistory_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "DivisionPlayer"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "DivisionSettings" ("id", "betaEnabled", "updatedAt") VALUES ('default', true, CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;
