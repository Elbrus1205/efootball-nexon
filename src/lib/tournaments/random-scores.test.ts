import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as prisma from "@prisma/client";
import { NextResponse } from "next/server";
import { resolveCaptainTeamPlayoffAggregate } from "./captain-team-playoff";

function setup(options: { count?: number; achievementsFail?: boolean; resolutionFails?: boolean; notificationsEnabled?: boolean } = {}) {
  const state = { lifecycle: 0, preparations: 0, standings: 0, snapshots: [] as string[], achievements: 0, achievementUsers: [] as string[], invalidations: 0, penalties: 0, assignments: [] as Array<{ matchId: string; userId: string; slot: number }>, background: [] as Array<() => Promise<void>> };
  const matches = Array.from({ length: options.count ?? 16 }, (_, index) => ({
    id: `match-${index}`, tournamentId: "cup", stageId: "league", round: 1, matchNumber: index + 1,
    bracketId: null as string | null, seriesKey: null as string | null, seriesWinsRequired: null as number | null,
    nextMatchId: null as string | null, nextMatchSlot: null as number | null,
    legNumber: 1, seriesMatchNumber: 1, playoffBracket: { legsCount: 1 },
    player1PenaltyScore: null as number | null, player2PenaltyScore: null as number | null,
    loserNextMatchId: null, loserNextMatchSlot: null, isPenaltyTiebreak: false,
    isCaptainAssignedTeamMatch: false, isTeamCaptainTiebreak: false,
    player1Id: `player-${index}-1`, player2Id: `player-${index}-2`,
    participant1EntryId: `entry-${index}-1`, participant2EntryId: `entry-${index}-2`,
    winnerId: null as string | null, winnerEntryId: null as string | null,
    player1Score: null as number | null, player2Score: null as number | null,
    status: prisma.MatchStatus.READY as prisma.MatchStatus, notes: null as string | null,
    stage: { type: prisma.StageType.LEAGUE },
    tournament: { participantMode: prisma.TournamentParticipantMode.SINGLE as prisma.TournamentParticipantMode, captainsCreateTeamMatches: false },
  }));
  type Fixture = typeof matches[number];
  const tournament = {
    id: "cup", notificationsEnabled: options.notificationsEnabled ?? true,
    stages: [{ id: "league", name: "Лига", type: prisma.StageType.LEAGUE, status: prisma.StageStatus.ACTIVE }], matches,
  };
  const db = {
    tournament: { findUnique: async () => tournament },
    match: {
      findUnique: async ({ where }: { where: { id: string } }) => matches.find((match) => match.id === where.id),
      update: async ({ where, data }: { where: { id: string }; data: Partial<Fixture> }) => {
        const match = matches.find((item) => item.id === where.id)!;
        Object.assign(match, data);
        return match;
      },
      findMany: async () => matches,
      updateMany: async () => ({ count: 0 }),
    },
    matchLineupPlayer: { findMany: async () => matches.flatMap((match) => [{ userId: match.player1Id }, { userId: match.player2Id }]) },
    adminAction: { create: async () => undefined },
    $transaction: async (writes: Array<Promise<Fixture>>) => Promise.all(writes),
  };
  const syncTournamentLifecycleStatus = async () => { state.lifecycle++; };
  const recalculateGroupStandings = async () => { state.standings++; };
  const prepareCaptainAssignedTeamMatchSlots = async () => { state.preparations++; };
  const modules: Record<string, unknown> = {
    "@prisma/client": prisma,
    "next/server": { NextResponse, after: (task: () => Promise<void>) => state.background.push(task) },
    "@/lib/db": { db },
    "@/lib/auth/session": { requirePermission: async () => ({ user: { id: "admin" } }) },
    "@/lib/admin-tournament-access": { assertCanManageTournament: async () => undefined },
    "@/lib/achievements": { syncUserAchievementsForUsers: async (userIds: string[]) => {
      state.achievements++;
      state.achievementUsers.push(...userIds);
      if (options.achievementsFail) throw new Error("Achievement database timeout");
    } },
    "@/lib/tournaments/captain-team-matches": { prepareCaptainAssignedTeamMatchSlots },
    "@/lib/tournament-cache": { invalidateTournamentSchedule: () => { state.invalidations++; } },
  };
  function load(source: string, globals: Record<string, unknown> = {}) {
    const exports: Record<string, unknown> = {};
    const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    runInNewContext(compiled, {
      exports, console: { error: () => undefined },
      // Pin non-draw scores so the test is deterministic.
      Math: Object.assign(Object.create(Math), { random: (() => { let i = 0; return () => (++i % 2 ? 0.9 : 0.1); })() }),
      require: (name: string) => { assert.ok(name in modules, `Unexpected module ${name}`); return modules[name]; },
      ...globals,
    });
    return exports;
  }
  // Execute the actual resolver/advancement chain. Only database and expensive
  // tournament-wide I/O boundaries are replaced with deterministic counters.
  const serviceSource = readFileSync("src/lib/services/tournaments.ts", "utf8");
  const ast = ts.createSourceFile("tournaments.ts", serviceSource, ts.ScriptTarget.Latest, true);
  const names = new Set(["resolveConfirmedMatch", "advanceResolvedWinnerForMatch", "getMatchWinnerAndLoser", "resolveBestOfSeriesIfCompleted", "resolveCaptainTeamPlayoffSeriesIfCompleted"]);
  const functions = ast.statements.filter((node) => ts.isFunctionDeclaration(node) && node.name && names.has(node.name.text)).map((node) => node.getText(ast)).join("\n");
  const service = load(functions, {
    ...prisma, db, syncTournamentLifecycleStatus, recalculateGroupStandings, prepareCaptainAssignedTeamMatchSlots,
    syncMatchStatisticsExclusion: async () => { if (options.resolutionFails) throw new Error("Resolution failed"); },
    ensureMatchLineupSnapshot: async (id: string) => { state.snapshots.push(id); },
    assignParticipantToSeries: async (assignment: { matchId: string; userId: string; slot: number }) => { state.assignments.push(assignment); },
    createPenaltyMatch: async () => { state.penalties++; },
    resolveCaptainTeamPlayoffAggregate,
    getTeamCaptainIds: async () => new Map(matches.flatMap((match) => [[match.participant1EntryId, match.player1Id], [match.participant2EntryId, match.player2Id]])),
    invalidatePlayerRatings: () => undefined, invalidateTournamentSchedule: () => undefined, invalidateTournamentStructure: () => undefined,
  });
  modules["@/lib/services/tournaments"] = { ...service, syncTournamentLifecycleStatus, recalculateGroupStandings };
  const route = load(readFileSync("src/app/api/admin/tournaments/[id]/matches/random-scores/route.ts", "utf8")) as {
    POST: (request: Request, context: { params: Promise<{ id: string }> }) => Promise<Response>;
  };
  return {
    state, matches,
    run: () => route.POST(new Request("https://example.com/random-scores", { method: "POST" }), { params: Promise.resolve({ id: "cup" }) }),
    resolve: service.resolveConfirmedMatch as (id: string, options?: { deferTournamentSync: boolean }) => Promise<void>,
  };
}

