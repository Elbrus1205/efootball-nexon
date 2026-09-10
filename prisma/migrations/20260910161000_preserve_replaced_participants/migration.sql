-- Historical entries must coexist with the current occupant of a club slot.
DROP INDEX "TournamentRegistration_tournamentId_userId_key";
DROP INDEX "TournamentRegistration_tournamentId_clubSlug_key";
CREATE INDEX "TournamentRegistration_tournamentId_userId_idx" ON "TournamentRegistration"("tournamentId", "userId");
CREATE INDEX "TournamentRegistration_tournamentId_clubSlug_idx" ON "TournamentRegistration"("tournamentId", "clubSlug");
-- Prisma 6 cannot declare these partial unique indexes in schema.prisma.
CREATE UNIQUE INDEX "TournamentRegistration_active_user_key"
  ON "TournamentRegistration"("tournamentId", "userId") WHERE "status" <> 'REMOVED';
CREATE UNIQUE INDEX "TournamentRegistration_active_club_key"
  ON "TournamentRegistration"("tournamentId", "clubSlug") WHERE "status" <> 'REMOVED';

-- Restore only exact archived values captured by the replacement's audit log.
-- Do not infer a former club from the current player's profile or replacement.
WITH archived AS (
  SELECT DISTINCT ON ("entityId") "entityId", "beforeJson"
  FROM "AdminAction"
  WHERE "entityType" = 'TOURNAMENT_PARTICIPANT'
    AND "afterJson"->'replacementRegistration' IS NOT NULL
    AND "beforeJson"->>'clubName' IS NOT NULL
  ORDER BY "entityId", "createdAt" DESC
)
UPDATE "TournamentRegistration" AS registration
SET "clubName" = archived."beforeJson"->>'clubName',
    "clubSlug" = archived."beforeJson"->>'clubSlug',
    "clubBadgePath" = archived."beforeJson"->>'clubBadgePath'
FROM archived
WHERE registration."id" = archived."entityId"
  AND registration."status" = 'REMOVED'
  AND registration."clubName" IS NULL;
