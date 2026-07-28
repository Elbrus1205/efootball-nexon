ALTER TABLE "Tournament"
  ADD COLUMN "topRankingRestrictionEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "topRankingLimit" INTEGER NOT NULL DEFAULT 10,
  ADD COLUMN "topRankingPlayerLimit" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "captainsCreateTeamMatches" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "TournamentRegistrationMember"
  ADD COLUMN "ratingRankAtInvite" INTEGER,
  ADD COLUMN "isTopRankAtInvite" BOOLEAN;

ALTER TABLE "Match"
  ADD COLUMN "isCaptainAssignedTeamMatch" BOOLEAN NOT NULL DEFAULT false;
