ALTER TABLE "Match"
ADD COLUMN "isTeamCaptainTiebreak" BOOLEAN NOT NULL DEFAULT false;

-- Existing unplayed second-leg captain slots were created with the same home
-- team as the first leg. Reverse them so each captain owns one set of pairings.
UPDATE "Match"
SET
  "participant1EntryId" = "participant2EntryId",
  "participant2EntryId" = "participant1EntryId",
  "player1Id" = "player2Id",
  "player2Id" = "player1Id"
WHERE "bracketId" IS NOT NULL
  AND "isCaptainAssignedTeamMatch" = true
  AND MOD(COALESCE("legNumber", 1), 2) = 0
  AND "player1Score" IS NULL
  AND "player2Score" IS NULL
  AND "status" IN ('PENDING', 'READY', 'SCHEDULED');
