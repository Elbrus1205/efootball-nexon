import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getPlayerPodiumHistory, parsePodiumPage } from "./player-podium";

function stub<T extends object, K extends keyof T, Args extends unknown[], Result>(context: TestContext, target: T, key: K, implementation: (...args: Args) => Result) {
  const original: unknown = Reflect.get(target, key);
  const tracked = context.mock.fn(implementation);
  Reflect.set(target, key, tracked);
  context.after(() => { Reflect.set(target, key, original); });
  return tracked;
}

const date = new Date("2026-09-10T12:00:00Z");
const tournament = {
  id: "cup", title: "Nexon Cup", participantMode: "SINGLE", endsAt: date, updatedAt: date, format: "SINGLE_ELIMINATION", formatBlueprintJson: null,
  stages: [{ id: "final-stage", name: "Плей-офф", type: "PLAYOFF", settingsJson: null, bracket: { id: "bracket", type: "SINGLE" }, groups: [] }],
};
const final = {
  id: "final", matchNumber: 1, status: "CONFIRMED", seriesKey: "final", seriesWinsRequired: null, legNumber: 1,
  isPenaltyTiebreak: false, isCaptainAssignedTeamMatch: false, isTeamCaptainTiebreak: false, isThirdPlaceMatch: false,
  player1Id: "alice", player2Id: "bob", participant1EntryId: "a", participant2EntryId: "b",
  winnerId: "alice", winnerEntryId: "a", player1Score: 2, player2Score: 0, player1PenaltyScore: null, player2PenaltyScore: null,
  finishedAt: date, updatedAt: date, lineupPlayers: [{ side: 1, userId: "alice" }, { side: 2, userId: "bob" }],
};

test("history loads only completed public tournaments and awards only finalists or bronze winner", async (t) => {
  stub(t, db.tournament, "findMany", async (args: Prisma.TournamentFindManyArgs) => {
    assert.equal(args.where?.status, "COMPLETED");
    assert.equal(args.where?.isTest, false);
    assert.equal(args.take, 7);
    assert.ok(args.where?.matches?.some);
    return [tournament];
  });
  stub(t, db.match, "groupBy", async () => [{ bracket: "upper", _max: { round: 3 } }]);
  stub(t, db.match, "findMany", async () => [final, {
    ...final, id: "bronze", seriesKey: "bronze", isThirdPlaceMatch: true,
    player1Id: "carol", player2Id: "dave", participant1EntryId: "c", participant2EntryId: "d", winnerId: "carol", winnerEntryId: "c",
    lineupPlayers: [{ side: 1, userId: "carol" }, { side: 2, userId: "dave" }],
  }]);
  assert.equal((await getPlayerPodiumHistory("alice")).entries[0]?.place, 1);
  assert.equal((await getPlayerPodiumHistory("bob")).entries[0]?.place, 2);
  assert.equal((await getPlayerPodiumHistory("carol")).entries[0]?.place, 3);
  assert.deepEqual((await getPlayerPodiumHistory("dave")).entries, []);
});

test("history pagination is bounded and does not load final rounds for the lookahead tournament", async (t) => {
  stub(t, db.tournament, "findMany", async (args: Prisma.TournamentFindManyArgs) => {
    assert.equal(args.skip, 6);
    assert.equal(args.take, 7);
    return Array.from({ length: 7 }, (_, index) => ({ ...tournament, id: `cup${index}` }));
  });
  const rounds = stub(t, db.match, "groupBy", async () => [{ bracket: "upper", _max: { round: 3 } }]);
  stub(t, db.match, "findMany", async () => [final]);
  const history = await getPlayerPodiumHistory("alice", 2);
  assert.equal(history.entries.length, 6);
  assert.equal(history.hasMore, true);
  assert.equal(rounds.mock.callCount(), 6);
});

test("group qualification does not become a tournament medal", async (t) => {
  stub(t, db.tournament, "findMany", async () => [{ ...tournament, stages: [{ ...tournament.stages[0], type: "GROUP_STAGE", bracket: null, groups: [{ id: "group" }] }] }]);
  assert.deepEqual((await getPlayerPodiumHistory("alice")).entries, []);
});

test("completed league uses official top-three standings and historical participation", async (t) => {
  stub(t, db.tournament, "findMany", async () => [{ ...tournament, stages: [{ ...tournament.stages[0], type: "LEAGUE", bracket: null, groups: [{ id: "league" }] }] }]);
  stub(t, db.groupStanding, "findMany", async () => [{ participantId: "b", rank: 1 }, { participantId: "a", rank: 2 }]);
  stub(t, db.match, "findMany", async () => [final]);
  assert.equal((await getPlayerPodiumHistory("alice")).entries[0]?.place, 2);
});

test("invalid pagination cannot request a negative or unbounded query", () => {
  for (const value of [undefined, "-1", "0", "abc", "1.2", "Infinity"]) assert.equal(parsePodiumPage(value), 1);
  assert.equal(parsePodiumPage("2"), 2);
  assert.equal(parsePodiumPage("9999999"), 10000);
});

test("an archived repaired team series does not hide the current final", async (t) => {
  stub(t, db.tournament, "findMany", async () => [tournament]);
  stub(t, db.match, "groupBy", async () => [{ bracket: "upper", _max: { round: 3 } }]);
  stub(t, db.match, "findMany", async () => [final, { ...final, id: "old", status: "CANCELLED", seriesKey: "superseded:final" }]);
  assert.equal((await getPlayerPodiumHistory("alice")).entries[0]?.place, 1);
});

test("grand final takes precedence over an upper final in a double bracket", async (t) => {
  stub(t, db.tournament, "findMany", async () => [{ ...tournament, stages: [{ ...tournament.stages[0], bracket: { id: "bracket", type: "DOUBLE" } }] }]);
  stub(t, db.match, "groupBy", async () => [{ bracket: "upper", _max: { round: 3 } }, { bracket: "grand", _max: { round: 4 } }]);
  stub(t, db.match, "findMany", async (args: Prisma.MatchFindManyArgs) => {
    assert.deepEqual(args.where?.OR, [{ bracket: "grand", round: 4 }, { isThirdPlaceMatch: true }]);
    return [final];
  });
  assert.equal((await getPlayerPodiumHistory("alice")).entries[0]?.place, 1);
});

test("legacy single-match final with separate penalties awards the penalty winner", async (t) => {
  stub(t, db.tournament, "findMany", async () => [tournament]);
  stub(t, db.match, "groupBy", async () => [{ bracket: "upper", _max: { round: 3 } }]);
  stub(t, db.match, "findMany", async () => [
    { ...final, seriesKey: null, player1Score: 1, player2Score: 1, winnerId: null, winnerEntryId: null },
    { ...final, id: "penalties", seriesKey: null, isPenaltyTiebreak: true },
  ]);
  assert.equal((await getPlayerPodiumHistory("alice")).entries[0]?.place, 1);
});
