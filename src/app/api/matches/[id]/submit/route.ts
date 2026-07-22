import { MatchStatus, NotificationType, UserRole } from "@prisma/client";
import { after, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { createNotification } from "@/lib/services/notifications";
import { resultSubmissionSchema } from "@/lib/validators";
import { finalizeConfirmedMatch } from "@/lib/tournaments/finalize-confirmed-match";
import { buildScoreConfirmMessage } from "@/lib/services/telegram-callbacks";
import { getConfiguredSiteBaseUrl } from "@/lib/affiliate";
import { MatchSubmissionWriteError, submitMatchResultAtomically } from "@/lib/tournaments/submit-match-result";

function hasPenaltyScores(body: { player1PenaltyScore?: number; player2PenaltyScore?: number }) {
  return body.player1PenaltyScore !== undefined && body.player2PenaltyScore !== undefined;
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
      // The score as it should read from the opponent's perspective is identical:
      // both players submit the same absolute player1:player2 score for the match.
      const scoreConfirm = await buildScoreConfirmMessage({
        opponentUserId: opponentId,
        matchId: match.id,
        tournamentId: match.tournamentId,
        tournamentTitle: match.tournament.title,
        player1Score: body.player1Score,
        player2Score: body.player2Score,
        player1PenaltyScore: body.player1PenaltyScore,
        player2PenaltyScore: body.player2PenaltyScore,
        matchUrl: (() => {
          const baseUrl = getConfiguredSiteBaseUrl();
          return baseUrl ? new URL(`/tournaments/${match.tournamentId}?tab=my-matches`, baseUrl).toString() : null;
        })(),
      });

      await createNotification({
        userId: opponentId,
        title: "Соперник отправил результат",
        body: `Для матча ${match.tournament.title} нужно подтвердить свой вариант счёта.`,
        type: NotificationType.RESULT,
        link: `/tournaments/${match.tournamentId}`,
        telegramRichMessage: scoreConfirm,
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
    await finalizeConfirmedMatch({
      match,
      winnerId: outcome.winnerId,
      player1Score: outcome.player1Score,
      player2Score: outcome.player2Score,
      scheduleBackground: (task) => after(task),
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
