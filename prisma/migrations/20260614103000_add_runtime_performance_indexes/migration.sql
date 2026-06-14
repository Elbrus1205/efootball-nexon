CREATE INDEX IF NOT EXISTS "Match_tournamentId_seriesKey_idx" ON "Match"("tournamentId", "seriesKey");

CREATE INDEX IF NOT EXISTS "MatchSchedule_matchId_idx" ON "MatchSchedule"("matchId");

CREATE INDEX IF NOT EXISTS "MatchResultSubmission_matchId_status_idx" ON "MatchResultSubmission"("matchId", "status");
