import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import ts from "typescript";

const root = process.cwd();
const read = (...segments: string[]) => readFileSync(path.join(root, ...segments), "utf8");

// Guards the tag-based cache invalidation for the tournament detail page. Each
// data domain (rules/participants/schedule/structure) caches forever and is
// only busted when its data changes. If a mutation site loses its
// invalidateTournament* call, its cache goes stale until the 1h safety-net TTL —
// so these assertions pin the invalidation to every known write path.

test("tournament-cache exposes the four domain tags + invalidation helpers", () => {
  const cache = read("src", "lib", "tournament-cache.ts");
  for (const name of [
    "invalidateTournamentRules",
    "invalidateTournamentParticipants",
    "invalidateTournamentSchedule",
    "invalidateTournamentStructure",
    "invalidateTournamentAll",
    "getCachedTournamentRules",
    "getCachedTournamentParticipants",
    "getCachedTournamentSchedule",
    "getCachedTournamentStructure",
  ]) {
    assert.match(cache, new RegExp(`export function ${name}\\b`), `missing export ${name}`);
  }
  // Safety-net TTL so a missed invalidation self-heals instead of staying stale forever.
  assert.match(cache, /revalidate: CACHE_TTL_SECONDS/);
  assert.match(cache, /CACHE_TTL_SECONDS = 60 \* 60/);
});

