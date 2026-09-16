import { Prisma, StageType, TournamentStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { unstable_cache } from "next/cache";
import { getTournamentClubs } from "@/lib/clubs";
import { buildLeagueTable } from "@/lib/tournament-public-view";
import { tournamentParticipantsTag, tournamentScheduleTag, tournamentStructureTag } from "@/lib/tournament-cache";
import { normalizeFormatBlueprint } from "@/lib/format-blueprint";
import { isAdvancedStageGraphBlueprint } from "@/lib/tournaments/tournament-edit-sync";
import { isSupersededCaptainTeamSeriesArchive } from "@/lib/tournaments/captain-team-series-assignment";
import { playedForPodiumEntry, resolvePodiumSeries, type PodiumPlace } from "@/lib/tournaments/podium";

export type PlayerPodiumEntry = {
  id: string;
  tournamentId: string;
  title: string;
  stageLabel: string | null;
  place: PodiumPlace;
  date: string;
};
export type PlayerPodiumHistory = { entries: PlayerPodiumEntry[]; page: number; hasMore: boolean };
const PAGE_SIZE = 6;

function getLeaguePodium(tournamentId: string, stageId: string) {
  return unstable_cache(async () => {
    const [participants, matches, stage, clubs] = await Promise.all([
      db.tournamentRegistration.findMany({ where: { tournamentId }, select: { id: true, userId: true, status: true, notes: true, clubSlug: true, clubName: true, clubBadgePath: true, teamName: true, user: { select: { id: true, name: true } } } }),
      db.match.findMany({ where: { stageId, status: { in: ["CONFIRMED", "FINISHED"] }, isPenaltyTiebreak: false, excludeFromTournamentStandings: false }, select: { status: true, player1Id: true, player2Id: true, participant1EntryId: true, participant2EntryId: true, player1Score: true, player2Score: true } }),
      db.tournamentStage.findUnique({ where: { id: stageId }, select: { pointsForWin: true, pointsForDraw: true, pointsForLoss: true } }),
      getTournamentClubs(tournamentId),
    ]);
    const table = buildLeagueTable(participants, matches, new Map(clubs.map((club) => [club.slug, club])), stage ?? {});
    return table.slice(0, 3).flatMap((row, index) => {
      const registration = participants.find((item) => item.userId === row.playerId && item.status !== "REMOVED" && item.status !== "REJECTED");
      return registration && row.played > 0 ? [{ participantId: registration.id, rank: index + 1 }] : [];
    });
  }, ["profile-league-podium-v1", tournamentId, stageId], { revalidate: 300, tags: [tournamentScheduleTag(tournamentId), tournamentStructureTag(tournamentId), tournamentParticipantsTag(tournamentId)] })();
}

const matchSelect = {
  id: true, matchNumber: true, status: true, seriesKey: true, seriesWinsRequired: true, legNumber: true,
  isPenaltyTiebreak: true, isCaptainAssignedTeamMatch: true, isTeamCaptainTiebreak: true, isThirdPlaceMatch: true,
  player1Id: true, player2Id: true, participant1EntryId: true, participant2EntryId: true,
  winnerId: true, winnerEntryId: true, player1Score: true, player2Score: true,
  player1PenaltyScore: true, player2PenaltyScore: true, finishedAt: true, updatedAt: true,
  lineupPlayers: { select: { side: true, userId: true } },
} satisfies Prisma.MatchSelect;

export function parsePodiumPage(value?: string) {
  const page = Number(value);
  return Number.isSafeInteger(page) && page > 0 ? Math.min(page, 10000) : 1;
}

/** Paginate participating tournaments; fetch only final rounds or the top three standings. */
export async function getPlayerPodiumHistory(userId: string, page = 1): Promise<PlayerPodiumHistory> {
  const participation: Prisma.MatchWhereInput = { OR: [{ player1Id: userId }, { player2Id: userId }, { lineupPlayers: { some: { userId } } }] };
  const tournaments = await db.tournament.findMany({
    where: { status: TournamentStatus.COMPLETED, isTest: false, matches: { some: participation } },
    orderBy: [{ endsAt: { sort: "desc", nulls: "last" } }, { id: "desc" }],
    skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE + 1,
    select: {
      id: true, title: true, participantMode: true, endsAt: true, updatedAt: true, format: true, formatBlueprintJson: true,
      stages: { orderBy: { orderIndex: "desc" }, select: {
        id: true, name: true, type: true, settingsJson: true, bracket: { select: { id: true, type: true } },
        groups: { take: 2, select: { id: true } },
      } },
    },
  });
  const rows = await Promise.all(tournaments.slice(0, PAGE_SIZE).map(async (tournament): Promise<PlayerPodiumEntry[]> => {
    const graph = tournament.format === "CUSTOM" ? normalizeFormatBlueprint(tournament.formatBlueprintJson).stageGraph : undefined;
    const stages = graph && isAdvancedStageGraphBlueprint(graph)
      ? tournament.stages.filter((stage) => {
        const settings = stage.settingsJson;
        const graphId = settings && typeof settings === "object" && !Array.isArray(settings) && typeof settings.graphId === "string" ? settings.graphId : stage.id;
        return !graph.transitions.some((transition) => transition.fromStageId === graphId);
      })
      : tournament.stages.some((stage) => stage.bracket)
        ? tournament.stages.filter((stage) => stage.bracket)
        : tournament.stages;
    const stageRows = await Promise.all(stages.map(async (stage): Promise<PlayerPodiumEntry[]> => {
      const date = (tournament.endsAt ?? tournament.updatedAt).toISOString();
      const award = (place: PodiumPlace, resolvedDate = date): PlayerPodiumEntry => ({ id: `${tournament.id}:${stage.id}`, tournamentId: tournament.id, title: tournament.title, stageLabel: stages.length > 1 ? stage.name : null, place, date: resolvedDate });
      if (!stage.bracket) {
        // Group qualification is not a tournament podium. Only a final, single league table qualifies.
        const settings = stage.settingsJson;
        const isCustomLeague = settings && typeof settings === "object" && !Array.isArray(settings) && settings.mode === "custom-league";
        if ((stage.type !== StageType.LEAGUE && !isCustomLeague) || stage.groups.length > 1) return [];
        const standings = stage.groups.length ? await db.groupStanding.findMany({
          where: { groupId: stage.groups[0].id, rank: { gte: 1, lte: 3 }, played: { gt: 0 } },
          select: { participantId: true, rank: true }, orderBy: { rank: "asc" }, take: 3,
        }) : await getLeaguePodium(tournament.id, stage.id);
        const matches = await db.match.findMany({
          where: { stageId: stage.id, ...participation, status: { in: ["CONFIRMED", "FINISHED", "FORFEIT"] }, isPenaltyTiebreak: false },
          select: matchSelect,
        });
        const standing = standings.find((item) => playedForPodiumEntry(matches, item.participantId, userId, tournament.participantMode));
        return standing?.rank === 1 || standing?.rank === 2 || standing?.rank === 3 ? [award(standing.rank)] : [];
      }
      const rounds = await db.match.groupBy({
        by: ["bracket"], where: { bracketId: stage.bracket.id, isThirdPlaceMatch: false, isPenaltyTiebreak: false }, _max: { round: true },
      });
      // Legacy layouts use the upper final for WINNER/RUNNER_UP (as in stage transitions).
      // Prefer an explicit grand final whenever the persisted bracket has one.
      const finalBracket = rounds.find((row) => row.bracket === "grand_final" || row.bracket === "grand") ?? rounds.find((row) => row.bracket === "upper");
      if (!finalBracket?._max.round) return [];
      const matches = await db.match.findMany({
        where: { bracketId: stage.bracket.id, OR: [{ bracket: finalBracket.bracket, round: finalBracket._max.round }, { isThirdPlaceMatch: true }] },
        select: matchSelect, orderBy: [{ legNumber: "asc" }, { updatedAt: "asc" }],
      });
      const final = matches.filter((match) => !match.isThirdPlaceMatch && !isSupersededCaptainTeamSeriesArchive(match));
      // An unfinished/ambiguous final does not produce any championship medals.
      if (new Set(final.map((match) => match.seriesKey ?? `match:${match.matchNumber}`)).size !== 1) return [];
      const result = resolvePodiumSeries(final);
      if (!result) return [];
      const finalDate = final.filter((match) => match.finishedAt).map((match) => match.finishedAt!.toISOString()).sort().at(-1) ?? date;
      if (playedForPodiumEntry(final, result.winnerEntryId, userId, tournament.participantMode)) return [award(1, finalDate)];
      if (playedForPodiumEntry(final, result.loserEntryId, userId, tournament.participantMode)) return [award(2, finalDate)];
      const bronze = matches.filter((match) => match.isThirdPlaceMatch && !isSupersededCaptainTeamSeriesArchive(match));
      const third = resolvePodiumSeries(bronze);
      if (!bronze.length && stage.bracket.type === "DOUBLE" && finalBracket.bracket !== "upper") {
        const lowerRound = rounds.find((row) => row.bracket === "lower")?._max.round;
        if (lowerRound) {
          const lowerFinal = await db.match.findMany({ where: { bracketId: stage.bracket.id, bracket: "lower", round: lowerRound }, select: matchSelect });
          const lowerResult = resolvePodiumSeries(lowerFinal);
          if (lowerResult && playedForPodiumEntry(lowerFinal, lowerResult.loserEntryId, userId, tournament.participantMode)) return [award(3, finalDate)];
        }
      }
      return third && playedForPodiumEntry(bronze, third.winnerEntryId, userId, tournament.participantMode) ? [award(3, finalDate)] : [];
    }));
    return stageRows.flat();
  }));
  return { entries: rows.flat(), page, hasMore: tournaments.length > PAGE_SIZE };
}
