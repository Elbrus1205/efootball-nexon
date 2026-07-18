import { MatchResultStatus, MatchStatus, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { decideSubmittedScores } from "@/lib/tournaments/match-result-decision";

const AUTO_MISMATCH_COMMENT = "AUTO_MISMATCH";
const AUTO_CONFIRMED_COMMENT = "AUTO_CONFIRMED";

type MatchScoreInput = {
  player1Score: number;
  player2Score: number;
  player1PenaltyScore?: number;
  player2PenaltyScore?: number;
  comment?: string;
};

export type MatchSubmissionWriteResult =
  | { state: "waiting"; submissionId: string }
  | {
      state: "confirmed";
      player1Score: number;
      player2Score: number;
      winnerId: string | null;
      winnerEntryId: string | null;
    }
  | { state: "retry"; attemptsLeft: number }
  | { state: "disputed" };

export class MatchSubmissionWriteError extends Error {
  constructor(message: string, readonly status = 409) {
    super(message);
  }
}

async function runSubmissionTransaction(matchId: string, userId: string, body: MatchScoreInput) {
  return db.$transaction(async (tx): Promise<MatchSubmissionWriteResult> => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`match-result:${matchId}`}))`;

    const match = await tx.match.findUnique({
      where: { id: matchId },
      select: {
        id: true,
        status: true,
        scheduledAt: true,
        player1Id: true,
        player2Id: true,
        participant1EntryId: true,
        participant2EntryId: true,
        player1Score: true,
        player2Score: true,
        winnerId: true,
        winnerEntryId: true,
        submissions: {
          select: {
            id: true,
            submittedById: true,
            player1Score: true,
            player2Score: true,
            player1PenaltyScore: true,
            player2PenaltyScore: true,
            status: true,
            moderatorComment: true,
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!match) throw new MatchSubmissionWriteError("Матч не найден.", 404);
    if (match.player1Id !== userId && match.player2Id !== userId) {
      throw new MatchSubmissionWriteError("Отправлять результат могут только участники матча.", 403);
    }
    if (match.status === MatchStatus.DISPUTED) {
      throw new MatchSubmissionWriteError("Матч уже переведён в спор.");
    }
    if (match.status === MatchStatus.CONFIRMED || match.status === MatchStatus.FINISHED) {
      if (match.player1Score === null || match.player2Score === null) {
        throw new MatchSubmissionWriteError("Подтверждённый матч не содержит итоговый счёт.");
      }

      return {
        state: "confirmed",
        player1Score: match.player1Score,
        player2Score: match.player2Score,
        winnerId: match.winnerId,
        winnerEntryId: match.winnerEntryId,
      };
    }

    const scoreData = {
      player1Score: body.player1Score,
      player2Score: body.player2Score,
      player1PenaltyScore: body.player1PenaltyScore ?? null,
      player2PenaltyScore: body.player2PenaltyScore ?? null,
      comment: body.comment || null,
    };
    const pendingOwnSubmission = match.submissions.find(
      (submission) => submission.submittedById === userId && submission.status === MatchResultStatus.PENDING,
    );
    const savedSubmission = pendingOwnSubmission
      ? await tx.matchResultSubmission.update({ where: { id: pendingOwnSubmission.id }, data: scoreData })
      : await tx.matchResultSubmission.create({
          data: {
            matchId,
            submittedById: userId,
            ...scoreData,
            status: MatchResultStatus.PENDING,
          },
        });

    const pendingSubmissions = await tx.matchResultSubmission.findMany({
      where: {
        matchId,
        status: MatchResultStatus.PENDING,
        submittedById: { in: [match.player1Id, match.player2Id].filter(Boolean) as string[] },
      },
      orderBy: { createdAt: "desc" },
    });
    const player1Submission = pendingSubmissions.find((submission) => submission.submittedById === match.player1Id);
    const player2Submission = pendingSubmissions.find((submission) => submission.submittedById === match.player2Id);

    if (!player1Submission || !player2Submission) {
      await tx.match.update({ where: { id: matchId }, data: { status: MatchStatus.RESULT_SUBMITTED } });
      return { state: "waiting", submissionId: savedSubmission.id };
    }

    const previousRejectedSubmissions = match.submissions.filter(
      (submission) =>
        submission.status === MatchResultStatus.REJECTED &&
        submission.moderatorComment === AUTO_MISMATCH_COMMENT,
    ).length;
    const decision = decideSubmittedScores(player1Submission, player2Submission, previousRejectedSubmissions);
    const reviewedAt = new Date();

    if (decision.state === "confirmed") {
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
      const winnerEntryId = winnerId === match.player1Id
        ? match.participant1EntryId
        : winnerId === match.player2Id
          ? match.participant2EntryId
          : null;

      await tx.matchResultSubmission.updateMany({
        where: { id: { in: [player1Submission.id, player2Submission.id] }, status: MatchResultStatus.PENDING },
        data: { status: MatchResultStatus.CONFIRMED, moderatorComment: AUTO_CONFIRMED_COMMENT, reviewedAt },
      });
      const confirmed = await tx.match.updateMany({
        where: {
          id: matchId,
          status: { notIn: [MatchStatus.CONFIRMED, MatchStatus.FINISHED, MatchStatus.DISPUTED] },
        },
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
      if (confirmed.count !== 1) throw new MatchSubmissionWriteError("Результат матча уже обработан.");

      return {
        state: "confirmed",
        player1Score: player1Submission.player1Score,
        player2Score: player1Submission.player2Score,
        winnerId,
        winnerEntryId,
      };
    }

    await tx.matchResultSubmission.updateMany({
      where: { id: { in: [player1Submission.id, player2Submission.id] }, status: MatchResultStatus.PENDING },
      data: {
        status: decision.state === "disputed" ? MatchResultStatus.DISPUTED : MatchResultStatus.REJECTED,
        moderatorComment: AUTO_MISMATCH_COMMENT,
        reviewedAt,
      },
    });
    await tx.match.update({
      where: { id: matchId },
      data: {
        status: decision.state === "disputed"
          ? MatchStatus.DISPUTED
          : match.scheduledAt
            ? MatchStatus.SCHEDULED
            : MatchStatus.READY,
      },
    });

    return decision.state === "disputed"
      ? { state: "disputed" }
      : { state: "retry", attemptsLeft: decision.attemptsLeft };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function submitMatchResultAtomically(matchId: string, userId: string, body: MatchScoreInput) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await runSubmissionTransaction(matchId, userId, body);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034" && attempt < 2) {
        continue;
      }
      throw error;
    }
  }

  throw new MatchSubmissionWriteError("Не удалось сохранить результат матча. Повторите попытку.");
}
