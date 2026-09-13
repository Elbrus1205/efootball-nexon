ALTER TABLE "TournamentRegistration"
  ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "inactiveFromRound" INTEGER,
  ADD COLUMN "inactiveSince" TIMESTAMP(3);

ALTER TABLE "Match"
  ADD COLUMN "excludeFromStatistics" BOOLEAN NOT NULL DEFAULT false;
