import type { FormatBlueprint, PlayoffStageBlueprint } from "@/lib/format-blueprint";

export type TournamentMatchShape = {
  participantMode: "SINGLE" | "COOP" | "TEAM";
  rosterSize: number;
  captainsCreateTeamMatches: boolean;
  matchupFormat: "SINGLE_MATCH" | "BEST_OF";
  bestOfWins: number;
};

export type TournamentScoringShape = {
  pointsForWin: number;
  pointsForDraw: number;
  pointsForLoss: number;
  sortRules: readonly string[];
};

export type ExpectedCustomPlayoff = {
  blueprintId: string;
  name: string;
  type: PlayoffStageBlueprint["type"];
  legsCount: number;
  thirdPlaceMatch: boolean;
  size: number;
  roundsCount: number;
  upperEntriesCount: number;
  lowerEntriesCount: number;
  directEntriesCount: number;
  selections: PlayoffStageBlueprint["selections"];
};

export type ExpectedCustomStructure = {
  opening: null | {
    name: string;
    mode: "custom-groups" | "custom-league";
    divisionsCount: number;
    participantsPerGroup: number | null;
    roundsCount: number;
    matchesPerOpponent: number;
  };
  playoffs: ExpectedCustomPlayoff[];
};

export function getCustomOpeningGroupName(
  opening: NonNullable<ExpectedCustomStructure["opening"]>,
  groupIndex: number,
) {
  if (opening.divisionsCount === 1) return opening.name;
  if (opening.mode === "custom-groups") {
    return `Группа ${String.fromCharCode(65 + groupIndex)}`;
  }
  return `${opening.name} ${groupIndex + 1}`;
}

export type ActualCustomStructure = {
  opening: null | {
    divisionsCount: number | null;
    participantsPerGroup: number | null;
    roundsCount: number | null;
    mode: string | null;
    matchesPerOpponent: number | null;
  };
  playoffs: Array<{
    size: number;
    roundsCount: number | null;
    type: PlayoffStageBlueprint["type"];
    legsCount: number;
    thirdPlaceMatch: boolean;
    upperEntriesCount: number | null;
    lowerEntriesCount: number | null;
  }>;
};

function nextPowerOfTwo(value: number) {
  return 2 ** Math.ceil(Math.log2(Math.max(value, 2)));
}

function roundRobinToursCount(participantsCount: number) {
  const slotsCount = participantsCount % 2 === 0 ? participantsCount : participantsCount + 1;
  return Math.max(slotsCount - 1, 1);
}

function selectionEntries(playoff: PlayoffStageBlueprint, target: "upper" | "lower") {
  return playoff.selections
    .filter((selection) => selection.targetBracket === target)
    .reduce((total, selection) => total + Math.max(0, selection.toRank - selection.fromRank + 1), 0);
}

export function deriveExpectedCustomStructure(blueprint: FormatBlueprint, maxParticipants: number): ExpectedCustomStructure {
  const hasOpeningStage = blueprint.openingStageMode !== "NONE";
  const participantsPerDivision =
    blueprint.participantsPerGroup ?? Math.max(2, Math.ceil(maxParticipants / blueprint.divisionsCount));
  const openingRoundsCount = blueprint.openingRoundsCount ?? roundRobinToursCount(participantsPerDivision);

  return {
    opening: hasOpeningStage
      ? {
          name: blueprint.leagueStageName,
          mode: blueprint.openingStageMode === "LEAGUE" ? "custom-league" : "custom-groups",
          divisionsCount: blueprint.divisionsCount,
          participantsPerGroup: blueprint.participantsPerGroup,
          roundsCount: openingRoundsCount,
          matchesPerOpponent: blueprint.roundsCount,
        }
      : null,
    playoffs: blueprint.playoffs.map((playoff) => {
      const upperEntriesCount = selectionEntries(playoff, "upper");
      const lowerEntriesCount = selectionEntries(playoff, "lower");
      const directEntriesCount = hasOpeningStage ? 0 : maxParticipants;
      const size = nextPowerOfTwo(Math.max(upperEntriesCount, lowerEntriesCount, directEntriesCount, 2));

      return {
        blueprintId: playoff.id,
        name: playoff.name,
        type: playoff.type,
        legsCount: playoff.type === "DOUBLE" ? 1 : playoff.legsCount,
        thirdPlaceMatch: playoff.type === "DOUBLE" ? false : playoff.thirdPlaceMatch,
        size,
        roundsCount: Math.log2(size),
        upperEntriesCount,
        lowerEntriesCount,
        directEntriesCount,
        selections: playoff.selections,
      };
    }),
  };
}

