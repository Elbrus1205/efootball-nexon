import {
  MatchupFormat,
  Prisma,
  SeedingMethod,
  SortRule,
  TournamentFormat,
  TournamentParticipantMode,
  TournamentStatus,
} from "@prisma/client";
import { db } from "@/lib/db";
import { normalizeStageGraph, validateStageGraph } from "@/lib/tournament-stage-graph";
import { generateTournamentStages } from "@/lib/services/tournaments";

const nationalDivisions = [
  ["england", "АПЛ"],
  ["spain", "Ла Лига"],
  ["germany", "Бундеслига"],
  ["italy", "Серия А"],
  ["france", "Лига 1"],
].map(([id, name]) => ({ id, name, participantsCount: 20, roundsCount: 38, matchesPerOpponent: 2 }));

const europeanDivisions = [
  ["ucl-league", "Лига чемпионов"],
  ["uel-league", "Лига Европы"],
  ["uecl-league", "Лига конференций"],
].map(([id, name]) => ({ id, name, participantsCount: 20, roundsCount: 8, matchesPerOpponent: 1 }));

const transitions: Array<Record<string, unknown>> = [];
for (const division of nationalDivisions) {
  transitions.push({ id: `${division.id}-ucl`, fromStageId: "national", fromDivisionId: division.id, toStageId: "europe", toDivisionId: "ucl-league", result: "RANK", fromRank: 1, toRank: 6 });
  transitions.push({ id: `${division.id}-uel`, fromStageId: "national", fromDivisionId: division.id, toStageId: "europe", toDivisionId: "uel-league", result: "RANK", fromRank: 7, toRank: 12 });
  transitions.push({ id: `${division.id}-uecl`, fromStageId: "national", fromDivisionId: division.id, toStageId: "europe", toDivisionId: "uecl-league", result: "RANK", fromRank: 13, toRank: 18 });
}
for (const [source, target] of [["ucl-league", "ucl-playoff"], ["uel-league", "uel-playoff"], ["uecl-league", "uecl-playoff"]]) {
  transitions.push({ id: `${source}-top8`, fromStageId: "europe", fromDivisionId: source, toStageId: target, result: "RANK", fromRank: 1, toRank: 8 });
}

const graph = normalizeStageGraph({
  mode: "VISUAL",
  stages: [
    { id: "national", name: "Национальные лиги", type: "LEAGUE", divisions: nationalDivisions, divisionsCount: 5 },
    { id: "europe", name: "Еврокубки — этап лиг", type: "LEAGUE", divisions: europeanDivisions, divisionsCount: 3 },
    { id: "ucl-playoff", name: "Плей-офф ЛЧ", type: "PLAYOFF", bracketSize: 8 },
    { id: "uel-playoff", name: "Плей-офф ЛЕ", type: "PLAYOFF", bracketSize: 8 },
    { id: "uecl-playoff", name: "Плей-офф ЛК", type: "PLAYOFF", bracketSize: 8 },
  ],
  transitions,
  superCup: { enabled: true, stageId: "supercup", name: "Суперкубок", sourcePlayoffIds: ["ucl-playoff", "uel-playoff"], result: "WINNER", bracketSize: 2 },
});

const issues = validateStageGraph(graph);
if (issues.length) throw new Error(issues.map((issue) => issue.message).join(" "));

async function main(): Promise<void> {
  const creator = await db.user.findFirst({ orderBy: { createdAt: "asc" }, select: { id: true } });
  if (!creator) throw new Error("В базе данных нет пользователя, которого можно назначить создателем турнира.");

  const startsAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const tournament = await db.tournament.create({
  data: {
    title: "Европейский клубный сезон — тест",
    slug: `european-club-season-test-${Date.now()}`,
    description: "",
    rules: "Из каждой национальной лиги места 1–6 выходят в Лигу чемпионов, места 7–12 — в Лигу Европы, места 13–18 — в Лигу конференций, места 19–20 завершают турнир. В каждой еврокубковой лиге проводится 8 туров. Далее без изменений: из каждой евролиги места 1–8 выходят в отдельный плей-офф (четвертьфинал, полуфинал, финал). Суперкубок разыгрывают победители Лиги чемпионов и Лиги Европы.",
    startsAt,
    registrationEndsAt: startsAt,
    maxParticipants: 100,
    participantMode: TournamentParticipantMode.SINGLE,
    rosterSize: 1,
    matchupFormat: MatchupFormat.SINGLE_MATCH,
    bestOfWins: 1,
    isTest: true,
    notificationsEnabled: false,
    telegramAutoPublish: false,
    format: TournamentFormat.CUSTOM,
    formatBlueprintJson: {
      version: 2,
      leagueStageName: "Национальные лиги",
      openingStageMode: "LEAGUE",
      divisionsCount: 5,
      roundsCount: 2,
      openingRoundsCount: 38,
      participantsPerGroup: 20,
      playoffs: [],
      stageGraph: graph,
    } as Prisma.InputJsonValue,
    status: TournamentStatus.DRAFT,
    seedingMethod: SeedingMethod.MANUAL,
    sortRules: [SortRule.POINTS, SortRule.GOAL_DIFFERENCE, SortRule.GOALS_FOR, SortRule.WINS],
    autoCreateMatches: false,
    autoCreateSchedule: false,
    autoOpenRegistration: false,
    autoAdvanceFromGroups: true,
    createdById: creator.id,
  },
  });

  try {
    const stages = await generateTournamentStages(tournament.id);
    console.log(JSON.stringify({ tournamentId: tournament.id, title: tournament.title, stages: stages.map((stage) => ({ id: stage.id, name: stage.name, type: stage.type })) }, null, 2));
  } catch (error) {
    await db.tournament.delete({ where: { id: tournament.id } });
    throw error;
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
}).finally(() => db.$disconnect());
