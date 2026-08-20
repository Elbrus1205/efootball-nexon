import { MatchStatus } from "@prisma/client";
import { db } from "@/lib/db";

/**
 * Turns every team-vs-team fixture into one empty slot per roster player.
 * The first row is reused so existing schedule and bracket references stay valid.
 */
export async function prepareCaptainAssignedTeamMatchSlots(tournamentId: string) {
  return db.$transaction(async (tx) => {
    const tournament = await tx.tournament.findUnique({
      where: { id: tournamentId },
      select: { captainsCreateTeamMatches: true, rosterSize: true },
    });
    if (!tournament?.captainsCreateTeamMatches || tournament.rosterSize < 2) return 0;

    // Concurrent playoff advancement can call this function more than once.
    // Lock source fixtures before checking and expanding them.
    const lockedFixtures = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id
      FROM "Match"
      WHERE "tournamentId" = ${tournamentId}
        AND "isCaptainAssignedTeamMatch" = false
        AND "isTeamCaptainTiebreak" = false
        AND "isPenaltyTiebreak" = false
        AND "participant1EntryId" IS NOT NULL
        AND "participant2EntryId" IS NOT NULL
        AND status IN (${MatchStatus.PENDING}, ${MatchStatus.READY}, ${MatchStatus.SCHEDULED})
        AND "player1Score" IS NULL
        AND "player2Score" IS NULL
      ORDER BY round, "matchNumber", "legNumber"
      FOR UPDATE
    `;
    if (!lockedFixtures.length) return 0;

    const fixtures = await tx.match.findMany({
      where: { id: { in: lockedFixtures.map((fixture) => fixture.id) } },
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
      orderBy: [{ round: "asc" }, { matchNumber: "asc" }, { legNumber: "asc" }],
    });

    for (const fixture of fixtures) {
      const reverseHomeAndAway = Boolean(fixture.bracketId) && (fixture.legNumber ?? 1) % 2 === 0;
      const participant1EntryId = reverseHomeAndAway ? fixture.participant2EntryId : fixture.participant1EntryId;
      const participant2EntryId = reverseHomeAndAway ? fixture.participant1EntryId : fixture.participant2EntryId;

      await tx.match.update({
        where: { id: fixture.id },
        data: {
          player1Id: null,
          player2Id: null,
          participant1EntryId,
          participant2EntryId,
          status: MatchStatus.PENDING,
          isCaptainAssignedTeamMatch: true,
        },
      });

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
          participant1EntryId,
          participant2EntryId,
          nextMatchId: fixture.nextMatchId,
          nextMatchSlot: fixture.nextMatchSlot,
          loserNextMatchId: fixture.loserNextMatchId,
          loserNextMatchSlot: fixture.loserNextMatchSlot,
          status: MatchStatus.PENDING,
          isCaptainAssignedTeamMatch: true,
        })),
      });
    }

    return fixtures.length;
  });
}
