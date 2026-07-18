import { MatchStatus, NotificationType, UserRole } from "@prisma/client";
import { after, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { syncUserAchievementsForUsers } from "@/lib/achievements";
import { db } from "@/lib/db";
import { ensureMatchLineupSnapshot } from "@/lib/services/match-lineups";
import { createNotification } from "@/lib/services/notifications";
import { recordConfirmedMatchReliability } from "@/lib/services/reliability";
import { publishTournamentResult, syncTournamentBulletin } from "@/lib/services/telegram-publications";
import { recalculateGroupStandings, resolveConfirmedMatch } from "@/lib/services/tournaments";
import { resultSubmissionSchema } from "@/lib/validators";
import { MatchSubmissionWriteError, submitMatchResultAtomically } from "@/lib/tournaments/submit-match-result";

function hasPenaltyScores(body: { player1PenaltyScore?: number; player2PenaltyScore?: number }) {
  return body.player1PenaltyScore !== undefined && body.player2PenaltyScore !== undefined;
}

async function createMatchOutcomeNotifications(match: {
  id: string;
  tournamentId: string;
  tournament: { title: string; notificationsEnabled?: boolean | null };
  player1Id: string | null;
  player2Id: string | null;
  winnerId: string | null;
}, player1Score: number, player2Score: number) {
  if (match.tournament.notificationsEnabled === false) return;

  const playerIds = [match.player1Id, match.player2Id].filter(Boolean) as string[];

  await Promise.all(
    playerIds.map((userId) => {
      const isWinner = Boolean(match.winnerId) && userId === match.winnerId;
      const isDraw = !match.winnerId;

      return createNotification({
        userId,
        title: isDraw ? "Ничья подтверждена" : isWinner ? "Победа в матче" : "Матч завершён",
        body: `${match.tournament.title}: счёт ${player1Score}:${player2Score} подтверждён.${isWinner ? " Вы выиграли этот матч." : isDraw ? "" : " Победил соперник."}`,
        type: NotificationType.RESULT,
        link: `/tournaments/${match.tournamentId}`,
        dedupeKey: `match-result:${match.id}:${userId}`,
        dedupeWithinHours: 12,
      });
    }),
  );
}

export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await requireAuth();
  const body = resultSubmissionSchema.parse(await request.json());

  const match = await db.match.findUnique({
    where: { id: params.id },
    include: {
      tournament: true,
      playoffBracket: { select: { legsCount: true } },
    },
  });

  if (!match) {
    return NextResponse.json({ error: "Матч не найден." }, { status: 404 });
  }

  const isParticipant = match.player1Id === session.user.id || match.player2Id === session.user.id;
  if (!isParticipant) {
    return NextResponse.json({ error: "Отправлять результат могут только участники этого матча." }, { status: 403 });
  }

  if (match.status === MatchStatus.DISPUTED) {
    return NextResponse.json({ error: "Матч уже переведён в спор. Счёт теперь может подтвердить только администратор." }, { status: 409 });
  }

  const isAlreadyConfirmed = match.status === MatchStatus.CONFIRMED || match.status === MatchStatus.FINISHED;

  const roundDeadline = !isAlreadyConfirmed && match.stageId
    ? await db.roundDeadline.findUnique({
        where: {
          stageId_round: {
            stageId: match.stageId,
            round: match.round,
          },
        },
      })
    : null;

  if (!isAlreadyConfirmed && !roundDeadline) {
    return NextResponse.json(
      { error: "Дедлайн для этого тура не задан. Счёт можно отправить только после назначения дедлайна." },
      { status: 409 },
    );
  }

  if (!isAlreadyConfirmed && match.isPenaltyTiebreak && body.player1Score === body.player2Score) {
    return NextResponse.json({ error: "В серии пенальти не может быть ничьей." }, { status: 400 });
  }

  const isSingleLegPlayoffMatch = Boolean(match.bracketId) && !match.isPenaltyTiebreak && (match.playoffBracket?.legsCount ?? 1) <= 1;
  const isPlayoffScoreDraw = isSingleLegPlayoffMatch && body.player1Score === body.player2Score;
  if (!isAlreadyConfirmed && isPlayoffScoreDraw && !hasPenaltyScores(body)) {
    return NextResponse.json({ error: "Для ничьей в плей-офф укажите счёт пенальти." }, { status: 400 });
  }

  if (!isAlreadyConfirmed && hasPenaltyScores(body) && body.player1PenaltyScore === body.player2PenaltyScore) {
    return NextResponse.json({ error: "В серии пенальти не может быть ничьей." }, { status: 400 });
  }

  if (!isAlreadyConfirmed && !isPlayoffScoreDraw && hasPenaltyScores(body)) {
    return NextResponse.json({ error: "Пенальти можно указать только при ничьей в матче плей-офф." }, { status: 400 });
  }

  let outcome;
  try {
    outcome = await submitMatchResultAtomically(params.id, session.user.id, body);
  } catch (error) {
    if (error instanceof MatchSubmissionWriteError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }

  if (outcome.state === "waiting") {
    const opponentId = session.user.id === match.player1Id ? match.player2Id : match.player1Id;
    if (opponentId && match.tournament.notificationsEnabled !== false) {
      await createNotification({
        userId: opponentId,
        title: "Соперник отправил результат",
        body: `Для матча ${match.tournament.title} нужно подтвердить свой вариант счёта.`,
        type: NotificationType.RESULT,
        link: `/tournaments/${match.tournamentId}`,
      });
    }

    return NextResponse.json({
      ok: true,
      state: "waiting",
      message: "Результат сохранён. Ожидается ответ второго игрока.",
      submissionId: outcome.submissionId,
    });
  }

  if (outcome.state === "confirmed") {
    await recalculateGroupStandings(match.tournamentId);
    await ensureMatchLineupSnapshot(match.id);
    await resolveConfirmedMatch(match.id);
    await recordConfirmedMatchReliability({
      userIds: [match.player1Id, match.player2Id],
      matchId: match.id,
      tournamentId: match.tournamentId,
    });

    await createMatchOutcomeNotifications(
      { ...match, winnerId: outcome.winnerId },
      outcome.player1Score,
      outcome.player2Score,
    );
    await syncUserAchievementsForUsers([match.player1Id, match.player2Id]);
    after(async () => {
      await Promise.all([
        publishTournamentResult(match.id).catch((error) => console.error("Failed to publish Telegram match result", error)),
        syncTournamentBulletin(match.tournamentId).catch((error) => console.error("Failed to update Telegram bulletin", error)),
      ]);
    });

    return NextResponse.json({
      ok: true,
      state: "confirmed",
      message: "Счёт совпал. Результат матча подтверждён.",
    });
  }

  if (outcome.state === "disputed") {
    const moderators = await db.user.findMany({
      where: { role: { in: [UserRole.FOUNDER, UserRole.ORGANIZER, UserRole.ADMIN, UserRole.JUDGE, UserRole.TRAINEE] } },
    });

    if (match.tournament.notificationsEnabled !== false) {
      await Promise.all(
      moderators.map((moderator) =>
        createNotification({
          userId: moderator.id,
          title: "Матч переведён в спор",
          body: `Игроки трижды не совпали по счёту в матче ${match.tournament.title}.`,
          type: NotificationType.RESULT,
          link: "/admin/moderation",
        }),
      ),
      );
    }

    return NextResponse.json({
      ok: true,
      state: "disputed",
      message: "Игроки трижды не совпали по счёту. Матч переведён в спор, дальше результат укажет администратор.",
    });
  }

  return NextResponse.json({
    ok: true,
    state: "retry",
    attemptsLeft: outcome.attemptsLeft,
    message: `Счёт не совпал. Введите результат ещё раз. Осталось попыток: ${outcome.attemptsLeft}.`,
  });
}
