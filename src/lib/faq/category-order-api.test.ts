import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { NextResponse } from "next/server";
import ts from "typescript";
import * as ordering from "./category-order";

function loadRoute() {
  const state = { allowed: true, body: "", paths: [] as string[], fail: false };
  const store = {
    faqItem: { findMany: async () => [{ category: "Security" }, { category: "Matches" }, { category: "Drafts" }] },
    siteContent: { upsert: async ({ update }: { update: { body: string } }) => {
      if (state.fail) throw new Error("Database unavailable");
      state.body = update.body;
    } },
  };
  const db = { ...store, $transaction: async <T>(callback: (tx: typeof store) => Promise<T>) => callback(store) };
  const exports: { POST?: (request: Request) => Promise<Response> } = {};
  const compiled = ts.transpileModule(readFileSync(new URL("../../app/api/admin/faq/categories/route.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } });
  runInNewContext(compiled.outputText, { exports, console: { error: () => {} }, require: (name: string): unknown => {
    switch (name) {
      case "next/server": return { NextResponse };
      case "next/cache": return { revalidatePath: (path: string) => state.paths.push(path) };
      case "@/lib/db": return { db };
      case "@/lib/faq/category-order": return ordering;
      case "@/lib/auth/session": return { requirePermission: async (permission: string) => {
        assert.equal(permission, "content.manage");
        if (!state.allowed) throw new Error("FORBIDDEN");
      } };
      default: throw new Error(`Unexpected dependency: ${name}`);
    }
  } });
  assert.ok(exports.POST);
  const post = exports.POST;
  return { state, request: (input: unknown) => post(new Request("https://example.test/api/admin/faq/categories", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) })) };
}

test("category API persists the complete order and invalidates public/admin pages without updating questions", async () => {
  const { state, request } = loadRoute();
  const order = ["Matches", "Security", "Drafts"];
  assert.equal((await request(order)).status, 200);
  assert.deepEqual(JSON.parse(state.body), order);
  assert.deepEqual(state.paths, ["/faq", "/admin/faq"]);
});

test("category API rejects duplicates, unknown and missing sections without saving", async () => {
  const { state, request } = loadRoute();
  for (const [input, status] of [
    [["Matches", "Matches"], 400], [null, 400], [["Matches", "Security"], 409],
    [["Matches", "Security", "Unknown"], 409],
  ] as const) assert.equal((await request(input)).status, status);
  assert.equal(state.body, "");
  assert.deepEqual(state.paths, []);
});

test("category API enforces permission and reports storage failure without success", async () => {
  const { state, request } = loadRoute();
  const order = ["Matches", "Security", "Drafts"];
  state.allowed = false;
  await assert.rejects(request(order), /FORBIDDEN/);
  state.allowed = true;
  state.fail = true;
  const response = await request(order);
  assert.equal(response.status, 500);
  assert.ok((await response.json()).error);
  assert.equal(state.body, "");
  assert.deepEqual(state.paths, []);
});
