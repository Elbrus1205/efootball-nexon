import { MatchStatus, Prisma } from "@prisma/client";
import { db } from "@/lib/db";

export const PLAYER_HEAD_TO_HEAD_PAGE_SIZE = 3;

export type PlayerHeadToHeadResult = "WIN" | "DRAW" | "LOSS";

export type PlayerHeadToHeadMatch = {
  id: string;
  tournamentId: string;
  tournamentTitle: string;
  stageName: string | null;
  round: number;
  matchNumber: number;
  date: string;
  playerScore: number;
  opponentScore: number;
  result: PlayerHeadToHeadResult;
};

export type PlayerHeadToHeadHistory = {
  entries: PlayerHeadToHeadMatch[];
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
};

type PlayerHeadToHeadOptions = {
  page?: number;
  seasonId?: string | null;
};

function normalizePage(page: number | undefined) {
  return Number.isSafeInteger(page) && (page ?? 0) > 0 ? Math.min(page!, 10000) : 1;
}

function sideForUser(
  match: {
    player1Id: string | null;
    player2Id: string | null;
    lineupPlayers: Array<{ side: number; userId: string }>;
  },
  userId: string,
  opponentId: string,
) {
  const userSnapshotSide = match.lineupPlayers.find((item) => item.userId === userId)?.side ?? null;
  const opponentSnapshotSide = match.lineupPlayers.find((item) => item.userId === opponentId)?.side ?? null;
  if (userSnapshotSide && opponentSnapshotSide && userSnapshotSide !== opponentSnapshotSide) return userSnapshotSide;
  if (match.player1Id === userId) return 1;
  if (match.player2Id === userId) return 2;
  return null;
}

export async function getPlayerHeadToHeadHistory(
  playerId: string,
  opponentId: string,
  options: PlayerHeadToHeadOptions = {},
): Promise<PlayerHeadToHeadHistory> {
  const page = normalizePage(options.page);
  const pairWhere: Prisma.MatchWhereInput[] = [
    { player1Id: playerId, player2Id: opponentId },
    { player1Id: opponentId, player2Id: playerId },
    {
      AND: [
        { lineupPlayers: { some: { side: 1, userId: playerId } } },
        { lineupPlayers: { some: { side: 2, userId: opponentId } } },
      ],
    },
    {
      AND: [
        { lineupPlayers: { some: { side: 1, userId: opponentId } } },
        { lineupPlayers: { some: { side: 2, userId: playerId } } },
      ],
    },
  ];
  const where: Prisma.MatchWhereInput = {
    isPenaltyTiebreak: false,
    status: { in: [MatchStatus.CONFIRMED, MatchStatus.FINISHED] },
    player1Score: { not: null },
    player2Score: { not: null },
    tournament: {
      isTest: false,
      ...(options.seasonId ? { seasonId: options.seasonId } : {}),
    },
    OR: pairWhere,
  };

  const [total, matches] = await Promise.all([
    db.match.count({ where }),
    db.match.findMany({
      where,
      select: {
        id: true,
        tournamentId: true,
        round: true,
        matchNumber: true,
        player1Id: true,
        player2Id: true,
        player1Score: true,
        player2Score: true,
        finishedAt: true,
        scheduledAt: true,
        updatedAt: true,
        tournament: { select: { title: true } },
        stage: { select: { name: true } },
        lineupPlayers: { select: { side: true, userId: true } },
      },
      orderBy: [{ finishedAt: "desc" }, { updatedAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * PLAYER_HEAD_TO_HEAD_PAGE_SIZE,
      take: PLAYER_HEAD_TO_HEAD_PAGE_SIZE,
    }),
  ]);

  const entries: PlayerHeadToHeadMatch[] = [];
  for (const match of matches) {
    if (match.player1Score === null || match.player2Score === null) continue;
    const playerSide = sideForUser(match, playerId, opponentId);
    const opponentSide = sideForUser(match, opponentId, playerId);
    if (playerSide === null || opponentSide === null || playerSide === opponentSide) continue;

    const playerScore = playerSide === 1 ? match.player1Score : match.player2Score;
    const opponentScore = opponentSide === 1 ? match.player1Score : match.player2Score;
    entries.push({
      id: match.id,
      tournamentId: match.tournamentId,
      tournamentTitle: match.tournament.title,
      stageName: match.stage?.name ?? null,
      round: match.round,
      matchNumber: match.matchNumber,
      date: (match.finishedAt ?? match.scheduledAt ?? match.updatedAt).toISOString(),
      playerScore,
      opponentScore,
      result: playerScore > opponentScore ? "WIN" : playerScore < opponentScore ? "LOSS" : "DRAW",
    });
  }

  return {
    entries,
    page,
    pageSize: PLAYER_HEAD_TO_HEAD_PAGE_SIZE,
    total,
    hasMore: page * PLAYER_HEAD_TO_HEAD_PAGE_SIZE < total,
  };
}
