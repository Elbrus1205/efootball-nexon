import { MatchStatus, TeamInviteStatus, TournamentParticipantMode, TournamentStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { notifyMatchReady } from "@/lib/services/tournaments";
import { invalidateTournamentSchedule } from "@/lib/tournament-cache";

class TeamMatchAssignmentError extends Error {
  constructor(message: string, readonly status = 409) {
    super(message);
  }
}

export async function POST(request: Request, props: { params: Promise<{ id: string; matchId: string }> }) {
  const params = await props.params;
  const session = await requireAuth();
  const payload = await request.json().catch(() => ({}));
  const player1Id = typeof payload.player1Id === "string" ? payload.player1Id : "";
  const player2Id = typeof payload.player2Id === "string" ? payload.player2Id : "";

  if (!player1Id || !player2Id) {
    return NextResponse.json({ error: "Выберите игрока хозяев и игрока гостей." }, { status: 400 });
  }

  try {
    await db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`captain-team-match:${params.matchId}`}))`;

      const match = await tx.match.findFirst({
        where: { id: params.matchId, tournamentId: params.id },
        include: {
          tournament: {
            select: {
              title: true,
              status: true,
              participantMode: true,
              captainsCreateTeamMatches: true,
              notificationsEnabled: true,
            },
          },
          participant1Entry: {
            select: {
              rosterMembers: {
                where: { status: TeamInviteStatus.ACCEPTED },
                select: { userId: true, isCaptain: true },
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

      if (!match) throw new TeamMatchAssignmentError("Матч не найден.", 404);
      if (!match.tournament.captainsCreateTeamMatches || match.tournament.participantMode !== TournamentParticipantMode.TEAM) {
        throw new TeamMatchAssignmentError("Для этого турнира ручное назначение матчей выключено.", 400);
      }
      if (match.tournament.status !== TournamentStatus.IN_PROGRESS) {
        throw new TeamMatchAssignmentError("Пары игроков можно назначать после начала тура.", 400);
      }
      if (!match.isCaptainAssignedTeamMatch || match.player1Id || match.player2Id || match.status !== MatchStatus.PENDING) {
        throw new TeamMatchAssignmentError("Эта пара уже подтверждена и больше не редактируется.");
      }
      if (!match.participant1EntryId || !match.participant2EntryId || !match.participant1Entry || !match.participant2Entry) {
        throw new TeamMatchAssignmentError("Команды для этого матча еще не определены.");
      }

      const isHomeCaptain = match.participant1Entry.rosterMembers.some((member) => member.isCaptain && member.userId === session.user.id);
      if (!isHomeCaptain) {
        throw new TeamMatchAssignmentError("Назначать пары может только капитан команды-хозяина.", 403);
      }
      if (!match.participant1Entry.rosterMembers.some((member) => member.userId === player1Id)) {
        throw new TeamMatchAssignmentError("Выберите игрока из команды-хозяина.", 400);
      }
      if (!match.participant2Entry.rosterMembers.some((member) => member.userId === player2Id)) {
        throw new TeamMatchAssignmentError("Выберите игрока из команды гостей.", 400);
      }

      const alreadyAssigned = await tx.match.findFirst({
        where: {
          tournamentId: params.id,
          stageId: match.stageId,
          groupId: match.groupId,
          bracketId: match.bracketId,
          round: match.round,
          id: { not: match.id },
          OR: [{ player1Id }, { player2Id }],
        },
        select: { id: true },
      });
      if (alreadyAssigned) {
        throw new TeamMatchAssignmentError("Этот игрок уже назначен на матч в данном туре.");
      }

      await tx.match.update({
        where: { id: match.id },
        data: { player1Id, player2Id, status: MatchStatus.READY },
      });
    });
  } catch (error) {
    if (error instanceof TeamMatchAssignmentError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }

  invalidateTournamentSchedule(params.id);
  await notifyMatchReady(params.matchId);

  return NextResponse.json({ ok: true });
}
