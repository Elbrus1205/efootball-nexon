import assert from "node:assert/strict";
import test from "node:test";

import { selectTournamentBonusMatches } from "./rating-bonus-matches";

test("tournament bonuses use the last main round and the dedicated third-place match", () => {
  const semifinal = { id: "semi", round: 2, matchNumber: 1, isThirdPlaceMatch: false };
  const final = { id: "final", round: 3, matchNumber: 1, isThirdPlaceMatch: false };
  const thirdPlace = { id: "third", round: 3, matchNumber: 2, isThirdPlaceMatch: true };

  assert.deepEqual(selectTournamentBonusMatches([semifinal, thirdPlace, final]), {
    finalMatch: final,
    thirdPlaceMatch: thirdPlace,
  });
});
