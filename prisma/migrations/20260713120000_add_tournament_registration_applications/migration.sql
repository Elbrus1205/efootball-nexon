BEGIN;

CREATE TYPE "TournamentApplicationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

ALTER TABLE "Tournament"
ADD COLUMN "requireLineupPhoto" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "TournamentRegistrationApplication" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "TournamentApplicationStatus" NOT NULL DEFAULT 'PENDING',
    "clubSlug" TEXT,
    "clubName" TEXT,
    "clubBadgePath" TEXT,
    "teamName" TEXT,
    "teamLogo" TEXT,
    "lineupPhotoUrl" TEXT NOT NULL,
    "rejectionReason" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TournamentRegistrationApplication_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TournamentRegistrationApplication_tournamentId_userId_key"
ON "TournamentRegistrationApplication"("tournamentId", "userId");

CREATE UNIQUE INDEX "TournamentRegistrationApplication_pending_club_key"
ON "TournamentRegistrationApplication"("tournamentId", "clubSlug")
WHERE "status" = 'PENDING' AND "clubSlug" IS NOT NULL;

CREATE INDEX "TournamentRegistrationApplication_tournamentId_status_createdAt_idx"
ON "TournamentRegistrationApplication"("tournamentId", "status", "createdAt");

CREATE INDEX "TournamentRegistrationApplication_userId_status_idx"
ON "TournamentRegistrationApplication"("userId", "status");

CREATE INDEX "TournamentRegistrationApplication_reviewedById_idx"
ON "TournamentRegistrationApplication"("reviewedById");

ALTER TABLE "TournamentRegistrationApplication"
ADD CONSTRAINT "TournamentRegistrationApplication_tournamentId_fkey"
FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TournamentRegistrationApplication"
ADD CONSTRAINT "TournamentRegistrationApplication_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TournamentRegistrationApplication"
ADD CONSTRAINT "TournamentRegistrationApplication_reviewedById_fkey"
FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE public."TournamentRegistrationApplication" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policy
    WHERE polrelid = 'public."TournamentRegistrationApplication"'::regclass
      AND polname = 'deny_all_public_access'
  ) THEN
    CREATE POLICY deny_all_public_access
      ON public."TournamentRegistrationApplication"
      AS PERMISSIVE
      FOR ALL
      TO public
      USING (false)
      WITH CHECK (false);
  END IF;
END $$;

COMMIT;
