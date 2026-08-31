import assert from "node:assert/strict";
import test from "node:test";
import { PlayoffType } from "@prisma/client";
import type { FormatBlueprint } from "@/lib/format-blueprint";
import {
  deriveExpectedCustomStructure,
  findCustomStructureDrift,
  getCustomOpeningGroupName,
  planTournamentEditSynchronization,
  isAdvancedStageGraphBlueprint,
  type TournamentMatchShape,
} from "./tournament-edit-sync";

const matchShape: TournamentMatchShape = {
  participantMode: "TEAM",
  rosterSize: 3,
  captainsCreateTeamMatches: true,
  matchupFormat: "SINGLE_MATCH",
  bestOfWins: 1,
};
const scoringShape = { pointsForWin: 3, pointsForDraw: 1, pointsForLoss: 0, sortRules: ["POINTS", "GOAL_DIFFERENCE"] };
const startsAt = new Date("2026-08-01T12:00:00.000Z");

function teamLeague(toRank: number): FormatBlueprint {
  return {
    leagueStageName: "Лига",
    openingStageMode: "LEAGUE",
    divisionsCount: 1,
    roundsCount: 2,
    openingRoundsCount: 6,
    participantsPerGroup: null,
    playoffs: [
      {
        id: "main-playoff",
        name: "Плей-офф",
        type: PlayoffType.SINGLE,
        legsCount: 2,
        thirdPlaceMatch: true,
        selections: [
          { id: "league-places", divisionIndex: 1, fromRank: 1, toRank, targetBracket: "upper" },
        ],
      },
    ],
  };
}

test("expanding Team League qualification from 8 to 16 rebuilds only the future playoff as round of 16", () => {
  const plan = planTournamentEditSynchronization({
    previousBlueprint: teamLeague(8),
    nextBlueprint: teamLeague(16),
    previousMaxParticipants: 24,
    nextMaxParticipants: 24,
    previousMatchShape: matchShape,
    nextMatchShape: matchShape,
    previousScoringShape: scoringShape,
    nextScoringShape: scoringShape,
    previousStartsAt: startsAt,
    nextStartsAt: startsAt,
  });

  assert.equal(plan.rebuildOpening, false);
  assert.equal(plan.rebuildPlayoffs, true);
  assert.equal(plan.expected.playoffs[0]?.size, 16);
  assert.equal(plan.expected.playoffs[0]?.roundsCount, 4);
  assert.equal(plan.expected.playoffs[0]?.upperEntriesCount, 16);
});

test("renaming a stage refreshes metadata without deleting its matches", () => {
  const next = teamLeague(16);
  next.leagueStageName = "Основная лига";
  next.playoffs[0]!.name = "Финальная стади��";

  const plan = planTournamentEditSynchronization({
    previousBlueprint: teamLeague(16),
    nextBlueprint: next,
    previousMaxParticipants: 24,
    nextMaxParticipants: 24,
    previousMatchShape: matchShape,
    nextMatchShape: matchShape,
    previousScoringShape: scoringShape,
    nextScoringShape: scoringShape,
    previousStartsAt: startsAt,
    nextStartsAt: startsAt,
  });

  assert.equal(plan.rebuildOpening, false);
  assert.equal(plan.rebuildPlayoffs, false);
  assert.equal(plan.refreshMetadata, true);
});

test("changing scoring recalculates standings without rebuilding matches", () => {
  const plan = planTournamentEditSynchronization({
    previousBlueprint: teamLeague(16),
    nextBlueprint: teamLeague(16),
    previousMaxParticipants: 24,
    nextMaxParticipants: 24,
    previousMatchShape: matchShape,
    nextMatchShape: matchShape,
    previousScoringShape: scoringShape,
    nextScoringShape: { ...scoringShape, pointsForWin: 2 },
    previousStartsAt: startsAt,
    nextStartsAt: startsAt,
  });

  assert.equal(plan.rebuildOpening, false);
  assert.equal(plan.rebuildPlayoffs, false);
  assert.equal(plan.recalculateStandings, true);
});

test("moving tournament start produces the same shift for every future schedule", () => {
  const plan = planTournamentEditSynchronization({
    previousBlueprint: teamLeague(16),
    nextBlueprint: teamLeague(16),
    previousMaxParticipants: 24,
    nextMaxParticipants: 24,
    previousMatchShape: matchShape,
    nextMatchShape: matchShape,
    previousScoringShape: scoringShape,
    nextScoringShape: scoringShape,
    previousStartsAt: startsAt,
    nextStartsAt: new Date("2026-08-02T12:00:00.000Z"),
  });

  assert.equal(plan.scheduleShiftMs, 24 * 60 * 60 * 1_000);
  assert.equal(plan.rebuildOpening, false);
  assert.equal(plan.rebuildPlayoffs, false);
});

