import assert from "node:assert/strict";
import test from "node:test";
import { playedForPodiumEntry, resolvePodiumSeries, type PodiumMatch } from "./podium";

function match(overrides: Partial<PodiumMatch> = {}): PodiumMatch {
  return {
    id: "final", matchNumber: 1, status: "CONFIRMED", seriesKey: "final", seriesWinsRequired: null,
    legNumber: 1, isPenaltyTiebreak: false, isCaptainAssignedTeamMatch: false, isTeamCaptainTiebreak: false,
    isThirdPlaceMatch: false, player1Id: "alice", player2Id: "bob", participant1EntryId: "entry-a", participant2EntryId: "entry-b",
    winnerId: "alice", winnerEntryId: "entry-a", player1Score: 2, player2Score: 1,
    player1PenaltyScore: null, player2PenaltyScore: null, finishedAt: new Date("2026-09-01"), updatedAt: new Date("2026-09-01"),
    lineupPlayers: [{ side: 1, userId: "alice" }, { side: 2, userId: "bob" }], ...overrides,
  };
}

test("confirmed final resolves gold and silver, pending and bye cannot award medals", () => {
  assert.deepEqual(resolvePodiumSeries([match()]), { winnerEntryId: "entry-a", loserEntryId: "entry-b" });
  assert.equal(resolvePodiumSeries([match({ status: "RESULT_SUBMITTED" })]), null);
  assert.equal(resolvePodiumSeries([match({ player2Id: null, participant2EntryId: null })]), null);
});

test("best-of winner is based on wins rather than the first game or goal difference", () => {
  const matches = [
    match({ seriesWinsRequired: 2, player1Score: 9, player2Score: 0 }),
    match({ id: "leg2", legNumber: 2, seriesWinsRequired: 2, winnerEntryId: "entry-b", winnerId: "bob", player1Score: 0, player2Score: 1 }),
    match({ id: "leg3", legNumber: 3, seriesWinsRequired: 2, winnerEntryId: "entry-b", winnerId: "bob", player1Score: 0, player2Score: 1 }),
  ];
  assert.equal(resolvePodiumSeries(matches)?.winnerEntryId, "entry-b");
  assert.equal(resolvePodiumSeries(matches.slice(0, 2)), null);
});

test("penalty tiebreak counts once in best-of, cancelled unused legs do not block it", () => {
  const matches = [match({ seriesWinsRequired: 2 }), match({ id: "leg2", legNumber: 2, seriesWinsRequired: 2, winnerId: null, winnerEntryId: null, player1Score: 1, player2Score: 1 })];
  const penalty = match({ id: "penalties", legNumber: 2, seriesWinsRequired: 2, isPenaltyTiebreak: true });
  assert.equal(resolvePodiumSeries([...matches, penalty, match({ id: "unused", legNumber: 3, status: "CANCELLED", seriesWinsRequired: 2 })])?.winnerEntryId, "entry-a");
  assert.equal(resolvePodiumSeries([matches[1], penalty]), null);
});

test("two-leg final uses total score and respects reversed sides", () => {
  const second = match({ id: "leg2", legNumber: 2, player1Score: 3, player2Score: 0, player1Id: "bob", player2Id: "alice", participant1EntryId: "entry-b", participant2EntryId: "entry-a", winnerId: "bob", winnerEntryId: "entry-b" });
  assert.equal(resolvePodiumSeries([match(), second])?.winnerEntryId, "entry-b");
  assert.equal(resolvePodiumSeries([match(), { ...second, status: "LIVE" }]), null);
});

test("drawn final requires a confirmed penalty result", () => {
  const tied = match({ player1Score: 1, player2Score: 1, winnerId: null, winnerEntryId: null });
  assert.equal(resolvePodiumSeries([tied]), null);
  assert.equal(resolvePodiumSeries([tied, match({ id: "penalty", isPenaltyTiebreak: true })])?.winnerEntryId, "entry-a");
});

test("team final uses match wins and waits for captain tiebreak on equal wins", () => {
  const one = match({ isCaptainAssignedTeamMatch: true, player1Score: 8, player2Score: 0 });
  const two = match({ id: "game2", isCaptainAssignedTeamMatch: true, player1Score: 0, player2Score: 1, winnerId: "bob", winnerEntryId: "entry-b" });
  assert.equal(resolvePodiumSeries([one, two]), null);
  const captain = match({ id: "captain", isCaptainAssignedTeamMatch: true, isTeamCaptainTiebreak: true, winnerId: "bob", winnerEntryId: "entry-b" });
  assert.equal(resolvePodiumSeries([one, two, captain])?.winnerEntryId, "entry-b");
  assert.equal(resolvePodiumSeries([one, two, { ...two, id: "game3" }])?.winnerEntryId, "entry-b");
});

test("medals stay with historical coop participants, not current replacements or captain ids", () => {
  const historical = match({ player1Id: "new-captain", lineupPlayers: [{ side: 1, userId: "old-player" }] });
  assert.equal(playedForPodiumEntry([historical], "entry-a", "old-player", "COOP"), true);
  assert.equal(playedForPodiumEntry([historical], "entry-a", "new-captain", "COOP"), false);
  assert.equal(playedForPodiumEntry([historical], "entry-b", "old-player", "COOP"), false);
  assert.equal(playedForPodiumEntry([match({ lineupPlayers: [] })], "entry-a", "alice", "TEAM"), false);
  assert.equal(playedForPodiumEntry([match({ lineupPlayers: [] })], "entry-a", "alice", "SINGLE"), true);
});

test("bronze resolves independently; inconsistent final participants do not award medals", () => {
  assert.equal(resolvePodiumSeries([match({ isThirdPlaceMatch: true })])?.winnerEntryId, "entry-a");
  assert.equal(resolvePodiumSeries([match(), match({ id: "other", participant2EntryId: "entry-c" })]), null);
});
