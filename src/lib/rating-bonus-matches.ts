type TournamentBonusMatch = {
  round: number;
  matchNumber: number;
  isThirdPlaceMatch: boolean;
};

export function selectTournamentBonusMatches<T extends TournamentBonusMatch>(matches: T[]) {
  const ordered = [...matches].sort(
    (left, right) => right.round - left.round || left.matchNumber - right.matchNumber,
  );

  return {
    finalMatch: ordered.find((match) => !match.isThirdPlaceMatch),
    thirdPlaceMatch: ordered.find((match) => match.isThirdPlaceMatch),
  };
}