test("tournament page reads from the cached slices, not a live findUnique", () => {
  const page = read("src", "app", "tournaments", "[id]", "page.tsx");
  assert.match(page, /getCachedTournamentRules\(params\.id\)/);
  assert.match(page, /getCachedTournamentParticipants\(params\.id\)/);
  assert.match(page, /getCachedTournamentSchedule\(params\.id\)/);
  assert.match(page, /getCachedTournamentStructure\(params\.id\)/);
  // noStore would defeat the per-domain cache — it must be gone.
  assert.doesNotMatch(page, /noStore\(\)/);
  // The cached matches array is shared; filter archive rows, then copy before the in-place sort.
  assert.match(page, /activePublicMatches = tournament\.matches\.filter\(/);
  assert.match(page, /isSupersededCaptainTeamSeriesArchive/);
  assert.match(page, /\[\.\.\.activePublicMatches\]\.sort\(/);
});

test("service hubs bust the caches they mutate", () => {
  const tournaments = read("src", "lib", "services", "tournaments.ts");
  // recalculateGroupStandings -> structure
  assert.match(tournaments, /invalidateTournamentStructure/);
  // syncTournamentLifecycleStatus -> rules (status)
  assert.match(tournaments, /invalidateTournamentRules/);
  // assignParticipantsToGroups -> participants
  assert.match(tournaments, /invalidateTournamentParticipants/);
  // resolveConfirmedMatch -> schedule + structure up front
  assert.match(tournaments, /invalidateTournamentSchedule/);

  const finalize = read("src", "lib", "tournaments", "finalize-confirmed-match.ts");
  // A confirmed match changes schedule + structure + rules together.
  assert.match(finalize, /invalidateTournamentSchedule/);
  assert.match(finalize, /invalidateTournamentStructure/);
  assert.match(finalize, /invalidateTournamentRules/);
});

test("mutation routes bust their domain caches", () => {
  const cases: Array<{ file: string[]; expect: RegExp }> = [
    // Editing can change rules, schedules, participants and the generated stage structure.
    { file: ["src", "app", "api", "admin", "tournaments", "[id]", "update", "route.ts"], expect: /invalidateTournamentAll/ },
    // SCHEDULE
    { file: ["src", "app", "api", "matches", "[id]", "submit", "route.ts"], expect: /invalidateTournamentSchedule/ },
    { file: ["src", "app", "api", "admin", "schedule", "route.ts"], expect: /invalidateTournamentSchedule/ },
    { file: ["src", "app", "api", "admin", "matches", "[id]", "route.ts"], expect: /invalidateTournamentSchedule/ },
    { file: ["src", "app", "api", "admin", "matches", "[id]", "review", "route.ts"], expect: /invalidateTournamentSchedule/ },
    { file: ["src", "app", "api", "admin", "tournaments", "[id]", "matches", "reorder", "route.ts"], expect: /invalidateTournamentSchedule/ },
    { file: ["src", "app", "api", "admin", "tournaments", "[id]", "matches", "random-scores", "route.ts"], expect: /invalidateTournamentSchedule/ },
    { file: ["src", "app", "api", "admin", "tournaments", "[id]", "deadlines", "route.ts"], expect: /invalidateTournamentSchedule/ },
    // STRUCTURE
    { file: ["src", "app", "api", "admin", "stages", "[id]", "route.ts"], expect: /invalidateTournamentStructure/ },
    { file: ["src", "app", "api", "admin", "standings", "[id]", "route.ts"], expect: /invalidateTournamentStructure/ },
    { file: ["src", "app", "api", "admin", "tournaments", "[id]", "bracket", "slots", "route.ts"], expect: /invalidateTournamentStructure/ },
    { file: ["src", "app", "api", "admin", "tournaments", "[id]", "playoff", "mapping", "route.ts"], expect: /invalidateTournamentStructure/ },
    // ALL (regenerate/lifecycle)
    { file: ["src", "app", "api", "admin", "tournaments", "[id]", "route.ts"], expect: /invalidateTournamentAll/ },
    { file: ["src", "app", "api", "admin", "tournaments", "[id]", "stages", "generate", "route.ts"], expect: /invalidateTournamentAll/ },
    { file: ["src", "app", "api", "admin", "tournaments", "[id]", "playoff", "from-groups", "route.ts"], expect: /invalidateTournamentAll/ },
    // PARTICIPANTS
    { file: ["src", "app", "api", "tournaments", "[id]", "register", "route.ts"], expect: /invalidateTournamentParticipants/ },
    { file: ["src", "app", "api", "tournaments", "[id]", "roster", "invite", "route.ts"], expect: /invalidateTournamentParticipants/ },
    { file: ["src", "app", "api", "tournaments", "[id]", "roster", "respond", "route.ts"], expect: /invalidateTournamentParticipants/ },
    { file: ["src", "app", "api", "admin", "tournaments", "[id]", "participants", "route.ts"], expect: /invalidateTournamentAll/ },
    { file: ["src", "app", "api", "admin", "tournaments", "[id]", "applications", "[applicationId]", "route.ts"], expect: /invalidateTournamentParticipants/ },
  ];

  for (const { file, expect } of cases) {
    assert.match(read(...file), expect, `${file.join("/")} is missing ${expect}`);
  }
});

test("telegram callback roster + score paths bust their caches", () => {
  const callbacks = read("src", "lib", "services", "telegram-callbacks.ts");
  assert.match(callbacks, /invalidateTournamentParticipants/);
  assert.match(callbacks, /invalidateTournamentSchedule/);
});

test("a deployment after repair ignores legacy Redis slices and still invalidates fresh values", async () => {
  const values = new Map<string, unknown>([
    ["tournament:cup:rules", { status: "COMPLETED" }],
    ["tournament:cup:structure", [{ status: "PENDING" }]],
  ]);
  let status = "IN_PROGRESS";
  const deps: Record<string, unknown> = {
    "next/cache": { unstable_cache: (loader: unknown) => loader, revalidateTag: () => undefined },
    "@/lib/db": { db: {
      tournament: { findUnique: async () => ({ status }) },
      tournamentStage: { findMany: async () => [{ status: "ACTIVE" }] },
    } },
    "@/lib/redis": { redisKey: (suffix: string) => suffix },
    "@/lib/redis-cache": {
      getOrSetRedisJson: async (key: string, loader: () => Promise<unknown>) => {
        if (values.has(key)) return values.get(key);
        const value = await loader(); values.set(key, value); return value;
      },
      deleteRedisKey: async (key: string) => { values.delete(key); },
    },
  };
  const cache: {
    getCachedTournamentRules?: (id: string) => Promise<{ status: string }>;
    getCachedTournamentStructure?: (id: string) => Promise<{ status: string }[]>;
    invalidateTournamentRules?: (id: string) => void;
  } = {};
  const compiled = ts.transpileModule(read("src", "lib", "tournament-cache.ts"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  new Function("require", "exports", compiled)((name: string) => deps[name], cache);
  assert.equal((await cache.getCachedTournamentRules!("cup")).status, "IN_PROGRESS");
  assert.deepEqual(await cache.getCachedTournamentStructure!("cup"), [{ status: "ACTIVE" }]);
  status = "COMPLETED";
  assert.equal((await cache.getCachedTournamentRules!("cup")).status, "IN_PROGRESS");
  cache.invalidateTournamentRules!("cup");
  assert.equal((await cache.getCachedTournamentRules!("cup")).status, "COMPLETED");
});
