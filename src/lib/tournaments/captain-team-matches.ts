import { MatchStatus, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { planCaptainTeamFixtureExpansion } from "@/lib/tournaments/captain-team-match-expansion";

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
      SELECT existing.id
      FROM "Match" existing
      WHERE existing."tournamentId" = ${tournamentId}
        AND existing."isTeamCaptainTiebreak" = false
        AND existing."isPenaltyTiebreak" = false
        AND existing.status <> ${MatchStatus.CANCELLED}
        AND EXISTS (
          SELECT 1
          FROM "Match" candidate
          WHERE candidate."tournamentId" = existing."tournamentId"
            AND candidate."stageId" IS NOT DISTINCT FROM existing."stageId"
            AND candidate."groupId" IS NOT DISTINCT FROM existing."groupId"
            AND candidate."bracketId" IS NOT DISTINCT FROM existing."bracketId"
            AND candidate.round = existing.round
            AND candidate."matchNumber" = existing."matchNumber"
            AND candidate.bracket = existing.bracket
            AND candidate."seriesKey" IS NOT DISTINCT FROM existing."seriesKey"
            AND candidate."legNumber" IS NOT DISTINCT FROM existing."legNumber"
            AND candidate."isTeamCaptainTiebreak" = false
            AND candidate."isPenaltyTiebreak" = false
            AND candidate."participant1EntryId" IS NOT NULL
            AND candidate."participant2EntryId" IS NOT NULL
            AND candidate.status IN (${MatchStatus.PENDING}, ${MatchStatus.READY}, ${MatchStatus.SCHEDULED})
            AND candidate."player1Score" IS NULL
            AND candidate."player2Score" IS NULL
        )
      ORDER BY existing.round, existing."matchNumber", existing."legNumber", existing."createdAt"
      FOR UPDATE OF existing
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
        isCaptainAssignedTeamMatch: true,
        status: true,
        player1Score: true,
        player2Score: true,
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

    const expansionPlan = planCaptainTeamFixtureExpansion(
      fixtures.map((fixture) => ({
        ...fixture,
        canExpand:
          fixture.participant1EntryId !== null &&
          fixture.participant2EntryId !== null &&
          (fixture.status === MatchStatus.PENDING ||
            fixture.status === MatchStatus.READY ||
            fixture.status === MatchStatus.SCHEDULED) &&
          fixture.player1Score === null &&
          fixture.player2Score === null,
      })),
      tournament.rosterSize,
    );

    const fixturesById = new Map(fixtures.map((fixture) => [fixture.id, fixture]));
    const unexpandedSourceIds: string[] = [];
    const rowsToCreate: Prisma.MatchCreateManyInput[] = [];

    for (const plan of expansionPlan) {
      const fixture = fixturesById.get(plan.sourceId);
      if (!fixture) continue;
      const reverseHomeAndAway =
        !fixture.isCaptainAssignedTeamMatch &&
        Boolean(fixture.bracketId) &&
        (fixture.legNumber ?? 1) % 2 === 0;
      const participant1EntryId = reverseHomeAndAway ? fixture.participant2EntryId : fixture.participant1EntryId;
      const participant2EntryId = reverseHomeAndAway ? fixture.participant1EntryId : fixture.participant2EntryId;

      if (!fixture.isCaptainAssignedTeamMatch) {
        unexpandedSourceIds.push(fixture.id);
      }

      rowsToCreate.push(
        ...Array.from({ length: plan.additionalRows }, (): Prisma.MatchCreateManyInput => ({
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
      );
    }

    // One bulk update and one bulk insert keep large playoff rounds below the
    // interactive-transaction timeout. The previous per-fixture query loop
    // could roll back the entire expansion after the bracket slots were
    // already committed, leaving only the two logical final legs visible.
    if (unexpandedSourceIds.length) {
      await tx.$executeRaw(
        Prisma.sql`
          UPDATE "Match"
          SET
            "player1Id" = NULL,
            "player2Id" = NULL,
            "participant1EntryId" = CASE
              WHEN "bracketId" IS NOT NULL AND MOD(COALESCE("legNumber", 1), 2) = 0
                THEN "participant2EntryId"
              ELSE "participant1EntryId"
            END,
            "participant2EntryId" = CASE
              WHEN "bracketId" IS NOT NULL AND MOD(COALESCE("legNumber", 1), 2) = 0
                THEN "participant1EntryId"
              ELSE "participant2EntryId"
            END,
            "status" = 'PENDING'::"MatchStatus",
            "isCaptainAssignedTeamMatch" = true
          WHERE "id" IN (${Prisma.join(unexpandedSourceIds)})
        `,
      );
    }

    if (rowsToCreate.length) {
      await tx.match.createMany({ data: rowsToCreate });
    }

    return expansionPlan.length;
  }, { timeout: 15_000 });
}
