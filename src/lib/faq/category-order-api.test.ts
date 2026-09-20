import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { NextResponse } from "next/server";
import ts from "typescript";
import * as ordering from "./category-order";

function loadRoute() {
  const state = { allowed: true, body: "", paths: [] as string[], fail: false, rows: [
    { id: "s1", category: "Security", isPublished: true, sortOrder: 1, answer: "Original", contentJson: '[{"type":"image","url":"/photo.png"}]' },
    { id: "s2", category: "Security", isPublished: false, sortOrder: 2, answer: "Draft", contentJson: null },
    { id: "m1", category: "Matches", isPublished: true, sortOrder: 0, answer: "Matches", contentJson: null },
    { id: "d1", category: "Drafts", isPublished: false, sortOrder: 0, answer: "Drafts", contentJson: null },
  ] };
  const store = {
    faqItem: {
      findMany: async () => [...new Set(state.rows.map((row) => row.category))].map((category) => ({ category })),
      updateMany: async ({ where, data }: { where: { category: string }; data: { category: string } }) => {
        state.rows = state.rows.map((row) => row.category === where.category ? { ...row, ...data } : row);
      },
    },
    siteContent: { upsert: async ({ update }: { update: { body: string } }) => {
      if (state.fail) throw new Error("Database unavailable");
      state.body = update.body;
    } },
  };
  const db = { ...store, $transaction: async <T>(callback: (tx: typeof store) => Promise<T>) => {
    const before = structuredClone(state.rows);
    try { return await callback(store); } catch (error) { state.rows = before; throw error; }
  } };
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

test("renaming updates published and draft questions together with order, preserving their content", async () => {
  const { state, request } = loadRoute();
  const before = structuredClone(state.rows);
  const response = await request([
    { originalName: "Matches", name: "Matches" },
    { originalName: "Security", name: "Account safety" },
    { originalName: "Drafts", name: "Drafts" },
  ]);
  assert.equal(response.status, 200);
  assert.deepEqual(JSON.parse(state.body), ["Matches", "Account safety", "Drafts"]);
  assert.deepEqual(state.rows, before.map((row) => row.category === "Security" ? { ...row, category: "Account safety" } : row));
});

test("renaming rejects empty names, existing sections, duplicate originals and stale lists", async () => {
  const { state, request } = loadRoute();
  const before = structuredClone(state.rows);
  for (const name of ["", "   ", " Matches ", "matches", "x".repeat(101)]) {
    const response = await request([ { originalName: "Security", name }, { originalName: "Matches", name: "Matches" }, { originalName: "Drafts", name: "Drafts" } ]);
    assert.equal(response.status, 400, name);
  }
  assert.equal((await request([{ originalName: "Security", name: "A" }, { originalName: "Security", name: "B" }])).status, 400);
  assert.equal((await request([{ originalName: "Old section", name: "New section" }])).status, 409);
  assert.deepEqual(state.rows, before);
  assert.equal(state.body, "");
});

test("failed order save rolls back category names with it", async () => {
  const { state, request } = loadRoute();
  const before = structuredClone(state.rows);
  state.fail = true;
  assert.equal((await request([ { originalName: "Security", name: "Safety" }, { originalName: "Matches", name: "Matches" }, { originalName: "Drafts", name: "Drafts" } ])).status, 500);
  assert.deepEqual(state.rows, before);
  assert.equal(state.body, "");
  assert.deepEqual(state.paths, []);
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
