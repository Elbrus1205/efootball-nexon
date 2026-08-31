function highestRound(rounds: readonly number[]) {
  return rounds.reduce((max, round) => Number.isInteger(round) && round > max ? round : max, 0);
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
