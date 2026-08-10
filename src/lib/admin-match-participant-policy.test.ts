import { MatchStatus } from "@prisma/client";
import assert from "node:assert/strict";
import test from "node:test";
import { canEditMatchParticipants } from "./admin-match-participant-policy";

test("players cannot be changed after a match result is confirmed", () => {
  assert.equal(
    canEditMatchParticipants({
      status: MatchStatus.CONFIRMED,
      player1Score: 2,
      player2Score: 3,
      winnerId: "winner",
    }),
    false,
  );
});

test("players can be selected while an unplayed team match is open", () => {
  assert.equal(
    canEditMatchParticipants({
      status: MatchStatus.READY,
      player1Score: null,
      player2Score: null,
      winnerId: null,
    }),
    true,
  );
});
