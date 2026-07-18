-- Speed up player profile/rating reads. Keep these transaction-compatible so
-- the complete migration history can be replayed on a clean database.
CREATE INDEX IF NOT EXISTS "User_role_isBanned_createdAt_idx"
  ON public."User" (role, "isBanned", "createdAt");

CREATE INDEX IF NOT EXISTS "Match_player1Id_status_finishedAt_idx"
  ON public."Match" ("player1Id", status, "finishedAt")
  WHERE "player1Id" IS NOT NULL
    AND "player1Score" IS NOT NULL
    AND "player2Score" IS NOT NULL
    AND "isPenaltyTiebreak" = false;

CREATE INDEX IF NOT EXISTS "Match_player2Id_status_finishedAt_idx"
  ON public."Match" ("player2Id", status, "finishedAt")
  WHERE "player2Id" IS NOT NULL
    AND "player1Score" IS NOT NULL
    AND "player2Score" IS NOT NULL
    AND "isPenaltyTiebreak" = false;

CREATE INDEX IF NOT EXISTS "Match_finishedAt_updatedAt_createdAt_idx"
  ON public."Match" ("finishedAt", "updatedAt", "createdAt")
  WHERE "player1Id" IS NOT NULL
    AND "player2Id" IS NOT NULL
    AND "player1Score" IS NOT NULL
    AND "player2Score" IS NOT NULL
    AND "isPenaltyTiebreak" = false
    AND status IN ('CONFIRMED'::public."MatchStatus", 'FINISHED'::public."MatchStatus");

CREATE INDEX IF NOT EXISTS "MatchLineupPlayer_userId_matchId_idx"
  ON public."MatchLineupPlayer" ("userId", "matchId");
