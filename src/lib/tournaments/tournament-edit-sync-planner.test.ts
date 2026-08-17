import assert from "node:assert/strict";
import test from "node:test";
import { PlayoffType } from "@prisma/client";
import type { FormatBlueprint } from "@/lib/format-blueprint";
import {
  deriveExpectedCustomStructure,
  findCustomStructureDrift,
  getCustomOpeningGroupName,
  planTournamentEditSynchronization,
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
