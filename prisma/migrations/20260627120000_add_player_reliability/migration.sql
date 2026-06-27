CREATE TYPE "ReliabilityEventType" AS ENUM (
  'RESULT_CONFIRMATION',
  'CONFIRMATION_STREAK_BONUS',
  'CLEAN_MATCH_STREAK_BONUS',
  'TECHNICAL_LOSS',
  'TECHNICAL_LOSS_REPEAT',
  'DISPUTE_FALSE_SCORE',
  'DISPUTE_BOTH_SUSPICIOUS',
  'DISPUTE_NO_EVIDENCE',
  'TOURNAMENT_REMOVAL_VIOLATION',
  'REPLACEMENT_FORFEIT',
  'REPLACEMENT_CIRCUMSTANCES',
  'RESTRICTION_STARTED',
  'RESTRICTION_RECOVERY',
  'MANUAL_ADJUSTMENT'
);

ALTER TABLE "User"
  ADD COLUMN "reliabilityScore" INTEGER NOT NULL DEFAULT 100,
  ADD COLUMN "reliabilityRestrictedUntil" TIMESTAMP(3),
  ADD COLUMN "reliabilityConfirmStreak" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "reliabilityCleanMatchStreak" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "ReliabilityEvent" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "actorId" TEXT,
  "type" "ReliabilityEventType" NOT NULL,
  "delta" INTEGER NOT NULL,
  "scoreBefore" INTEGER NOT NULL,
  "scoreAfter" INTEGER NOT NULL,
  "reason" TEXT NOT NULL,
  "comment" TEXT,
  "dedupeKey" TEXT,
  "matchId" TEXT,
  "tournamentId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ReliabilityEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ReliabilityEvent_userId_dedupeKey_key" ON "ReliabilityEvent"("userId", "dedupeKey");
CREATE INDEX "ReliabilityEvent_userId_createdAt_idx" ON "ReliabilityEvent"("userId", "createdAt");
CREATE INDEX "ReliabilityEvent_userId_type_createdAt_idx" ON "ReliabilityEvent"("userId", "type", "createdAt");
CREATE INDEX "ReliabilityEvent_matchId_idx" ON "ReliabilityEvent"("matchId");
CREATE INDEX "ReliabilityEvent_tournamentId_idx" ON "ReliabilityEvent"("tournamentId");

ALTER TABLE "ReliabilityEvent" ADD CONSTRAINT "ReliabilityEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReliabilityEvent" ADD CONSTRAINT "ReliabilityEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
