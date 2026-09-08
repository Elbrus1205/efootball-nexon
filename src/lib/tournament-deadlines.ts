import { normalizeFormatBlueprint } from "./format-blueprint";

function highestRound(rounds: readonly number[]) {
  return rounds.reduce((max, round) => Number.isInteger(round) && round > max ? round : max, 0);
}

export function resolveConfiguredStageRoundsCount(
  configuredRoundsCount: number | null | undefined,
  stageName: string,
  stageOrderIndex: number,
  formatBlueprintJson: unknown,
) {
  const blueprint = normalizeFormatBlueprint(formatBlueprintJson);
  const graphStage = blueprint.stageGraph?.stages.find(
    (stage) => stage.name === stageName || stage.order === stageOrderIndex + 1,
  );
  if (!graphStage || (graphStage.type !== "GROUPS" && graphStage.type !== "LEAGUE")) {
    return configuredRoundsCount ?? 0;
  }

  const divisionRounds = graphStage.divisions.map((division) => division.roundsCount);
  return Math.max(configuredRoundsCount ?? 0, graphStage.roundsCount, ...divisionRounds);
}

export function resolveStageDeadlineRoundsCount(
  configuredRoundsCount: number | null | undefined,
  matchRounds: readonly number[],
  savedDeadlineRounds: readonly number[] = [],
) {
  const generatedRoundsCount = highestRound(matchRounds);
  const savedRoundsCount = highestRound(savedDeadlineRounds);

  if (generatedRoundsCount > 0) {
    return Math.max(generatedRoundsCount, savedRoundsCount);
  }

  return Math.max(configuredRoundsCount ?? 0, savedRoundsCount, 0);
}
