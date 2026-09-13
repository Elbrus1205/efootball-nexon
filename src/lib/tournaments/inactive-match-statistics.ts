import { db } from "@/lib/db";
import { shouldExcludeMatchFromStatistics } from "@/lib/tournaments/inactive-participant";

export async function syncMatchStatisticsExclusion(matchId: string) {
  const match = await db.match.findUnique({
    where: { id: matchId },
    select: {
      id: true,
      round: true,
      excludeFromStatistics: true,
      participant1Entry: { select: { isActive: true, inactiveFromRound: true } },
      participant2Entry: { select: { isActive: true, inactiveFromRound: true } },
    },
  });
  if (!match || match.excludeFromStatistics) return false;

  const shouldExclude = shouldExcludeMatchFromStatistics(
    match.round,
    match.participant1Entry ?? { isActive: true, inactiveFromRound: null },
    match.participant2Entry ?? { isActive: true, inactiveFromRound: null },
  );
  if (!shouldExclude) return false;

  await db.match.update({ where: { id: match.id }, data: { excludeFromStatistics: true } });
  return true;
}