test("random scores synchronize the tournament once per round, preserving every lineup", async () => {
  const { state, matches, run } = setup();
  const response = await run();
  assert.equal(response.status, 200);
  assert.equal(state.snapshots.length, matches.length);
  assert.equal(state.lifecycle, 1, "full tournament lifecycle must not run once per match");
  assert.equal(state.preparations, 1, "team slots must be prepared once per batch");
  assert.equal(state.standings, 1);
  assert.equal(state.achievements, 0, "career statistics must not delay the HTTP response");
  for (const task of state.background) await task();
  assert.equal(state.achievementUsers.length, matches.length * 2);
});

test("saved scores return an explicit warning if bracket finalization fails", async () => {
  const { run } = setup({ resolutionFails: true });
  const response = await run();
  const payload = await response.json() as { warning?: string; updatedCount: number };
  assert.equal(response.status, 200);
  assert.equal(payload.updatedCount, 16);
  assert.match(payload.warning ?? "", /Счёт сохранён/);
});

test("test tournaments do not schedule achievement notifications", async () => {
  const { run, state } = setup({ notificationsEnabled: false });
  await run();
  assert.equal(state.background.length, 0);
  assert.equal(state.achievements, 0);
});

for (const mode of ["single", "best-of", "penalty", "two-legs", "captain"] as const) {
  test(`batched ${mode} resolution advances the winner without a premature lifecycle sync`, async () => {
    const { state, matches, resolve } = setup({ count: mode === "best-of" || mode === "two-legs" ? 2 : 1 });
    for (const match of matches) {
      Object.assign(match, {
        bracketId: "bracket", seriesKey: "series", nextMatchId: "final", nextMatchSlot: 1,
        status: prisma.MatchStatus.CONFIRMED, player1Score: 3, player2Score: 1,
        player1Id: "winner", player2Id: "loser", participant1EntryId: "winner-entry", participant2EntryId: "loser-entry",
        winnerId: "winner", winnerEntryId: "winner-entry", isPenaltyTiebreak: mode === "penalty",
        seriesWinsRequired: mode === "best-of" ? 2 : null,
        playoffBracket: { legsCount: mode === "two-legs" ? 2 : 1 },
        isCaptainAssignedTeamMatch: mode === "captain",
        tournament: { participantMode: mode === "captain" ? prisma.TournamentParticipantMode.TEAM : prisma.TournamentParticipantMode.SINGLE, captainsCreateTeamMatches: mode === "captain" },
      });
    }
    await resolve(matches[0].id, { deferTournamentSync: true });
    assert.equal(state.assignments.length, 1);
    assert.equal(state.assignments[0].userId, "winner");
    assert.equal(state.assignments[0].matchId, "final");
    assert.equal(state.lifecycle, 0);
    assert.equal(state.preparations, 0);
    assert.equal(state.snapshots.length, 1);
  });
}

test("aggregate draw still creates penalties before the batch lifecycle sync", async () => {
  const { state, matches, resolve } = setup({ count: 2 });
  for (const match of matches) Object.assign(match, {
    bracketId: "bracket", seriesKey: "series", status: prisma.MatchStatus.CONFIRMED,
    player1Score: 2, player2Score: 2, playoffBracket: { legsCount: 2 },
  });
  await resolve(matches[0].id, { deferTournamentSync: true });
  assert.equal(state.penalties, 1);
  assert.equal(state.assignments.length, 0);
  assert.equal(state.lifecycle, 0);
});

test("an achievement failure after saved scores cannot turn the request into an error", async () => {
  const { state, matches, run } = setup({ achievementsFail: true });
  const response = await run();
  assert.equal(response.status, 200);
  assert.ok(matches.every((match) => match.status === prisma.MatchStatus.CONFIRMED));
  assert.equal(state.lifecycle, 1);
  assert.ok(state.invalidations > 0);
  for (const task of state.background) await task();
});

test("ordinary single-match confirmation still synchronizes immediately", async () => {
  const { state, matches, resolve } = setup({ count: 1 });
  matches[0].winnerId = matches[0].player1Id;
  await resolve(matches[0].id);
  assert.equal(state.lifecycle, 1);
  assert.equal(state.preparations, 1);
  assert.equal(state.snapshots.length, 1);
});
