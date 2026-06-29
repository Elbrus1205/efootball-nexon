import { MatchStatus, Prisma, TeamInviteStatus, TournamentParticipantMode } from "@prisma/client";
import { db } from "@/lib/db";

const PLAYER_STATS_RESET_PREFIX = "playerStatsResetAt:";

export type PlayerCareerStats = {
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  cleanSheets: number;
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
    cleanSheets: 0,
    winRate: 0,
  };
}

type PlayerCareerStatsOptions = {
  seasonId?: string | null;
};

export async function getPlayerCareerStats(playerId: string, options: PlayerCareerStatsOptions = {}): Promise<PlayerCareerStats> {
  const resetSetting = await db.siteContent.findUnique({
    where: { key: `${PLAYER_STATS_RESET_PREFIX}${playerId}` },
    select: { body: true },
  });
  const resetAt = resetSetting?.body ? new Date(resetSetting.body) : null;
  const validResetAt = resetAt && !Number.isNaN(resetAt.getTime()) ? resetAt : null;

  const tournamentWhere: Prisma.TournamentWhereInput = {};
  if (options.seasonId) {
    tournamentWhere.seasonId = options.seasonId;
  }

  const where: Prisma.MatchWhereInput = {
    isPenaltyTiebreak: false,
    status: { in: [MatchStatus.CONFIRMED, MatchStatus.FINISHED] },
    player1Score: { not: null },
    player2Score: { not: null },
    ...(options.seasonId ? { tournament: tournamentWhere } : {}),
    AND: [
      {
        OR: [
          { player1Id: playerId },
          { player2Id: playerId },
          { lineupPlayers: { some: { userId: playerId } } },
          {
            tournament: { ...tournamentWhere, participantMode: TournamentParticipantMode.COOP },
            participant1Entry: { rosterMembers: { some: { userId: playerId, status: TeamInviteStatus.ACCEPTED } } },
          },
          {
            tournament: { ...tournamentWhere, participantMode: TournamentParticipantMode.COOP },
            participant2Entry: { rosterMembers: { some: { userId: playerId, status: TeamInviteStatus.ACCEPTED } } },
          },
        ],
      },
      ...(validResetAt
        ? [
            {
              OR: [{ finishedAt: { gte: validResetAt } }, { finishedAt: null, updatedAt: { gte: validResetAt } }],
            },
          ]
        : []),
    ],
  };

  const matches = await db.match.findMany({
    where,
    select: {
      tournament: { select: { participantMode: true } },
      player1Id: true,
      player2Id: true,
      player1Score: true,
      player2Score: true,
      lineupPlayers: {
        select: {
          side: true,
          userId: true,
        },
      },
      participant1Entry: {
        select: {
          rosterMembers: {
            where: { status: TeamInviteStatus.ACCEPTED },
            select: { userId: true },
          },
        },
      },
      participant2Entry: {
        select: {
          rosterMembers: {
            where: { status: TeamInviteStatus.ACCEPTED },
            select: { userId: true },
          },
        },
      },
    },
  });

  const stats = emptyPlayerCareerStats();

  for (const match of matches) {
    if (match.player1Score === null || match.player2Score === null) continue;

    const isCoopMatch = match.tournament.participantMode === TournamentParticipantMode.COOP;
    const hasLineupSnapshot = match.lineupPlayers.length > 0;
    const isPlayerOne = hasLineupSnapshot
      ? match.lineupPlayers.some((lineupPlayer) => lineupPlayer.side === 1 && lineupPlayer.userId === playerId)
      : match.player1Id === playerId ||
        (isCoopMatch && match.participant1Entry?.rosterMembers.some((member) => member.userId === playerId) === true);
    const isPlayerTwo = hasLineupSnapshot
      ? match.lineupPlayers.some((lineupPlayer) => lineupPlayer.side === 2 && lineupPlayer.userId === playerId)
      : match.player2Id === playerId ||
        (isCoopMatch && match.participant2Entry?.rosterMembers.some((member) => member.userId === playerId) === true);
    if (!isPlayerOne && !isPlayerTwo) continue;

    const goalsFor = isPlayerOne ? match.player1Score : match.player2Score;
    const goalsAgainst = isPlayerOne ? match.player2Score : match.player1Score;

    stats.played += 1;
    stats.goalsFor += goalsFor;
    stats.goalsAgainst += goalsAgainst;
    if (goalsAgainst === 0) stats.cleanSheets += 1;

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
