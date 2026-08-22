import assert from "node:assert/strict";
import test from "node:test";
import { MatchStatus } from "@prisma/client";
import {
  createSupersededCaptainTeamSeriesKey,
  hasCaptainTeamSeriesMatchHistory,
  isSupersededCaptainTeamSeriesArchive,
  nextCaptainTeamSeriesAssignmentStatus,
  planCaptainTeamSeriesProgressReset,
  resolveCaptainTeamSeriesAssignmentSide,
  shouldSkipCaptainTeamSeriesAssignment,
  shouldResetCaptainTeamSeriesProgress,
} from "./captain-team-series-assignment";

test("repeated advancement does not rewrite an expanded captain-team playoff slot", () => {
  assert.equal(
    shouldSkipCaptainTeamSeriesAssignment({
      isCaptainAssignedTeamMatch: true,
      slot: 1,
      entryId: "team-a",
      participant1EntryId: "team-a",
      participant2EntryId: "team-b",
    }),
    true,
  );

  assert.equal(
    shouldSkipCaptainTeamSeriesAssignment({
      isCaptainAssignedTeamMatch: true,
      slot: 2,
      entryId: "team-b",
      participant1EntryId: "team-a",
      participant2EntryId: "team-b",
    }),
    true,
  );
});

test("the initial advancement can fill an unexpanded target series", () => {
  assert.equal(
    shouldSkipCaptainTeamSeriesAssignment({
      isCaptainAssignedTeamMatch: false,
      slot: 1,
      entryId: "team-a",
      participant1EntryId: null,
      participant2EntryId: null,
    }),
    false,
  );
});

test("a genuinely different entry can replace an expanded slot", () => {
  assert.equal(
    shouldSkipCaptainTeamSeriesAssignment({
      isCaptainAssignedTeamMatch: true,
      slot: 1,
      entryId: "team-c",
      participant1EntryId: "team-a",
      participant2EntryId: "team-b",
    }),
    false,
  );
});

test("a changed winner follows its club side in reversed playoff legs", () => {
  assert.equal(
    resolveCaptainTeamSeriesAssignmentSide({
      previousEntryId: "team-a",
      participant1EntryId: "team-a",
      participant2EntryId: "team-b",
    }),
    1,
  );

  assert.equal(
    resolveCaptainTeamSeriesAssignmentSide({
      previousEntryId: "team-a",
      participant1EntryId: "team-b",
      participant2EntryId: "team-a",
    }),
    2,
  );
});

test("an expanded row unrelated to the replaced bracket entry is not changed", () => {
  assert.equal(
    resolveCaptainTeamSeriesAssignmentSide({
      previousEntryId: "team-a",
      participant1EntryId: "team-b",
      participant2EntryId: "team-c",
    }),
    null,
  );
});

test("a changed bracket entry resets downstream progress instead of blocking reassignment", () => {
  assert.equal(
    shouldResetCaptainTeamSeriesProgress({
      previousEntryId: "team-a",
      nextEntryId: "team-c",
    }),
    true,
  );
});

test("repeating the same winner preserves downstream results", () => {
  assert.equal(
    shouldResetCaptainTeamSeriesProgress({
      previousEntryId: "team-a",
      nextEntryId: "team-a",
    }),
    false,
  );
});

test("repeated advancement repairs a partially expanded captain-team series", () => {
  assert.equal(
    shouldSkipCaptainTeamSeriesAssignment({
      isCaptainAssignedTeamMatch: true,
      slot: 1,
      entryId: "team-a",
      participant1EntryId: "team-a",
      participant2EntryId: "team-b",
      allSeriesSlotsAssigned: false,
    }),
    false,
  );
});

test("filling an empty bracket slot is initial assignment, not a progress reset", () => {
  assert.equal(
    shouldResetCaptainTeamSeriesProgress({
      previousEntryId: null,
      nextEntryId: "team-a",
    }),
    false,
  );
});

test("played rows are archived before a changed winner resets the active fixture", () => {
  assert.deepEqual(
    planCaptainTeamSeriesProgressReset({
      previousEntryId: "team-a",
      nextEntryId: "team-c",
      player1Score: 2,
      player2Score: 1,
      winnerEntryId: "team-a",
      hasLineupSnapshot: true,
      hasResultSubmission: true,
    }),
    { resetsProgress: true, archivesHistory: true },
  );
});

test("an untouched row can be reset in place without creating archive noise", () => {
  assert.equal(
    hasCaptainTeamSeriesMatchHistory({
      player1Score: null,
      player2Score: null,
      winnerEntryId: null,
      hasLineupSnapshot: false,
      hasResultSubmission: false,
    }),
    false,
  );
});

test("a superseded captain tiebreak stays cancelled during bracket reassignment", () => {
  assert.equal(
    nextCaptainTeamSeriesAssignmentStatus({
      currentStatus: MatchStatus.CONFIRMED,
      resetsProgress: true,
      isTeamCaptainTiebreak: true,
      hasPlayer1: false,
      hasPlayer2: true,
    }),
    MatchStatus.CANCELLED,
  );
});

test("clearing a bracket slot is never treated as repeated advancement", () => {
  assert.equal(
    shouldSkipCaptainTeamSeriesAssignment({
      isCaptainAssignedTeamMatch: true,
      slot: 1,
      entryId: null,
      participant1EntryId: "team-a",
      participant2EntryId: "team-b",
    }),
    false,
  );
});

test("superseded archive keys can be hidden from active public fixtures", () => {
  const seriesKey = createSupersededCaptainTeamSeriesKey({
    seriesKey: "series-a",
    matchId: "match-1",
    createdAtMs: 123,
  });

  assert.equal(seriesKey, "superseded:series-a:match-1:123");
  assert.equal(
    isSupersededCaptainTeamSeriesArchive({
      status: MatchStatus.CANCELLED,
      seriesKey,
    }),
    true,
  );
  assert.equal(
    isSupersededCaptainTeamSeriesArchive({
      status: MatchStatus.CONFIRMED,
      seriesKey,
    }),
    false,
  );
  assert.equal(
    isSupersededCaptainTeamSeriesArchive({
      status: MatchStatus.CANCELLED,
      seriesKey: "series-a",
    }),
    false,
  );
});
