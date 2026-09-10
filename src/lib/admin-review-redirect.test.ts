import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import { NextResponse } from "next/server";

// Exercise the actual route with its database and side effects replaced.
const source = readFileSync("src/app/api/admin/matches/[id]/review/route.ts", "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const noop = async () => undefined;
const dependencies: Record<string, unknown> = {
  "next/server": { NextResponse },
  "@prisma/client": { MatchStatus: { DISPUTED: "DISPUTED" } },
  "@/lib/auth/session": { requireAnyPermission: async () => ({ user: { id: "admin" } }) },
  "@/lib/db": { db: {
    matchResultSubmission: { findFirst: async () => null },
    match: {
      findUnique: async () => ({ id: "match", tournamentId: "cup", tournament: { notificationsEnabled: false } }),
      update: noop,
    },
  } },
  "@/lib/validators": { reviewSchema: { parse: (value: unknown) => value } },
};
const route: { POST?: (request: Request, props: { params: Promise<{ id: string }> }) => Promise<Response> } = {};
new Function("require", "exports", compiled)((name: string) => dependencies[name] ?? new Proxy({}, { get: () => noop }), route);

for (const path of ["/admin/moderation", "/admin/matches/match"]) {
  test(`review returns a relative GET redirect to ${path} behind a proxy`, async () => {
    const body = new FormData();
    body.set("action", "dispute");
    body.set("returnTo", path);
    const response = await route.POST!(new Request("http://0.0.0.0:3000/api/admin/matches/match/review", { method: "POST", body }), { params: Promise.resolve({ id: "match" }) });
    assert.equal(response.status, 303);
    assert.equal(response.headers.get("location"), path);
  });
}

test("review does not accept backslash or protocol-relative return addresses", async () => {
  for (const path of ["//example.com", "/\\example.com", "/unknown-page"]) {
    const body = new FormData();
    body.set("action", "dispute");
    body.set("returnTo", path);
    const response = await route.POST!(new Request("http://localhost/api/review", { method: "POST", body }), { params: Promise.resolve({ id: "match" }) });
    assert.equal(response.headers.get("location"), "/admin/matches/match");
  }
});
