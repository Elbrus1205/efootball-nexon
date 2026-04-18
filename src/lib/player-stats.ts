import { MatchStatus } from "@prisma/client";
import { db } from "@/lib/db";

export type PlayerCareerStats = {
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  winRate: number;
};

export function emptyPlayerCareerStats(): PlayerCareerStats {
  return {
    played: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    goalDifference: 0,
    winRate: 0,
  };
}

export async function getPlayerCareerStats(playerId: string): Promise<PlayerCareerStats> {
  const matches = await db.match.findMany({
    where: {
      isPenaltyTiebreak: false,
      status: { in: [MatchStatus.CONFIRMED, MatchStatus.FINISHED] },
      player1Score: { not: null },
      player2Score: { not: null },
      OR: [{ player1Id: playerId }, { player2Id: playerId }],
    },
    select: {
      player1Id: true,
      player2Id: true,
      player1Score: true,
      player2Score: true,
    },
  });

  const stats = emptyPlayerCareerStats();

  for (const match of matches) {
    if (match.player1Score === null || match.player2Score === null) continue;

    const isPlayerOne = match.player1Id === playerId;
    const goalsFor = isPlayerOne ? match.player1Score : match.player2Score;
    const goalsAgainst = isPlayerOne ? match.player2Score : match.player1Score;

    stats.played += 1;
    stats.goalsFor += goalsFor;
    stats.goalsAgainst += goalsAgainst;

    if (goalsFor > goalsAgainst) {
      stats.wins += 1;
    } else if (goalsFor < goalsAgainst) {
      stats.losses += 1;
    } else {
      stats.draws += 1;
    }
  }

  stats.goalDifference = stats.goalsFor - stats.goalsAgainst;
  stats.winRate = stats.played ? Math.round((stats.wins / stats.played) * 100) : 0;

  return stats;
}