test("detects a stale quarterfinal bracket when blueprint already requires round of 16", () => {
  const expected = deriveExpectedCustomStructure(teamLeague(16), 24);
  const drift = findCustomStructureDrift(expected, {
    opening: {
      divisionsCount: 1,
      participantsPerGroup: 64,
      roundsCount: 6,
      mode: "custom-league",
      matchesPerOpponent: 2,
    },
    playoffs: [
      {
        size: 8,
        roundsCount: 3,
        type: PlayoffType.SINGLE,
        legsCount: 2,
        thirdPlaceMatch: true,
        upperEntriesCount: 8,
        lowerEntriesCount: 0,
      },
    ],
  });

  assert.equal(drift.openingDrift, false);
  assert.equal(drift.playoffDrift, true);
});

test("stage metadata changes use the same names for its generated groups", () => {
  const league = deriveExpectedCustomStructure(teamLeague(16), 24).opening;
  assert.ok(league);
  assert.equal(getCustomOpeningGroupName(league, 0), "Лига");

  const groupsBlueprint = teamLeague(16);
  groupsBlueprint.openingStageMode = "GROUPS";
  groupsBlueprint.divisionsCount = 2;
  const groups = deriveExpectedCustomStructure(groupsBlueprint, 24).opening;
  assert.ok(groups);
  assert.equal(getCustomOpeningGroupName(groups, 0), "Группа A");
  assert.equal(getCustomOpeningGroupName(groups, 1), "Группа B");
});

function europeanGraphBlueprint(roundsCount = 8): FormatBlueprint {
  const blueprint = teamLeague(16);
  blueprint.stageGraph = {
    version: 3,
    mode: "VISUAL",
    stages: [
      {
        id: "national",
        name: "Национальные лиги",
        description: "",
        type: "LEAGUE",
        order: 1,
        divisionsCount: 5,
        participantsPerDivision: null,
        roundsCount: 19,
        matchesPerOpponent: 2,
        divisions: [],
        participantCalculation: "AUTO",
        allowIncompleteDivisions: false,
        points: { win: 3, draw: 1, loss: 0 },
        sortRules: [],
      },
      {
        id: "europe",
        name: "Еврокубки",
        description: "",
        type: "LEAGUE",
        order: 2,
        divisionsCount: 3,
        participantsPerDivision: null,
        roundsCount,
        matchesPerOpponent: 1,
        divisions: [
          { id: "ucl", name: "ЛЧ", participantsCount: 30, roundsCount, matchesPerOpponent: 1, advancingRanks: [] },
          { id: "uel", name: "ЛЕ", participantsCount: 30, roundsCount, matchesPerOpponent: 1, advancingRanks: [] },
          { id: "uecl", name: "ЛК", participantsCount: 32, roundsCount, matchesPerOpponent: 1, advancingRanks: [] },
        ],
        participantCalculation: "AUTO",
        allowIncompleteDivisions: false,
        points: { win: 3, draw: 1, loss: 0 },
        sortRules: [],
      },
    ],
    transitions: [],
    superCup: {
      enabled: false,
      stageId: "supercup",
      name: "Суперкубок",
      sourcePlayoffIds: [],
      result: "WINNER",
      playoffType: PlayoffType.SINGLE,
      bracketSize: null,
      bestOfWins: 1,
      legsCount: 1,
      thirdPlaceMatch: false,
      penaltyRule: "REQUIRED_ON_DRAW",
      seedingMethod: "GROUP_RESULTS",
    },
  };
  return blueprint;
}

test("visual graph saves do not look like legacy opening-stage drift", () => {
  const graph = europeanGraphBlueprint();
  assert.equal(isAdvancedStageGraphBlueprint(graph.stageGraph), true);
  const plan = planTournamentEditSynchronization({
    previousBlueprint: graph,
    nextBlueprint: europeanGraphBlueprint(),
    previousMaxParticipants: 100,
    nextMaxParticipants: 100,
    previousMatchShape: matchShape,
    nextMatchShape: matchShape,
    previousScoringShape: scoringShape,
    nextScoringShape: scoringShape,
    previousStartsAt: startsAt,
    nextStartsAt: startsAt,
  });

  assert.equal(plan.rebuildOpening, false);
  assert.equal(plan.rebuildPlayoffs, false);
});

test("changing a visual graph league round count requires a protected rebuild", () => {
  const plan = planTournamentEditSynchronization({
    previousBlueprint: europeanGraphBlueprint(),
    nextBlueprint: europeanGraphBlueprint(7),
    previousMaxParticipants: 100,
    nextMaxParticipants: 100,
    previousMatchShape: matchShape,
    nextMatchShape: matchShape,
    previousScoringShape: scoringShape,
    nextScoringShape: scoringShape,
    previousStartsAt: startsAt,
    nextStartsAt: startsAt,
  });

  assert.equal(plan.rebuildOpening, true);
  assert.equal(plan.rebuildPlayoffs, true);
});
