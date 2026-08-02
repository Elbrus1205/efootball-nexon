import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { isRankInsideTop } from "./top-ranking-roster";

const schemaSource = readFileSync("prisma/schema.prisma", "utf8");
const migrationSource = readFileSync("prisma/migrations/20260728120000_add_team_tournament_controls/migration.sql", "utf8");
const builderSource = readFileSync("src/components/admin/tournament-builder-form.tsx", "utf8");
const inviteRouteSource = readFileSync("src/app/api/tournaments/[id]/roster/invite/route.ts", "utf8");
const topRankingSource = readFileSync("src/lib/tournaments/top-ranking-roster.ts", "utf8");
const assignmentRouteSource = readFileSync("src/app/api/tournaments/[id]/team-matches/[matchId]/route.ts", "utf8");
const reminderServiceSource = readFileSync("src/lib/services/tournaments.ts", "utf8");
const tournamentPageSource = readFileSync("src/app/tournaments/[id]/page.tsx", "utf8");
const clubPlayerLineSource = readFileSync("src/components/tournaments/club-player-line.tsx", "utf8");
const scheduleViewSource = readFileSync("src/components/tournaments/tournament-schedule-view.tsx", "utf8");
const myMatchCardSource = readFileSync("src/components/tournaments/my-match-card.tsx", "utf8");

test("top ranking snapshots use the configured inclusive top boundary", () => {
  assert.equal(isRankInsideTop(1, 10), true);
  assert.equal(isRankInsideTop(10, 10), true);
  assert.equal(isRankInsideTop(11, 10), false);
  assert.equal(isRankInsideTop(null, 10), false);
});

test("team tournament controls are persisted and exposed to the administrator", () => {
  for (const field of [
    "topRankingRestrictionEnabled",
    "topRankingLimit",
    "topRankingPlayerLimit",
    "captainsCreateTeamMatches",
  ]) {
    assert.match(schemaSource, new RegExp(`\\b${field}\\b`));
    assert.match(migrationSource, new RegExp(`"${field}"`));
    assert.match(builderSource, new RegExp(`name="${field}"`));
  }

  assert.match(schemaSource, /ratingRankAtInvite\s+Int\?/);
  assert.match(schemaSource, /isTopRankAtInvite\s+Boolean\?/);
  assert.match(schemaSource, /isCaptainAssignedTeamMatch\s+Boolean/);
});

test("roster invitations enforce and preserve the top-player decision", () => {
  assert.match(inviteRouteSource, /getRankingSnapshot\(captainMember\.tournament, target\.id\)/);
  assert.match(inviteRouteSource, /assertTopRankingRosterEligibility/);
  assert.match(inviteRouteSource, /ratingRankAtInvite: rankingSnapshot\.rank/);
  assert.match(inviteRouteSource, /isTopRankAtInvite: rankingSnapshot\.isTopRanked/);
  assert.match(topRankingSource, /Нельзя пригласить этого игрока/);
});

test("only the home captain can lock one unique player pairing per round", () => {
  assert.match(assignmentRouteSource, /Назначать пары может только капитан команды-хозяина/);
  assert.match(assignmentRouteSource, /Эта пара уже подтверждена и больше не редактируется/);
  assert.match(assignmentRouteSource, /Этот игрок уже назначен на матч в данном туре/);
  assert.match(assignmentRouteSource, /player1Id, player2Id, status: MatchStatus\.READY/);
  assert.match(assignmentRouteSource, /notifyMatchReady\(params\.matchId\)/);
});

test("captain-assigned team matches are not automatically scheduled on tournament start", () => {
  assert.match(
    reminderServiceSource,
    /if \(!tournament\.captainsCreateTeamMatches\) \{\s*await generateTournamentSchedule\(tournamentId, \{ overwrite: true \}\);\s*\}/,
  );
});

test("unassigned captain match slots show team identity without captain nicknames", () => {
  assert.match(tournamentPageSource, /const isUnassignedCaptainMatch = match\.isCaptainAssignedTeamMatch && !explicitPlayerId/);
  assert.match(tournamentPageSource, /const playerId = isUnassignedCaptainMatch \? null : explicitPlayerId \?\? entry\?\.userId \?\? null/);
  assert.match(tournamentPageSource, /showPlayerName: !isUnassignedCaptainMatch/);
  assert.match(clubPlayerLineSource, /showPlayerName \? \(/);
  assert.match(scheduleViewSource, /showPlayerName=\{match\.sideOne\.showPlayerName\}/);
  assert.match(scheduleViewSource, /showPlayerName=\{match\.sideTwo\.showPlayerName\}/);
  assert.match(myMatchCardSource, /showPlayerName=\{showPlayer1Name\}/);
  assert.match(myMatchCardSource, /showPlayerName=\{showPlayer2Name\}/);
  assert.match(tournamentPageSource, /showPlayer1Name=\{sideOne\.showPlayerName\}/);
  assert.match(tournamentPageSource, /showPlayer2Name=\{sideTwo\.showPlayerName\}/);
});

test("unfilled home pairings produce thirty-minute deadline reminders", () => {
  assert.match(reminderServiceSource, /captainsCreateTeamMatches/);
  assert.match(reminderServiceSource, /30 \* 60 \* 1_000/);
  assert.match(reminderServiceSource, /captain-team-assignment:/);
  assert.match(reminderServiceSource, /Нужно назначить пары игроков/);
});
