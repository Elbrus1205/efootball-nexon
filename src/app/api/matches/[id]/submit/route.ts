import { MatchResultStatus, MatchStatus, NotificationType, UserRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { syncUserAchievementsForUsers } from "@/lib/achievements";
import { db } from "@/lib/db";
import { createNotification } from "@/lib/services/notifications";
import { recalculateGroupStandings, resolveConfirmedMatch } from "@/lib/services/tournaments";
import { resultSubmissionSchema } from "@/lib/validators";

const AUTO_MISMATCH_COMMENT = "AUTO_MISMATCH";
const AUTO_CONFIRMED_COMMENT = "AUTO_CONFIRMED";

function hasPenaltyScores(body: { player1PenaltyScore?: number; player2PenaltyScore?: number }) {
  return body.player1PenaltyScore !== undefined && body.player2PenaltyScore !== undefined;
}

async function createMatchOutcomeNotifications(match: {
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
        dedupeWithinHours: 12,
      });
    }),
  );
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const session = await requireAuth();
  const body = resultSubmissionSchema.parse(await request.json());

  const match = await db.match.findUnique({
    where: { id: params.id },
    include: {
      submissions: {
        orderBy: { createdAt: "desc" },
      },
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

  if (match.status === MatchStatus.CONFIRMED || match.status === MatchStatus.FINISHED) {
    return NextResponse.json({ error: "Результат этого матча уже подтверждён." }, { status: 409 });
  }

  const roundDeadline = match.stageId
    ? await db.roundDeadline.findUnique({
        where: {
          stageId_round: {
            stageId: match.stageId,
            round: match.round,
          },
        },
      })
    : null;

  if (!roundDeadline) {
    return NextResponse.json(
      { error: "Дедлайн для этого тура не задан. Счёт можно отправить только после назначения дедлайна." },
      { status: 409 },
    );
  }

  if (match.isPenaltyTiebreak && body.player1Score === body.player2Score) {
    return NextResponse.json({ error: "В серии пенальти не может быть ничьей." }, { status: 400 });
  }

  const isSingleLegPlayoffMatch = Boolean(match.bracketId) && !match.isPenaltyTiebreak && (match.playoffBracket?.legsCount ?? 1) <= 1;
  const isPlayoffScoreDraw = isSingleLegPlayoffMatch && body.player1Score === body.player2Score;
  if (isPlayoffScoreDraw && !hasPenaltyScores(body)) {
    return NextResponse.json({ error: "Для ничьей в плей-офф укажите счёт пенальти." }, { status: 400 });
  }

  if (hasPenaltyScores(body) && body.player1PenaltyScore === body.player2PenaltyScore) {
    return NextResponse.json({ error: "В серии пенальти не может быть ничьей." }, { status: 400 });
  }

  if (!isPlayoffScoreDraw && hasPenaltyScores(body)) {
    return NextResponse.json({ error: "Пенальти можно указать только при ничьей в матче плей-офф." }, { status: 400 });
  }

  const pendingOwnSubmission = match.submissions.find(
    (submission) => submission.submittedById === session.user.id && submission.status === MatchResultStatus.PENDING,
  );

  const savedSubmission = pendingOwnSubmission
    ? await db.matchResultSubmission.update({
        where: { id: pendingOwnSubmission.id },
        data: {
          player1Score: body.player1Score,
          player2Score: body.player2Score,
          player1PenaltyScore: body.player1PenaltyScore ?? null,
          player2PenaltyScore: body.player2PenaltyScore ?? null,
          comment: body.comment || null,
        },
      })
    : await db.matchResultSubmission.create({
        data: {
          matchId: params.id,
          submittedById: session.user.id,
          player1Score: body.player1Score,
          player2Score: body.player2Score,
          player1PenaltyScore: body.player1PenaltyScore ?? null,
          player2PenaltyScore: body.player2PenaltyScore ?? null,
          comment: body.comment || null,
          status: MatchResultStatus.PENDING,
        },
      });

  const pendingSubmissions = await db.matchResultSubmission.findMany({
    where: {
      matchId: params.id,
      status: MatchResultStatus.PENDING,
      submittedById: { in: [match.player1Id, match.player2Id].filter(Boolean) as string[] },
    },
    orderBy: { createdAt: "desc" },
  });

  const player1Submission = pendingSubmissions.find((submission) => submission.submittedById === match.player1Id);
  const player2Submission = pendingSubmissions.find((submission) => submission.submittedById === match.player2Id);

  await db.match.update({
    where: { id: params.id },
    data: { status: MatchStatus.RESULT_SUBMITTED },
  });

  if (!player1Submission || !player2Submission) {
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
      submissionId: savedSubmission.id,
    });
  }

  const scoresMatch =
    player1Submission.player1Score === player2Submission.player1Score &&
    player1Submission.player2Score === player2Submission.player2Score &&
    (player1Submission.player1PenaltyScore ?? null) === (player2Submission.player1PenaltyScore ?? null) &&
    (player1Submission.player2PenaltyScore ?? null) === (player2Submission.player2PenaltyScore ?? null);

  if (scoresMatch) {
    await db.matchResultSubmission.updateMany({
      where: {
        id: { in: [player1Submission.id, player2Submission.id] },
      },
      data: {
        status: MatchResultStatus.CONFIRMED,
        moderatorComment: AUTO_CONFIRMED_COMMENT,
        reviewedAt: new Date(),
      },
    });

    const winnerId =
      player1Submission.player1Score > player1Submission.player2Score
        ? match.player1Id
        : player1Submission.player1Score < player1Submission.player2Score
          ? match.player2Id
          : (player1Submission.player1PenaltyScore ?? -1) > (player1Submission.player2PenaltyScore ?? -1)
            ? match.player1Id
            : (player1Submission.player1PenaltyScore ?? -1) < (player1Submission.player2PenaltyScore ?? -1)
              ? match.player2Id
              : null;
    const winnerEntryId =
      winnerId === match.player1Id
        ? match.participant1EntryId
        : winnerId === match.player2Id
          ? match.participant2EntryId
          : null;

    await db.match.update({
      where: { id: params.id },
      data: {
        player1Score: player1Submission.player1Score,
        player2Score: player1Submission.player2Score,
        player1PenaltyScore: player1Submission.player1PenaltyScore,
        player2PenaltyScore: player1Submission.player2PenaltyScore,
        status: MatchStatus.CONFIRMED,
        winnerId,
        winnerEntryId,
      },
    });

    await recalculateGroupStandings(match.tournamentId);
    await resolveConfirmedMatch(match.id);

    await createMatchOutcomeNotifications(
      { ...match, winnerId },
      player1Submission.player1Score,
      player1Submission.player2Score,
    );
    await syncUserAchievementsForUsers([match.player1Id, match.player2Id]);

    return NextResponse.json({
      ok: true,
      state: "confirmed",
      message: "Счёт совпал. Результат матча подтверждён.",
    });
  }

  const mismatchAttempts =
    Math.floor(
      match.submissions.filter(
        (submission) =>
          submission.status === MatchResultStatus.REJECTED && submission.moderatorComment === AUTO_MISMATCH_COMMENT,
      ).length / 2,
    ) + 1;

  const shouldDispute = mismatchAttempts >= 3;

  await db.matchResultSubmission.updateMany({
    where: {
      id: { in: [player1Submission.id, player2Submission.id] },
    },
    data: {
      status: shouldDispute ? MatchResultStatus.DISPUTED : MatchResultStatus.REJECTED,
      moderatorComment: AUTO_MISMATCH_COMMENT,
      reviewedAt: new Date(),
    },
  });

  await db.match.update({
    where: { id: params.id },
    data: {
      status: shouldDispute ? MatchStatus.DISPUTED : match.scheduledAt ? MatchStatus.SCHEDULED : MatchStatus.READY,
    },
  });

  if (shouldDispute) {
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
    attemptsLeft: 3 - mismatchAttempts,
    message: `Счёт не совпал. Введите результат ещё раз. Осталось попыток: ${3 - mismatchAttempts}.`,
  });
}
