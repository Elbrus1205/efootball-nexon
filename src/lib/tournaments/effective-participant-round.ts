import { MatchStatus, StageStatus } from "@prisma/client";
import { db } from "@/lib/db";

const PARTICIPANT_CHANGE_NOTICE_MS = 12 * 60 * 60 * 1_000;
const nonPlayableStatuses = [
  MatchStatus.CONFIRMED,
  MatchStatus.FINISHED,
  MatchStatus.FORFEIT,
  MatchStatus.CANCELLED,
  MatchStatus.REJECTED,
];

/**
 * A participant change starts in the current round only when at least twelve
 * hours remain before that round's deadline. Otherwise it starts next round.
 */
export async function getEffectiveParticipantRound(tournamentId: string, now = new Date()) {
  const nextDeadline = await db.roundDeadline.findFirst({
    where: {
      tournamentId,
      deadlineAt: { gt: now },
      stage: { status: StageStatus.ACTIVE },
    },
    orderBy: [{ deadlineAt: "asc" }, { round: "asc" }],
    select: { round: true, deadlineAt: true },
  });

  if (nextDeadline) {
    return resolveEffectiveParticipantRound(nextDeadline.round, nextDeadline.deadlineAt, now);
  }

  const firstOpenMatch = await db.match.findFirst({
    where: {
      tournamentId,
      status: { notIn: nonPlayableStatuses },
      round: { gte: 1 },
    },
    orderBy: [{ round: "asc" }, { matchNumber: "asc" }],
    select: { round: true },
  });

  return firstOpenMatch?.round ?? 1;
}

export function resolveEffectiveParticipantRound(round: number, deadlineAt: Date, now: Date) {
  return round + (deadlineAt.getTime() - now.getTime() < PARTICIPANT_CHANGE_NOTICE_MS ? 1 : 0);
}
