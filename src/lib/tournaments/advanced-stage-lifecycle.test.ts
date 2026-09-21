import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import * as prisma from "@prisma/client";
import * as blueprint from "../format-blueprint";
import * as graphHelpers from "../tournament-stage-graph";
import * as podium from "./podium";
import type { PodiumMatch } from "./podium";
import * as editSync from "./tournament-edit-sync";

type Stage = {
  id: string; name: string; type: prisma.StageType; status: prisma.StageStatus;
  settingsJson: { mode: string; graphId: string }; startsAt: Date | null;
  groups: { id: string; orderIndex: number; standings: { participantId: string; rank: number }[] }[];
  matches: { status: prisma.MatchStatus }[];
  bracket: { id: string; size: number; type: string; legsCount: number; thirdPlaceMatch: boolean; matches: Record<string, unknown>[] } | null;
};
type Entry = { stageId: string; registrationId: string; sourceTransitionId: string; groupId: string | null; resultJson: unknown };

const serviceSource = ts.transpileModule(readFileSync("src/lib/services/tournaments.ts", "utf8") + `
  exports.advance = advanceAdvancedGraphStage;
  exports.generate = generateTournamentMatches;
  exports.results = getGraphPlayoffResults;
  exports.slots = createFirstRoundSlotEntries;
  generateTournamentMatches = effects.generate;
  createPlayoffMatches = effects.playoff;
`, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;

function fixture(dbOverrides: Record<string, unknown> = {}, moduleOverrides: Record<string, unknown> = {}) {
  const graph = graphHelpers.normalizeStageGraph({ mode: "VISUAL", stages: [
    { id: "national", type: "LEAGUE", divisions: [{ id: "england", participantsCount: 2 }] },
    { id: "europe", type: "LEAGUE", divisions: [{ id: "ucl", participantsCount: 2 }] },
  ], transitions: [{ id: "qualify", fromStageId: "national", fromDivisionId: "england", toStageId: "europe", toDivisionId: "ucl", result: "RANK", fromRank: 1, toRank: 2 }] });
  const stages: Stage[] = graph.stages.map((node, index) => ({
    id: `db-${node.id}`, name: node.name, type: prisma.StageType.LEAGUE,
    status: index === 0 ? prisma.StageStatus.ACTIVE : prisma.StageStatus.PENDING,
    settingsJson: { mode: "custom-graph", graphId: node.id }, startsAt: null,
    groups: [{ id: `group-${node.id}`, orderIndex: 1, standings: index === 0 ? [{ participantId: "a", rank: 1 }, { participantId: "b", rank: 2 }] : [] }],
    matches: index === 0 ? [{ status: prisma.MatchStatus.CONFIRMED }] : [], bracket: null,
  }));
  const entries: Entry[] = [];
  const tournament = {
    id: "cup", title: "European season", format: prisma.TournamentFormat.CUSTOM,
    status: prisma.TournamentStatus.IN_PROGRESS as prisma.TournamentStatus, notificationsEnabled: false, isTest: true,
    formatBlueprintJson: { stageGraph: graph }, matchupFormat: prisma.MatchupFormat.SINGLE_MATCH, bestOfWins: 1,
    participants: [{ id: "a", userId: "ua" }, { id: "b", userId: "ub" }], maxParticipants: 2,
    autoOpenRegistration: false, registrationStartsAt: null, startsAt: new Date(0), registrationClosedAt: new Date(0),
    stages, matches: [{ id: "played", stageId: "db-national", status: prisma.MatchStatus.CONFIRMED }],
  };
  const generated: { stageId: string; entries: { id: string; seed: number }[] }[] = [];
  let generations = 0;
  const db = {
    tournament: { findUnique: async () => structuredClone(tournament), update: async ({ data }: { data: Partial<typeof tournament> }) => Object.assign(tournament, data) },
    tournamentStage: {
      findMany: async () => stages.map(stage => ({ ...structuredClone(stage), _count: { matches: stage.matches.length, entries: entries.filter(entry => entry.stageId === stage.id).length } })),
      update: async ({ where, data }: { where: { id: string }; data: Partial<Stage> }) => Object.assign(stages.find(s => s.id === where.id)!, data),
    },
    tournamentStageEntry: {
      findMany: async ({ where }: { where: { stageId: string; sourceTransitionId?: { in: string[] } } }) => entries.filter(e => e.stageId === where.stageId && (!where.sourceTransitionId || where.sourceTransitionId.in.includes(e.sourceTransitionId))).map(e => ({ ...e, registration: { id: e.registrationId, userId: `u${e.registrationId}`, seed: null } })),
      upsert: async ({ create }: { create: Entry }) => { entries.push(create); return create; },
      createMany: async ({ data }: { data: Entry[] }) => { entries.push(...data); },
    },
    tournamentRegistration: { update: async () => undefined, updateMany: async () => undefined, findMany: async () => tournament.participants },
    groupStanding: { deleteMany: async () => undefined, upsert: async () => undefined, createMany: async () => undefined },
    match: { count: async ({ where }: { where: { bracketId?: string } }) => where.bracketId ? stages.find(s => s.bracket?.id === where.bracketId)?.bracket?.matches.length ?? 0 : 1, findMany: async () => tournament.matches },
    $transaction: async (queries: Promise<unknown>[] | ((tx: unknown) => Promise<unknown>)): Promise<unknown> => typeof queries === "function" ? queries(db) : Promise.all(queries),
  };
  const deps: Record<string, unknown> = {
    "@prisma/client": prisma, "@/lib/db": { db: { ...db, ...dbOverrides } }, "@/lib/format-blueprint": blueprint,
    "@/lib/tournament-stage-graph": graphHelpers,
    "@/lib/tournaments/podium": podium,
    "@/lib/services/telegram-publications": { publishTournamentCompletion: async () => undefined },
    ...moduleOverrides,
  };
  const service: {
    syncTournamentLifecycleStatus?: (id: string) => Promise<unknown>;
    advance?: (id: string, value: typeof tournament) => Promise<boolean>;
    generate?: (id: string) => Promise<unknown>;
    results?: (matches: (PodiumMatch & { round: number; bracket: string })[]) => graphHelpers.StageGraphPlayoffResult[];
    recalculateGroupStandings?: (id: string) => Promise<unknown>;
    synchronizeTournamentAfterEdit?: (params: Record<string, unknown>) => Promise<void>;
    slots?: (entries: { id: string; seed: number }[], size: number) => ({ id: string; seed: number } | null)[];
  } = {};
  new Function("require", "exports", "effects", serviceSource)(
    (name: string) => deps[name] ?? new Proxy({}, { get: () => () => undefined }), service,
    { generate: async () => { generations++; }, playoff: async (params: typeof generated[number]) => { generated.push(params); } },
  );
  return { tournament, stages, entries, graph, generated, service, generations: () => generations };
}

test("last national match advances to Europe instead of completing the tournament", async () => {
  const f = fixture();
  await f.service.syncTournamentLifecycleStatus!("cup");
  assert.equal(f.tournament.status, prisma.TournamentStatus.IN_PROGRESS);
  assert.equal(f.stages[0].status, prisma.StageStatus.COMPLETED);
  assert.equal(f.stages[1].status, prisma.StageStatus.ACTIVE);
  assert.deepEqual(f.entries.map(e => e.registrationId), ["a", "b"]);
  assert.equal(f.generations(), 1);
});

test("next-stage generation does not require an active opening stage", async () => {
  const f = fixture();
  f.stages[0].status = prisma.StageStatus.COMPLETED;
  f.stages[1].status = prisma.StageStatus.ACTIVE;
  f.stages[1].groups = [];
  await assert.doesNotReject(f.service.generate!("cup"));
});

test("repeated synchronization does not replay completed transitions", async () => {
  const f = fixture();
  f.stages[0].status = prisma.StageStatus.COMPLETED;
  await f.service.advance!("cup", f.tournament);
  const count = f.entries.length;
  assert.equal(await f.service.advance!("cup", f.tournament), false);
  assert.equal(f.entries.length, count);
});

test("a prematurely completed tournament resumes while later stages are pending", async () => {
  const f = fixture();
  f.tournament.status = prisma.TournamentStatus.COMPLETED;
  await f.service.syncTournamentLifecycleStatus!("cup");
  assert.equal(f.tournament.status, prisma.TournamentStatus.IN_PROGRESS);
  assert.equal(f.stages[1].status, prisma.StageStatus.ACTIVE);
});

test("the last terminal stage completes the tournament", async () => {
  const f = fixture();
  f.stages[0].status = prisma.StageStatus.COMPLETED;
  f.stages[1].status = prisma.StageStatus.ACTIVE;
  f.stages[1].matches = [{ status: prisma.MatchStatus.CONFIRMED }];
  await f.service.syncTournamentLifecycleStatus!("cup");
  assert.equal(f.stages[1].status, prisma.StageStatus.COMPLETED);
  assert.equal(f.tournament.status, prisma.TournamentStatus.COMPLETED);
});

test("a pending result or penalty keeps the source active", async () => {
  const f = fixture();
  f.stages[0].matches.push({ status: prisma.MatchStatus.RESULT_SUBMITTED });
  await f.service.syncTournamentLifecycleStatus!("cup");
  assert.equal(f.stages[0].status, prisma.StageStatus.ACTIVE);
  assert.equal(f.stages[1].status, prisma.StageStatus.PENDING);
  assert.equal(f.entries.length, 0);
  assert.equal(f.tournament.status, prisma.TournamentStatus.IN_PROGRESS);
});

test("a destination merges all completed sources and waits for unfinished sources", async () => {
  const f = fixture();
  f.graph.stages.push({ ...f.graph.stages[0], id: "other" });
  f.graph.transitions.push({ ...f.graph.transitions[0], id: "other-qualify", fromStageId: "other" });
  const other = structuredClone(f.stages[0]);
  other.id = "db-other";
  other.settingsJson.graphId = "other";
  other.groups[0].standings = [{ participantId: "c", rank: 1 }, { participantId: "d", rank: 2 }];
  other.matches = [{ status: prisma.MatchStatus.READY }];
  f.stages.push(other);
  await f.service.advance!("cup", f.tournament);
  assert.equal(f.stages[1].status, prisma.StageStatus.PENDING);
  assert.equal(f.entries.length, 0);
  other.matches[0].status = prisma.MatchStatus.CONFIRMED;
  await f.service.advance!("cup", f.tournament);
  assert.deepEqual(f.entries.map(e => e.registrationId), ["a", "b", "c", "d"]);
  assert.equal(f.stages[1].status, prisma.StageStatus.ACTIVE);
});

test("finishing Europe processes its outgoing transitions even after national qualification", async () => {
  const f = fixture();
  await f.service.advance!("cup", f.tournament);
  f.graph.stages.push({ ...f.graph.stages[1], id: "playoff" });
  f.graph.transitions.push({ ...f.graph.transitions[0], id: "europe-playoff", fromStageId: "europe", fromDivisionId: "ucl", toStageId: "playoff" });
  const next = structuredClone(f.stages[1]);
  next.id = "db-playoff";
  next.settingsJson.graphId = "playoff";
  next.status = prisma.StageStatus.PENDING;
  f.stages.push(next);
  f.stages[1].groups[0].standings = [{ participantId: "a", rank: 1 }, { participantId: "b", rank: 2 }];
  f.stages[1].matches = [{ status: prisma.MatchStatus.CONFIRMED }];
  await f.service.advance!("cup", f.tournament);
  assert.equal(next.status, prisma.StageStatus.ACTIVE);
  assert.deepEqual(f.entries.filter(e => e.stageId === next.id).map(e => e.registrationId), ["a", "b"]);
});

test("recovery retries generating matches for an activated stage", async () => {
  const f = fixture();
  await f.service.advance!("cup", f.tournament);
  await f.service.syncTournamentLifecycleStatus!("cup");
  assert.equal(f.generations(), 1);
  assert.equal(f.tournament.status, prisma.TournamentStatus.IN_PROGRESS);
});

function finalMatch(overrides: Partial<PodiumMatch> = {}): PodiumMatch & { round: number; bracket: string } {
  return {
    id: "final", matchNumber: 1, round: 1, bracket: "upper", status: "CONFIRMED", seriesKey: "final",
    seriesWinsRequired: null, legNumber: 1, isPenaltyTiebreak: false, isCaptainAssignedTeamMatch: false,
    isTeamCaptainTiebreak: false, isThirdPlaceMatch: false, player1Id: "ua", player2Id: "ub",
    participant1EntryId: "a", participant2EntryId: "b", winnerId: "ua", winnerEntryId: "a",
    player1Score: 2, player2Score: 0, player1PenaltyScore: null, player2PenaltyScore: null,
    finishedAt: new Date(0), updatedAt: new Date(0), lineupPlayers: [], ...overrides,
  };
}

test("Super Cup gathers both champions using the aggregate final score", async () => {
  const f = fixture();
  Object.assign(f.graph, graphHelpers.normalizeStageGraph({ mode: "VISUAL", stages: [
    { id: "ucl", type: "PLAYOFF", bracketSize: 2 }, { id: "uel", type: "PLAYOFF", bracketSize: 2 },
  ], superCup: { enabled: true, stageId: "supercup", sourcePlayoffIds: ["ucl", "uel"] } }));
  const ucl = [finalMatch(), finalMatch({ id: "return", legNumber: 2, player1Score: 0, player2Score: 3, winnerId: "ub", winnerEntryId: "b" })];
  const uel = [finalMatch({ participant1EntryId: "c", participant2EntryId: "d", winnerEntryId: "c", status: "READY" })];
  f.stages.splice(0, f.stages.length, ...f.graph.stages.map((node, index) => ({
    id: `db-${node.id}`, name: node.name, type: index === 2 ? prisma.StageType.SUPER_CUP : prisma.StageType.PLAYOFF,
    status: index === 2 ? prisma.StageStatus.PENDING : prisma.StageStatus.ACTIVE,
    settingsJson: { mode: "custom-graph", graphId: node.id }, startsAt: null, groups: [], matches: index === 0 ? ucl : index === 1 ? uel : [],
    bracket: { id: `bracket-${node.id}`, size: 2, type: "SINGLE", legsCount: 1, thirdPlaceMatch: false, matches: index === 0 ? ucl : index === 1 ? uel : [] },
  })));
  await f.service.advance!("cup", f.tournament);
  assert.equal(f.entries.length, 0);
  uel[0].status = "CONFIRMED";
  await f.service.advance!("cup", f.tournament);
  assert.deepEqual(f.entries.map(e => e.registrationId), ["b", "c"]);
  await f.service.generate!("cup");
  assert.deepEqual(f.generated[0].entries.map(e => e.id), ["b", "c"]);
});

test("qualification uses the Best Of champion and the confirmed penalty winner", () => {
  const f = fixture();
  const games = [
    finalMatch({ seriesWinsRequired: 2 }),
    finalMatch({ id: "g2", legNumber: 2, seriesWinsRequired: 2, winnerEntryId: "b" }),
    finalMatch({ id: "g3", legNumber: 3, seriesWinsRequired: 2, winnerEntryId: "b" }),
  ];
  assert.equal(f.service.results!(games).find(r => r.result === "WINNER")?.registrationId, "b");
  const tied = finalMatch({ player1Score: 0, player2Score: 0, winnerEntryId: null, winnerId: null });
  assert.equal(f.service.results!([tied]).some(r => r.result === "WINNER"), false);
  assert.equal(f.service.results!([tied, finalMatch({ id: "penalty", isPenaltyTiebreak: true, winnerEntryId: "b" })]).find(r => r.result === "WINNER")?.registrationId, "b");
});

test("recalculating after qualification retains the complete national standings", async () => {
  const writes: { participantId: string; played: number; points: number }[] = [];
  const deletions: unknown[] = [];
  const members = ["a", "b"].map(id => ({ id, status: prisma.ParticipantStatus.CONFIRMED, notes: null }));
  const group = {
    id: "national-group", members: [], stageEntries: members.map(registration => ({ registration })),
    matches: [finalMatch()], standings: members.map(m => ({ id: `standing-${m.id}`, participantId: m.id })),
    stage: { pointsForWin: 3, pointsForDraw: 1, pointsForLoss: 0 },
  };
  const f = fixture({
    tournamentGroup: { findMany: async () => [group] },
    groupStanding: {
      deleteMany: async (args: unknown) => { deletions.push(args); },
      upsert: async ({ create }: { create: typeof writes[number] }) => { writes.push(create); },
    },
  });
  await f.service.recalculateGroupStandings!("cup");
  assert.equal(deletions.length, 0);
  assert.deepEqual(writes.map(row => [row.participantId, row.played, row.points]), [["a", 1, 3], ["b", 1, 0]]);
});

test("top-eight qualification slots give byes only to ranks 1-8", () => {
  const f = fixture();
  const entries = Array.from({ length: 24 }, (_, index) => ({ id: `rank-${index + 1}`, seed: index < 8 ? index * 2 + 1 : index + 9 }));
  const slots = f.service.slots!(entries, 32);
  const byes: string[] = [];
  const preliminary: string[] = [];
  for (let index = 0; index < slots.length; index += 2) {
    const pair = [slots[index], slots[index + 1]].filter(entry => entry !== null);
    (pair.length === 1 ? byes : preliminary).push(...pair.map(entry => entry.id));
  }
  assert.deepEqual(byes, entries.slice(0, 8).map(entry => entry.id));
  assert.deepEqual(preliminary, entries.slice(8).map(entry => entry.id));
});

test("editing an ungenerated playoff persists its two-leg setting without touching played brackets", async () => {
  const writes: unknown[] = [];
  const f = fixture({ playoffBracket: { update: async (args: unknown) => { writes.push(args); } } }, {
    "@/lib/tournaments/tournament-edit-sync": {
      ...editSync,
      planTournamentEditSynchronization: () => ({ expected: { opening: null, playoffs: [] }, scheduleShiftMs: 0, rebuildOpening: false, rebuildPlayoffs: false, recalculateStandings: false }),
    },
  });
  Object.assign(f.graph, graphHelpers.normalizeStageGraph({ mode: "VISUAL", stages: [{ id: "ucl", type: "PLAYOFF", bracketSize: 32, legsCount: 2 }] }));
  const stage = f.stages[0];
  stage.type = prisma.StageType.PLAYOFF;
  stage.settingsJson.graphId = "ucl";
  stage.bracket = { id: "bracket", size: 32, type: "SINGLE", legsCount: 1, thirdPlaceMatch: false, matches: [] };
  f.stages.splice(1);
  await f.service.synchronizeTournamentAfterEdit!({ tournamentId: "cup", previousBlueprintJson: f.tournament.formatBlueprintJson });
  assert.equal((writes[0] as { data: { legsCount: number } }).data.legsCount, 2);
  stage.bracket.matches.push({ id: "played" });
  await f.service.synchronizeTournamentAfterEdit!({ tournamentId: "cup", previousBlueprintJson: f.tournament.formatBlueprintJson });
  assert.equal(writes.length, 1);
});
