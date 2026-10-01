import { MatchStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { shouldExcludeMatchFromStatistics, type InactiveParticipantState } from "@/lib/tournaments/inactive-participant";

const completedMatchStatuses = [MatchStatus.CONFIRMED, MatchStatus.FINISHED];

type MatchStatisticsTiming = {
  finishedAt: Date | null;
  startsAt: Date | null;
  scheduledAt: Date | null;
  createdAt: Date;
};

function matchPlayedAt(match: MatchStatisticsTiming) {
  // `finishedAt` is written when a result is confirmed. The schedule fields
  // keep older matches repairable when they predate that invariant.
  return match.finishedAt ?? match.startsAt ?? match.scheduledAt ?? match.createdAt;
}

function inactiveState(entry: InactiveParticipantState | null): InactiveParticipantState {
  return entry ?? { isActive: true, inactiveFromRound: null, inactiveSince: null };
}

function shouldExcludeMatch(match: {
  round: number;
  finishedAt: Date | null;
  startsAt: Date | null;
  scheduledAt: Date | null;
  createdAt: Date;
  participant1Entry: InactiveParticipantState | null;
  participant2Entry: InactiveParticipantState | null;
}) {
  return shouldExcludeMatchFromStatistics(
    match.round,
    inactiveState(match.participant1Entry),
    inactiveState(match.participant2Entry),
    matchPlayedAt(match),
  );
}

export async function syncMatchStatisticsExclusion(matchId: string) {
  const match = await db.match.findUnique({
    where: { id: matchId },
    select: {
      id: true,
      round: true,
      excludeFromStatistics: true,
      finishedAt: true,
      startsAt: true,
      scheduledAt: true,
      createdAt: true,
      participant1Entry: { select: { isActive: true, inactiveFromRound: true, inactiveSince: true } },
      participant2Entry: { select: { isActive: true, inactiveFromRound: true, inactiveSince: true } },
    },
  });
  if (!match) return false;

  const shouldExclude = shouldExcludeMatch(match);
  const hasInactiveSide = [match.participant1Entry, match.participant2Entry].some((entry) => entry && !entry.isActive);
  if (!shouldExclude && match.excludeFromStatistics && !hasInactiveSide) return false;
  if (shouldExclude === match.excludeFromStatistics) return false;

  await db.match.update({ where: { id: match.id }, data: { excludeFromStatistics: shouldExclude } });
  return true;
}

/** Rebuilds the inactivity-derived statistics flag after an activity change. */
export async function reconcileTournamentMatchStatistics(tournamentId: string) {
  const matches = await db.match.findMany({
    where: {
      tournamentId,
      status: { in: completedMatchStatuses },
      player1Score: { not: null },
      player2Score: { not: null },
    },
    select: {
      id: true,
      round: true,
      excludeFromStatistics: true,
      finishedAt: true,
      startsAt: true,
      scheduledAt: true,
      createdAt: true,
      participant1Entry: { select: { isActive: true, inactiveFromRound: true, inactiveSince: true } },
      participant2Entry: { select: { isActive: true, inactiveFromRound: true, inactiveSince: true } },
    },
  });

  let changed = 0;
  for (const match of matches) {
    const shouldExclude = shouldExcludeMatch(match);
    if (shouldExclude === match.excludeFromStatistics) continue;
    await db.match.update({ where: { id: match.id }, data: { excludeFromStatistics: shouldExclude } });
    changed += 1;
  }

  return { processed: matches.length, changed };
}
