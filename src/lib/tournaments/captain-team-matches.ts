import { MatchStatus } from "@prisma/client";
import { db } from "@/lib/db";

/**
 * Turns every team-vs-team fixture into one empty slot per roster player.
 * The first row is reused so existing schedule and bracket references stay valid.
 */
export async function prepareCaptainAssignedTeamMatchSlots(tournamentId: string) {
  const tournament = await db.tournament.findUnique({
    where: { id: tournamentId },
    select: { captainsCreateTeamMatches: true, rosterSize: true },
  });
  if (!tournament?.captainsCreateTeamMatches || tournament.rosterSize < 2) return 0;

  const fixtures = await db.match.findMany({
    where: {
      tournamentId,
      isCaptainAssignedTeamMatch: false,
      isPenaltyTiebreak: false,
      participant1EntryId: { not: null },
      participant2EntryId: { not: null },
      status: { in: [MatchStatus.PENDING, MatchStatus.READY, MatchStatus.SCHEDULED] },
      player1Score: null,
      player2Score: null,
    },
    select: {
      id: true,
      tournamentId: true,
      stageId: true,
      groupId: true,
      bracketId: true,
      round: true,
      matchNumber: true,
      bracket: true,
      seriesKey: true,
      legNumber: true,
      seriesWinsRequired: true,
      seriesMatchNumber: true,
      isThirdPlaceMatch: true,
      scheduledAt: true,
      startsAt: true,
      participant1EntryId: true,
      participant2EntryId: true,
      nextMatchId: true,
      nextMatchSlot: true,
      loserNextMatchId: true,
      loserNextMatchSlot: true,
    },
  });

  for (const fixture of fixtures) {
    await db.$transaction(async (tx) => {
      await tx.match.update({
        where: { id: fixture.id },
        data: {
          player1Id: null,
          player2Id: null,
          status: MatchStatus.PENDING,
          isCaptainAssignedTeamMatch: true,
        },
      });

      if (tournament.rosterSize > 1) {
        await tx.match.createMany({
          data: Array.from({ length: tournament.rosterSize - 1 }, () => ({
            tournamentId: fixture.tournamentId,
            stageId: fixture.stageId,
            groupId: fixture.groupId,
            bracketId: fixture.bracketId,
            round: fixture.round,
            matchNumber: fixture.matchNumber,
            bracket: fixture.bracket,
            seriesKey: fixture.seriesKey,
            legNumber: fixture.legNumber,
            seriesWinsRequired: fixture.seriesWinsRequired,
            seriesMatchNumber: fixture.seriesMatchNumber,
            isThirdPlaceMatch: fixture.isThirdPlaceMatch,
            scheduledAt: fixture.scheduledAt,
            startsAt: fixture.startsAt,
            participant1EntryId: fixture.participant1EntryId,
            participant2EntryId: fixture.participant2EntryId,
            nextMatchId: fixture.nextMatchId,
            nextMatchSlot: fixture.nextMatchSlot,
            loserNextMatchId: fixture.loserNextMatchId,
            loserNextMatchSlot: fixture.loserNextMatchSlot,
            status: MatchStatus.PENDING,
            isCaptainAssignedTeamMatch: true,
          })),
        });
      }
    });
  }

  return fixtures.length;
}
