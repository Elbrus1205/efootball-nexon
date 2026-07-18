import assert from "node:assert/strict";
import test from "node:test";

import { decideSubmittedScores } from "./match-result-decision";

const score = { player1Score: 2, player2Score: 1, player1PenaltyScore: null, player2PenaltyScore: null };

test("matching submissions confirm exactly once", () => {
  assert.deepEqual(decideSubmittedScores(score, { ...score }, 0), { state: "confirmed" });
});

test("three pairs of mismatched submissions escalate the match to a dispute", () => {
  assert.deepEqual(decideSubmittedScores(score, { ...score, player1Score: 1 }, 0), {
    state: "retry",
    mismatchAttempts: 1,
    attemptsLeft: 2,
  });
  assert.deepEqual(decideSubmittedScores(score, { ...score, player1Score: 1 }, 4), {
    state: "disputed",
    mismatchAttempts: 3,
    attemptsLeft: 0,
  });
});
