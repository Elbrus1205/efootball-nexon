import { type Prisma } from "@prisma/client";
import { getPlayerRatings } from "@/lib/ratings";

type TopRankingTournament = {
  seasonId: string | null;
  topRankingRestrictionEnabled: boolean;
  topRankingLimit: number;
  topRankingPlayerLimit: number;
};

export type RankingSnapshot = {
  rank: number | null;
  isTopRanked: boolean;
};

export class TopRankingRosterError extends Error {
  constructor(message: string) {
    super(message);
  }
}

export function isRankInsideTop(rank: number | null, topRankingLimit: number) {
  return rank !== null && rank <= topRankingLimit;
}

export async function getRankingSnapshot(tournament: TopRankingTournament, userId: string): Promise<RankingSnapshot> {
  if (!tournament.topRankingRestrictionEnabled) {
    return { rank: null, isTopRanked: false };
  }

  const ratings = await getPlayerRatings({ seasonId: tournament.seasonId });
  const rankIndex = ratings.findIndex((player) => player.playerId === userId);
  const rank = rankIndex >= 0 ? rankIndex + 1 : null;
  return {
    rank,
    isTopRanked: isRankInsideTop(rank, tournament.topRankingLimit),
  };
}

export async function assertTopRankingRosterEligibility(
  tx: Prisma.TransactionClient,
  input: {
    tournament: TopRankingTournament;
    registrationId: string;
    targetSnapshot: RankingSnapshot;
  },
) {
  if (!input.tournament.topRankingRestrictionEnabled || !input.targetSnapshot.isTopRanked) {
    return;
  }

  const topPlayersCount = await tx.tournamentRegistrationMember.count({
    where: {
      registrationId: input.registrationId,
      status: { in: ["PENDING", "ACCEPTED"] },
      isTopRankAtInvite: true,
    },
  });

  if (topPlayersCount >= input.tournament.topRankingPlayerLimit) {
    throw new TopRankingRosterError(
      `Нельзя пригласить этого игрока: команда уже использовала лимит ${input.tournament.topRankingPlayerLimit} игрок(а) из топ-${input.tournament.topRankingLimit}.`,
    );
  }
}
