CREATE TYPE "DivisionSeasonStatus" AS ENUM ('SCHEDULED', 'ACTIVE', 'PAUSED', 'FINISHED');

CREATE TABLE "DivisionSeason" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "DivisionSeasonStatus" NOT NULL DEFAULT 'SCHEDULED',
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "pausedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DivisionSeason_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DivisionSeasonArchive" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "division" INTEGER NOT NULL,
    "points" INTEGER NOT NULL,
    "rating" INTEGER,
    "wins" INTEGER NOT NULL,
    "draws" INTEGER NOT NULL,
    "losses" INTEGER NOT NULL,
    "winStreak" INTEGER NOT NULL,
    "bestWinStreak" INTEGER NOT NULL,
    "place" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DivisionSeasonArchive_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DivisionSeason_status_startsAt_endsAt_idx" ON "DivisionSeason"("status", "startsAt", "endsAt");
CREATE INDEX "DivisionSeason_createdAt_idx" ON "DivisionSeason"("createdAt");
CREATE UNIQUE INDEX "DivisionSeasonArchive_seasonId_userId_key" ON "DivisionSeasonArchive"("seasonId", "userId");
CREATE INDEX "DivisionSeasonArchive_seasonId_division_place_idx" ON "DivisionSeasonArchive"("seasonId", "division", "place");
CREATE INDEX "DivisionSeasonArchive_userId_idx" ON "DivisionSeasonArchive"("userId");

ALTER TABLE "DivisionSeasonArchive" ADD CONSTRAINT "DivisionSeasonArchive_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "DivisionSeason"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DivisionSeasonArchive" ADD CONSTRAINT "DivisionSeasonArchive_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
