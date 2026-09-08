import assert from "node:assert/strict";
import test from "node:test";
import { resolveConfiguredStageRoundsCount, resolveStageDeadlineRoundsCount } from "./tournament-deadlines";

test("deadline rounds follow generated paired tours instead of empty configured tours", () => {
  assert.equal(resolveStageDeadlineRoundsCount(38, Array.from({ length: 19 }, (_, index) => index + 1)), 19);
});

test("deadline rounds still include generated matches beyond stale stage metadata", () => {
  assert.equal(resolveStageDeadlineRoundsCount(19, Array.from({ length: 38 }, (_, index) => index + 1)), 38);
});

test("deadline rounds use configured metadata before matches are generated", () => {
  assert.equal(resolveStageDeadlineRoundsCount(8, []), 8);
});

test("saved deadline rows remain visible so administrators can edit or remove them", () => {
  assert.equal(resolveStageDeadlineRoundsCount(19, [1, 19], [22]), 22);
});

test("visual league division rounds remain visible before league matches exist", () => {
  const formatBlueprint = {
    openingStageMode: "LEAGUE",
    leagueStageName: "Евро Лиги",
    divisionsCount: 1,
    roundsCount: 1,
    openingRoundsCount: 1,
    participantsPerGroup: 20,
    playoffs: [],
    stageGraph: {
      version: 3,
      mode: "VISUAL",
      stages: [{
        id: "euro-league",
        name: "Евро Лиги",
        type: "LEAGUE",
        order: 1,
        divisionsCount: 1,
        participantsPerDivision: 20,
        roundsCount: 1,
        matchesPerOpponent: 1,
        divisions: [{ id: "euro-league-1", name: "Евро", participantsCount: 20, roundsCount: 8, matchesPerOpponent: 1, advancingRanks: [] }],
      }],
      transitions: [],
      superCup: { enabled: false, stageId: "", name: "", sourcePlayoffIds: [], result: "WINNER", playoffType: "SINGLE", bracketSize: null, bestOfWins: 1, legsCount: 1, thirdPlaceMatch: false, penaltyRule: "REQUIRED_ON_DRAW", seedingMethod: "GROUP_RESULTS" },
    },
  };

  assert.equal(resolveConfiguredStageRoundsCount(1, "Евро Лиги", 0, formatBlueprint), 8);
  assert.equal(resolveStageDeadlineRoundsCount(8, [], []), 8);
});
