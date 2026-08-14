import assert from "node:assert/strict";
import test from "node:test";
import { planCaptainTeamPlayerCorrection } from "./captain-team-player-correction";

test("putting a scored team player into another slot swaps the players and leaves score data on each slot", () => {
  const target = {
    id: "match-a",
    player1Id: "home-a",
    player2Id: "away-a",
    player1Score: 4,
    player2Score: 2,
  };
  const sibling = {
    id: "match-b",
    player1Id: "home-b",
    player2Id: "away-b",
    player1Score: 1,
    player2Score: 3,
  };

  const corrections = planCaptainTeamPlayerCorrection({
    target,
    siblings: [sibling],
    side: 1,
    nextPlayerId: "home-b",
  });

  assert.deepEqual(corrections, [
    { matchId: "match-a", previousPlayerId: "home-a", nextPlayerId: "home-b" },
    { matchId: "match-b", previousPlayerId: "home-b", nextPlayerId: "home-a" },
  ]);
  assert.deepEqual([target.player1Score, target.player2Score], [4, 2]);
  assert.deepEqual([sibling.player1Score, sibling.player2Score], [1, 3]);
});
