import { TournamentParticipantMode } from "@prisma/client";

type TournamentBonusMatch = {
  round: number;
  matchNumber: number;
  isThirdPlaceMatch: boolean;
};

export function selectTournamentBonusPlayerIds(params: {
  participantMode: TournamentParticipantMode;
  captainId: string | null;
  rosterMemberIds: string[];
  sidePlayerIds: string[];
  historicalPlayerIds?: string[];
}) {
  const source = params.participantMode === TournamentParticipantMode.TEAM
    ? params.historicalPlayerIds?.length
      ? params.historicalPlayerIds
      : [params.captainId, ...params.rosterMemberIds]
    : params.sidePlayerIds;
  return [...new Set(source.filter((playerId): playerId is string => Boolean(playerId)))];
}

export function selectTournamentBonusMatches<T extends TournamentBonusMatch>(matches: T[]) {
  const ordered = [...matches].sort(
    (left, right) => right.round - left.round || left.matchNumber - right.matchNumber,
  );

  return {
    finalMatch: ordered.find((match) => !match.isThirdPlaceMatch),
    thirdPlaceMatch: ordered.find((match) => match.isThirdPlaceMatch),
  };
}
