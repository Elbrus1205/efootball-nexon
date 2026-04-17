import { AdminActionType, MatchStatus, StageType, UserRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { recalculateGroupStandings, resolveConfirmedMatch, syncTournamentLifecycleStatus } from "@/lib/services/tournaments";

const UNPLAYED_STATUSES = new Set<MatchStatus>([
  MatchStatus.PENDING,
  MatchStatus.READY,
  MatchStatus.SCHEDULED,
  MatchStatus.LIVE,
  MatchStatus.REJECTED,
  MatchStatus.RESULT_SUBMITTED,
  MatchStatus.DISPUTED,
]);

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomScore({ allowDraw }: { allowDraw: boolean }) {
  let player1Score = randomInt(0, 5);
  let player2Score = randomInt(0, 5);

  if (!allowDraw) {
    while (player1Score === player2Score) {
      player1Score = randomInt(0, 5);
      player2Score = randomInt(0, 5);
    }
  }

  return { player1Score, player2Score };
}

async function fallbackAdvancePlayoffWinner(matchId: string) {
  const match = await db.match.findUnique({
    where: { id: matchId },
    select: {
      id: true,
      tournamentId: true,
      bracketId: true,
      bracket: true,
      seriesKey: true,
      isPenaltyTiebreak: true,
      round: true,
      matchNumber: true,
      nextMatchId: true,
      nextMatchSlot: true,
      player1Id: true,
      player2Id: true,
      participant1EntryId: true,
      participant2EntryId: true,
      winnerId: true,
      playoffBracket: {
        select: { legsCount: true },
      },
    },
  });

  if (!match?.bracketId || !match.winnerId) return;
  if (match.seriesKey && !match.isPenaltyTiebreak && (match.playoffBracket?.legsCount ?? 1) > 1) return;

  const winnerEntryId = match.winnerId === match.player1Id ? match.participant1EntryId : match.winnerId === match.player2Id ? match.participant2EntryId : null;
  const nextMatch =
    match.nextMatchId
      ? await db.match.findUnique({
          where: { id: match.nextMatchId },
          select: { id: true, seriesKey: true, player1Id: true, player2Id: true, status: true },
        })
      : await db.match.findFirst({
          where: {
            tournamentId: match.tournamentId,
            bracketId: match.bracketId,
            bracket: match.bracket,
            round: match.round + 1,
            matchNumber: Math.ceil(match.matchNumber / 2),
            isPenaltyTiebreak: false,
          },
          orderBy: [{ legNumber: "asc" }, { createdAt: "asc" }],
          select: { id: true, seriesKey: true, player1Id: true, player2Id: true, status: true },
        });

  if (!nextMatch) return;

  const slot = (match.nextMatchSlot ?? (match.matchNumber % 2 === 1 ? 1 : 2)) as 1 | 2;
  const targetMatches = nextMatch.seriesKey
    ? await db.match.findMany({
        where: { seriesKey: nextMatch.seriesKey, isPenaltyTiebreak: false },
        select: { id: true, player1Id: true, player2Id: true, status: true },
      })
    : [nextMatch];

  for (const targetMatch of targetMatches) {
    const nextPlayer1Id = slot === 1 ? match.winnerId : targetMatch.player1Id;
    const nextPlayer2Id = slot === 2 ? match.winnerId : targetMatch.player2Id;

    await db.match.update({
      where: { id: targetMatch.id },
      data: {
        ...(slot === 1
          ? { player1Id: match.winnerId, participant1EntryId: winnerEntryId }
          : { player2Id: match.winnerId, participant2EntryId: winnerEntryId }),
        status:
          nextPlayer1Id && nextPlayer2Id && targetMatch.status === MatchStatus.PENDING
            ? MatchStatus.READY
            : nextPlayer1Id && nextPlayer2Id && targetMatch.status === MatchStatus.SCHEDULED
              ? MatchStatus.SCHEDULED
              : targetMatch.status,
      },
    });
  }
}

export async function POST(_: Request, { params }: { params: { id: string } }) {
  const session = await requireRole([UserRole.ADMIN, UserRole.MODERATOR, UserRole.HEAD_JUDGE, UserRole.JUDGE]);
  const tournament = await db.tournament.findUnique({
    where: { id: params.id },
    include: {
      stages: {
        orderBy: { orderIndex: "asc" },
      },
      matches: {
        include: { stage: true },
        orderBy: [{ round: "asc" }, { matchNumber: "asc" }],
      },
    },
  });

  if (!tournament) {
    return NextResponse.json({ error: "Турнир не найден." }, { status: 404 });
  }

  const confirmedPlayoffMatches = tournament.matches.filter(
    (match) => match.bracketId && match.winnerId && match.status === MatchStatus.CONFIRMED,
  );

  for (const match of confirmedPlayoffMatches) {
    await fallbackAdvancePlayoffWinner(match.id);
  }

  const playableMatches = tournament.matches.filter(
    (match) =>
      match.player1Id &&
      match.player2Id &&
      match.participant1EntryId &&
      match.participant2EntryId &&
      UNPLAYED_STATUSES.has(match.status) &&
      (match.player1Score === null || match.player2Score === null),
  );

  if (!playableMatches.length) {
    await syncTournamentLifecycleStatus(params.id);
    return NextResponse.redirect(new URL(`/admin/tournaments/${params.id}`, _.url));
  }

  const stageWithMatches =
    tournament.stages.find((stage) => stage.status === "ACTIVE" && playableMatches.some((match) => match.stageId === stage.id)) ??
    tournament.stages.find((stage) => playableMatches.some((match) => match.stageId === stage.id));

  const stageMatches = stageWithMatches ? playableMatches.filter((match) => match.stageId === stageWithMatches.id) : playableMatches;
  const currentRound = Math.min(...stageMatches.map((match) => match.round));
  const targetMatches = stageMatches.filter((match) => match.round === currentRound);
  const beforeJson = targetMatches.map((match) => ({
    id: match.id,
    round: match.round,
    matchNumber: match.matchNumber,
    status: match.status,
    player1Score: match.player1Score,
    player2Score: match.player2Score,
  }));
  const updatedMatches = [];

  for (const match of targetMatches) {
    const isPlayoff = match.stage?.type === StageType.PLAYOFF || !!match.bracketId || match.isPenaltyTiebreak;
    const { player1Score, player2Score } = randomScore({ allowDraw: !isPlayoff });
    const winnerId = player1Score > player2Score ? match.player1Id : player2Score > player1Score ? match.player2Id : null;
    const winnerEntryId = winnerId === match.player1Id ? match.participant1EntryId : winnerId === match.player2Id ? match.participant2EntryId : null;

    const updated = await db.match.update({
      where: { id: match.id },
      data: {
        player1Score,
        player2Score,
        winnerId,
        winnerEntryId,
        status: MatchStatus.CONFIRMED,
        notes: match.notes ? `${match.notes}\nRandom score by admin` : "Random score by admin",
      },
    });

    updatedMatches.push(updated);
  }

  for (const match of updatedMatches) {
    await resolveConfirmedMatch(match.id);
    await fallbackAdvancePlayoffWinner(match.id);
  }

  if (!stageWithMatches || stageWithMatches.type === StageType.GROUP_STAGE || stageWithMatches.type === StageType.LEAGUE) {
    await recalculateGroupStandings(params.id);
  }

  await syncTournamentLifecycleStatus(params.id);

  await db.adminAction.create({
    data: {
      adminId: session.user.id,
      tournamentId: params.id,
      entityType: "MATCH_RANDOM_SCORES",
      entityId: params.id,
      actionType: AdminActionType.UPDATE,
      beforeJson,
      afterJson: updatedMatches.map((match) => ({
        id: match.id,
        round: match.round,
        matchNumber: match.matchNumber,
        status: match.status,
        player1Score: match.player1Score,
        player2Score: match.player2Score,
        winnerId: match.winnerId,
      })),
    },
  });

  return NextResponse.redirect(new URL(`/admin/tournaments/${params.id}`, _.url));
}