export function findCustomStructureDrift(expected: ExpectedCustomStructure, actual: ActualCustomStructure) {
  const expectedOpening = expected.opening;
  const openingDrift = expectedOpening
    ? !actual.opening ||
      actual.opening.divisionsCount !== expectedOpening.divisionsCount ||
      (expectedOpening.participantsPerGroup !== null && actual.opening.participantsPerGroup !== expectedOpening.participantsPerGroup) ||
      actual.opening.roundsCount !== expectedOpening.roundsCount ||
      actual.opening.mode !== expectedOpening.mode ||
      actual.opening.matchesPerOpponent !== expectedOpening.matchesPerOpponent
    : actual.opening !== null;
  const playoffDrift =
    actual.playoffs.length !== expected.playoffs.length ||
    expected.playoffs.some((playoff, index) => {
      const current = actual.playoffs[index];
      return !current ||
        current.size !== playoff.size ||
        current.roundsCount !== playoff.roundsCount ||
        current.type !== playoff.type ||
        current.legsCount !== playoff.legsCount ||
        current.thirdPlaceMatch !== playoff.thirdPlaceMatch ||
        (playoff.directEntriesCount === 0 && current.upperEntriesCount !== playoff.upperEntriesCount) ||
        (playoff.directEntriesCount === 0 && current.lowerEntriesCount !== playoff.lowerEntriesCount);
    });

  return { openingDrift, playoffDrift };
}

function openingShape(structure: ExpectedCustomStructure) {
  if (!structure.opening) return null;
  return {
    mode: structure.opening.mode,
    divisionsCount: structure.opening.divisionsCount,
    participantsPerGroup: structure.opening.participantsPerGroup,
    roundsCount: structure.opening.roundsCount,
    matchesPerOpponent: structure.opening.matchesPerOpponent,
  };
}

function playoffShape(structure: ExpectedCustomStructure) {
  return structure.playoffs.map((playoff) => ({
    blueprintId: playoff.blueprintId,
    type: playoff.type,
    legsCount: playoff.legsCount,
    thirdPlaceMatch: playoff.thirdPlaceMatch,
    size: playoff.size,
    roundsCount: playoff.roundsCount,
    upperEntriesCount: playoff.upperEntriesCount,
    lowerEntriesCount: playoff.lowerEntriesCount,
    directEntriesCount: playoff.directEntriesCount,
    selections: playoff.selections,
  }));
}

export function planTournamentEditSynchronization(input: {
  previousBlueprint: FormatBlueprint;
  nextBlueprint: FormatBlueprint;
  previousMaxParticipants: number;
  nextMaxParticipants: number;
  previousMatchShape: TournamentMatchShape;
  nextMatchShape: TournamentMatchShape;
  previousScoringShape: TournamentScoringShape;
  nextScoringShape: TournamentScoringShape;
  previousStartsAt: Date;
  nextStartsAt: Date;
}) {
  const previous = deriveExpectedCustomStructure(input.previousBlueprint, input.previousMaxParticipants);
  const next = deriveExpectedCustomStructure(input.nextBlueprint, input.nextMaxParticipants);
  const matchShapeChanged = JSON.stringify(input.previousMatchShape) !== JSON.stringify(input.nextMatchShape);
  const scoringChanged = JSON.stringify(input.previousScoringShape) !== JSON.stringify(input.nextScoringShape);
  const openingShapeChanged = JSON.stringify(openingShape(previous)) !== JSON.stringify(openingShape(next));
  const playoffShapeChanged = JSON.stringify(playoffShape(previous)) !== JSON.stringify(playoffShape(next));

  return {
    expected: next,
    rebuildOpening: openingShapeChanged || matchShapeChanged,
    rebuildPlayoffs: openingShapeChanged || playoffShapeChanged || matchShapeChanged,
    refreshMetadata: JSON.stringify(previous) !== JSON.stringify(next),
    recalculateStandings: scoringChanged,
    scheduleShiftMs: input.nextStartsAt.getTime() - input.previousStartsAt.getTime(),
  };
}
