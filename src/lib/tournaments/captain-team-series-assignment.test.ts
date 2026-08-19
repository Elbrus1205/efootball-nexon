import assert from "node:assert/strict";
import test from "node:test";
import { shouldSkipCaptainTeamSeriesAssignment } from "./captain-team-matches";

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
