ALTER TABLE "Tournament"
  ADD COLUMN "clubSelectionByLeague" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "clubSelectionInGameOnly" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE "League" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "badgePath" TEXT NOT NULL,
  "isEnabled" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "League_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Club" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "imagePath" TEXT NOT NULL,
  "leagueId" TEXT,
  "isRegistrationEnabled" BOOLEAN NOT NULL DEFAULT true,
  "isInGameEnabled" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Club_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TournamentLeague" (
  "id" TEXT NOT NULL,
  "tournamentId" TEXT NOT NULL,
  "leagueId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TournamentLeague_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "League_slug_key" ON "League"("slug");
CREATE UNIQUE INDEX "Club_slug_key" ON "Club"("slug");
CREATE UNIQUE INDEX "TournamentLeague_tournamentId_leagueId_key" ON "TournamentLeague"("tournamentId", "leagueId");
CREATE INDEX "League_isEnabled_sortOrder_idx" ON "League"("isEnabled", "sortOrder");
CREATE INDEX "Club_leagueId_isRegistrationEnabled_isInGameEnabled_idx" ON "Club"("leagueId", "isRegistrationEnabled", "isInGameEnabled");
CREATE INDEX "Club_isRegistrationEnabled_isInGameEnabled_name_idx" ON "Club"("isRegistrationEnabled", "isInGameEnabled", "name");
CREATE INDEX "TournamentLeague_leagueId_idx" ON "TournamentLeague"("leagueId");

ALTER TABLE "Club" ADD CONSTRAINT "Club_leagueId_fkey"
  FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TournamentLeague" ADD CONSTRAINT "TournamentLeague_tournamentId_fkey"
  FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TournamentLeague" ADD CONSTRAINT "TournamentLeague_leagueId_fkey"
  FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE CASCADE ON UPDATE CASCADE;
