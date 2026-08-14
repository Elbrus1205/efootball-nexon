import { MatchStatus } from "@prisma/client";
import assert from "node:assert/strict";
import test from "node:test";
import { canEditMatchParticipants } from "./admin-match-participant-policy";

test("players can be corrected after a result while the recorded score remains attached to the slot", () => {
  assert.equal(
    canEditMatchParticipants({
      status: MatchStatus.CONFIRMED,
      player1Score: 2,
      player2Score: 3,
      winnerId: "winner",
      isCaptainAssignedTeamMatch: true,
    }, { player1Id: "replacement" }),
    true,
  );
});

test("players can be selected while an unplayed team match is open", () => {
  assert.equal(
    canEditMatchParticipants({
      status: MatchStatus.READY,
      player1Score: null,
      player2Score: null,
      winnerId: null,
      isCaptainAssignedTeamMatch: true,
    }, { player1Id: "replacement" }),
    true,
  );
});

test("team identities remain locked after a result even when team players can be corrected", () => {
  assert.equal(
    canEditMatchParticipants({
      status: MatchStatus.CONFIRMED,
      player1Score: 2,
      player2Score: 3,
      winnerId: "winner",
      isCaptainAssignedTeamMatch: true,
    }, { participant1EntryId: "another-team" }),
    false,
  );
});

test("ordinary matches stay locked in a terminal status even when legacy score fields are empty", () => {
  assert.equal(
    canEditMatchParticipants({
      status: MatchStatus.CONFIRMED,
      player1Score: null,
      player2Score: null,
      winnerId: null,
    }, { player1Id: "replacement" }),
    false,
  );
});

test("a scored team match only accepts one non-empty player correction at a time", () => {
  const match = {
    status: MatchStatus.CONFIRMED,
    player1Score: 2,
    player2Score: 3,
    winnerId: "winner",
    isCaptainAssignedTeamMatch: true,
  };

  assert.equal(canEditMatchParticipants(match, { player1Id: "", player2Id: "replacement" }), false);
  assert.equal(canEditMatchParticipants(match, { player1Id: "" }), false);
});
