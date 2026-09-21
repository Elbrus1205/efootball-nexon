import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { Prisma, StageType } from "@prisma/client";
import { db } from "../src/lib/db";
import { normalizeFormatBlueprint } from "../src/lib/format-blueprint";
import { validateStageGraph } from "../src/lib/tournament-stage-graph";

// Read-only unless --apply is supplied. Run with node --env-file=.env --import tsx.
// This repair preserves every existing match, lineup snapshot and standing.
async function main() {
  const tournamentId = process.argv[2];
  assert.ok(tournamentId && !tournamentId.startsWith("--"), "Pass the tournament ID, optionally followed by --apply.");
  const tournament = await db.tournament.findUniqueOrThrow({
    where: { id: tournamentId },
    include: {
      stages: { include: { groups: { include: { standings: { orderBy: { id: "asc" } } } }, bracket: true }, orderBy: { orderIndex: "asc" } },
      participants: { select: { id: true, groupId: true, status: true } },
    },
  });
  const originalMatches = await db.match.findMany({ where: { tournamentId }, include: { lineupPlayers: { orderBy: { id: "asc" } } }, orderBy: { id: "asc" } });
  const blueprint = normalizeFormatBlueprint(tournament.formatBlueprintJson);
  const graph = blueprint.stageGraph;
  assert.ok(graph && graph.stages.some(stage => stage.id === "national") && graph.stages.some(stage => stage.id === "europe"), "Expected the European season graph.");
  const national = tournament.stages.find(stage => stage.type === StageType.LEAGUE && stage.orderIndex === 1);
  assert.ok(national, "National stage is missing.");
  const nationalMatches = originalMatches.filter(match => match.stageId === national.id);
  assert.ok(nationalMatches.length && nationalMatches.every(match => ["CONFIRMED", "FINISHED", "FORFEIT", "CANCELLED"].includes(match.status)), "National leagues must be finished before repair.");
  assert.ok(national.groups.every(group => group.standings.length && group.standings.every(standing => standing.rank !== null)), "National standings must have final ranks.");
  for (const node of graph.stages) {
    if (["ucl-playoff", "uel-playoff", "uecl-playoff"].includes(node.id)) node.legsCount = 2;
    if (node.id === "europe") for (const division of node.divisions) division.participantsCount = 30;
  }
  for (const transition of graph.transitions) {
    if (transition.fromStageId === "europe" && transition.fromRank === 9 && transition.toRank === 24) {
      transition.toSlotStart = 17;
      transition.toSlotStep = 1;
    }
  }
  assert.deepEqual(validateStageGraph(graph), [], "Repaired configuration must validate.");
  console.log(JSON.stringify({ id: tournamentId, title: tournament.title, status: tournament.status, existingMatches: originalMatches.length, changes: "30 teams per European league; two-leg playoffs; top-eight byes; resume progression", apply: process.argv.includes("--apply") }));
  if (!process.argv.includes("--apply")) return;
  assert.ok(originalMatches.every(match => match.stageId === national.id), "Repair only applies before any European match has been created.");
  const backupPath = `db-backups/european-progression-${tournamentId}-${Date.now()}.json`;
  await mkdir("db-backups", { recursive: true });
  await writeFile(backupPath, JSON.stringify({ tournament, matches: originalMatches }, null, 2), { encoding: "utf8", flag: "wx" });
  console.log(`Backup: ${backupPath}`);
  await db.$transaction(async tx => {
    await tx.tournament.update({ where: { id: tournamentId }, data: { formatBlueprintJson: blueprint as Prisma.InputJsonValue } });
    for (const stage of tournament.stages) {
      const settings = stage.settingsJson && typeof stage.settingsJson === "object" && !Array.isArray(stage.settingsJson) ? stage.settingsJson : {};
      const node = graph.stages.find(item => item.id === settings.graphId);
      if (!node || node.id === "national") continue;
      await tx.tournamentStage.update({ where: { id: stage.id }, data: { settingsJson: {
        ...settings, divisions: node.divisions, transitions: graph.transitions.filter(item => item.fromStageId === node.id || item.toStageId === node.id),
      } as Prisma.InputJsonValue } });
      if (stage.bracket) await tx.playoffBracket.update({ where: { id: stage.bracket.id }, data: { legsCount: node.legsCount ?? 1, settingsJson: {
        mode: "custom-graph", graphId: node.id, transitions: graph.transitions.filter(item => item.toStageId === node.id),
        bestOfWins: node.bestOfWins, bracketFill: node.bracketFill, penaltyRule: node.penaltyRule, seedingMethod: node.seedingMethod,
      } as Prisma.InputJsonValue } });
      if (node.id === "europe") await tx.tournamentGroup.updateMany({ where: { stageId: stage.id }, data: { capacity: 30 } });
    }
  }, { timeout: 30_000 });

  // Next tag invalidation requires an HTTP request. Suppress only that adapter
  // in this CLI process; the service still invalidates the shared Redis keys.
  // Deploy the updated cache namespace alongside the lifecycle fix.
  const repairRequire = createRequire(import.meta.url);
  const cacheExports: Record<string, unknown> = repairRequire("next/cache");
  const cacheModule = repairRequire.cache[repairRequire.resolve("next/cache")];
  assert.ok(cacheModule);
  cacheModule.exports = { ...cacheExports, revalidateTag: () => undefined };
  try {
    const { syncTournamentLifecycleStatus } = await import("../src/lib/services/tournaments");
    await syncTournamentLifecycleStatus(tournamentId, { notify: false });
    // Repeat the real service operation to verify recovery is idempotent.
    await syncTournamentLifecycleStatus(tournamentId, { notify: false });
  } finally {
    cacheModule.exports = cacheExports;
  }
  const preservedMatches = await db.match.findMany({ where: { id: { in: originalMatches.map(match => match.id) } }, include: { lineupPlayers: { orderBy: { id: "asc" } } }, orderBy: { id: "asc" } });
  assert.deepEqual(preservedMatches, originalMatches, "Existing match history and lineup snapshots must remain unchanged.");
  for (const group of national.groups) {
    assert.deepEqual(await db.groupStanding.findMany({ where: { groupId: group.id }, orderBy: { id: "asc" } }), group.standings, "National standings must remain unchanged.");
  }
  const status = await db.tournament.findUniqueOrThrow({ where: { id: tournamentId }, select: { status: true } });
  const stages = await db.tournamentStage.findMany({ where: { tournamentId }, orderBy: { orderIndex: "asc" }, select: { name: true, status: true, _count: { select: { entries: true, matches: true } } } });
  assert.equal(status.status, "IN_PROGRESS");
  assert.equal(stages[1]._count.entries, 90);
  assert.equal(stages[1]._count.matches, 360);
  console.log(JSON.stringify({ ...status, stages, preservedMatches: preservedMatches.length, nationalStandingsPreserved: true }, null, 2));
}

main().catch((error: unknown) => { console.error(error); process.exitCode = 1; }).finally(async () => {
  await db.$disconnect();
  const { redis } = await import("../src/lib/redis");
  redis.disconnect();
});
