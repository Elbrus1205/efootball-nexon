CREATE TYPE "TournamentParticipantMode" AS ENUM ('SINGLE', 'COOP', 'TEAM');
CREATE TYPE "MatchupFormat" AS ENUM ('SINGLE_MATCH', 'BEST_OF');
CREATE TYPE "TeamInviteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'REMOVED');

ALTER TYPE "MatchStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';

ALTER TABLE "Tournament"
ADD COLUMN "participantMode" "TournamentParticipantMode" NOT NULL DEFAULT 'SINGLE',
ADD COLUMN "rosterSize" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "matchupFormat" "MatchupFormat" NOT NULL DEFAULT 'SINGLE_MATCH',
ADD COLUMN "bestOfWins" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "TournamentRegistration"
ADD COLUMN "teamName" TEXT,
ADD COLUMN "teamLogo" TEXT;

ALTER TABLE "Match"
ADD COLUMN "seriesWinsRequired" INTEGER,
ADD COLUMN "seriesMatchNumber" INTEGER;

CREATE TABLE "TournamentRegistrationMember" (
  "id" TEXT NOT NULL,
  "tournamentId" TEXT NOT NULL,
  "registrationId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "status" "TeamInviteStatus" NOT NULL DEFAULT 'PENDING',
  "isCaptain" BOOLEAN NOT NULL DEFAULT false,
  "invitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "respondedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TournamentRegistrationMember_pkey" PRIMARY KEY ("id")
);

INSERT INTO "TournamentRegistrationMember" (
  "id",
  "tournamentId",
  "registrationId",
  "userId",
  "status",
  "isCaptain",
  "invitedAt",
  "respondedAt",
  "createdAt",
  "updatedAt"
)
SELECT
  concat('trm_', "id"),
  "tournamentId",
  "id",
  "userId",
  'ACCEPTED'::"TeamInviteStatus",
  true,
  "createdAt",
  "approvedAt",
  "createdAt",
  "updatedAt"
FROM "TournamentRegistration"
ON CONFLICT DO NOTHING;

CREATE UNIQUE INDEX "TournamentRegistrationMember_tournamentId_userId_key" ON "TournamentRegistrationMember"("tournamentId", "userId");
CREATE UNIQUE INDEX "TournamentRegistrationMember_registrationId_userId_key" ON "TournamentRegistrationMember"("registrationId", "userId");
CREATE INDEX "TournamentRegistrationMember_registrationId_status_idx" ON "TournamentRegistrationMember"("registrationId", "status");
CREATE INDEX "TournamentRegistrationMember_userId_status_idx" ON "TournamentRegistrationMember"("userId", "status");
CREATE INDEX "Tournament_participantMode_status_idx" ON "Tournament"("participantMode", "status");

ALTER TABLE "TournamentRegistrationMember"
ADD CONSTRAINT "TournamentRegistrationMember_tournamentId_fkey"
FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TournamentRegistrationMember"
ADD CONSTRAINT "TournamentRegistrationMember_registrationId_fkey"
FOREIGN KEY ("registrationId") REFERENCES "TournamentRegistration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TournamentRegistrationMember"
ADD CONSTRAINT "TournamentRegistrationMember_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
