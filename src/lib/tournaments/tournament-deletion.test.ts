import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { MatchStatus, UserRole } from "@prisma/client";
import { NextResponse } from "next/server";

type Archive = { tournaments: number; prizePool: number; users: number; online: number };

function setup(options: { trainee?: boolean; archiveFails?: boolean; deleteFails?: boolean } = {}) {
  const state = { deleted: false, archive: { tournaments: 2, prizePool: 5000, users: 0, online: 0 } as Archive, tags: [] as string[], paths: [] as string[], ratings: 0 };
  const store = {
    tournament: {
      findUnique: async () => state.deleted ? null : ({ title: "VICTORY CUP", prizePool: "3 000 ₽" }),
      delete: async () => { if (options.deleteFails) throw new Error("Delete failed"); state.deleted = true; },
    },
    siteContent: {
      findUnique: async () => ({ body: JSON.stringify(state.archive) }),
      upsert: async (args: { update: { body: string } }) => {
        if (options.archiveFails) throw new Error("Archive failed");
        state.archive = JSON.parse(args.update.body) as Archive;
      },
    },
  };
  const db = { ...store, $transaction: async (callback: (tx: typeof store) => Promise<void>) => {
    const before = { ...state.archive };
    try { await callback(store); } catch (error) { state.archive = before; throw error; }
  } };
  const modules: Record<string, unknown> = {
    "next/server": { NextResponse },
    "next/cache": { revalidateTag: (tag: string) => state.tags.push(tag), revalidatePath: (path: string) => state.paths.push(path) },
    "@prisma/client": { UserRole, MatchStatus },
    "@/lib/auth/session": { requirePermission: async () => ({ user: { role: options.trainee ? UserRole.TRAINEE : UserRole.FOUNDER } }) },
    "@/lib/admin-tournament-access": { assertCanManageTournament: async () => undefined },
    "@/lib/affiliate": { getRequestBaseUrl: () => "https://example.com" },
    "@/lib/db": { db },
    "@/lib/tournament-cache": { invalidateTournamentAll: () => undefined },
    "@/lib/ratings-cache": { invalidatePlayerRatings: () => state.ratings++ },
    "@/lib/services/tournaments": {},
  };
  function load(file: string): Record<string, unknown> {
    const exports: Record<string, unknown> = {};
    const compiled = ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    runInNewContext(compiled, { exports, URL, require: (name: string) => {
      assert.ok(name in modules, `Unexpected dependency ${name}`);
      return modules[name];
    } }, { filename: file });
    return exports;
  }
  // Execute the real archive helper and actual route, replacing only their I/O boundaries.
  modules["@/lib/home-stats"] = load("src/lib/home-stats.ts");
  const route = load("src/app/api/admin/tournaments/[id]/route.ts") as {
    POST: (request: Request, context: { params: Promise<{ id: string }> }) => Promise<Response>;
  };
  async function remove(confirmation?: string, preserve = false) {
    const data = new FormData();
    data.set("_method", "delete");
    if (confirmation !== undefined) data.set("confirmationTitle", confirmation);
    if (preserve) data.set("preserveHomeStats", "on");
    return route.POST(new Request("https://example.com/api/admin/tournaments/victory", { method: "POST", body: data }), { params: Promise.resolve({ id: "victory" }) });
  }
  return { state, remove };
}

for (const confirmation of [undefined, "", "Another tournament"]) {
  test(`unconfirmed deletion is rejected (${String(confirmation)})`, async () => {
    const { state, remove } = setup();
    const response = await remove(confirmation, true);
    assert.equal(state.deleted, false);
    assert.equal(state.archive.tournaments, 2);
    assert.equal(state.archive.prizePool, 5000);
    assert.match(new URL(response.headers.get("location")!).searchParams.get("warning")!, /не подтверждено/);
  });
}

test("confirmed deletion preserves homepage totals and immediately invalidates homepage and ratings", async () => {
  const { state, remove } = setup();
  const response = await remove("VICTORY CUP", true);
  assert.equal(response.status, 303);
  assert.equal(state.deleted, true);
  assert.deepEqual(state.archive, { tournaments: 3, prizePool: 8000, users: 0, online: 0 });
  assert.deepEqual(state.tags, ["home-stats"]);
  assert.deepEqual(state.paths, ["/"]);
  assert.equal(state.ratings, 1);
  assert.match(new URL(response.headers.get("location")!).searchParams.get("warning")!, /сохранены/);
});

test("unchecked preservation does not add archived totals", async () => {
  const { state, remove } = setup();
  await remove("VICTORY CUP");
  assert.equal(state.deleted, true);
  assert.equal(state.archive.prizePool, 5000);
});

test("trainee cannot delete even with confirmation", async () => {
  const { state, remove } = setup({ trainee: true });
  await remove("VICTORY CUP", true);
  assert.equal(state.deleted, false);
  assert.equal(state.archive.tournaments, 2);
});

for (const failure of ["archiveFails", "deleteFails"] as const) {
  test(`${failure}: deletion and archive remain atomic`, async () => {
    const { state, remove } = setup({ [failure]: true });
    await remove("VICTORY CUP", true);
    assert.equal(state.deleted, false);
    assert.equal(state.archive.tournaments, 2);
    assert.equal(state.archive.prizePool, 5000);
    assert.deepEqual(state.tags, []);
  });
}

test("both admin entry points reuse the guarded deletion component", () => {
  for (const file of ["src/app/admin/tournaments/page.tsx", "src/app/admin/tournaments/[id]/page.tsx"]) {
    const source = readFileSync(file, "utf8");
    assert.match(source, /<DeleteTournamentButton/);
    assert.doesNotMatch(source, /name="_method" value="delete"/);
  }
  assert.match(readFileSync("src/app/page.tsx", "utf8"), /tags: \[HOME_STATS_CACHE_TAG\]/);
});
