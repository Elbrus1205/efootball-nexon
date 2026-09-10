import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

test("public match display uses the historical registration, even after two replacements", () => {
  const source = readFileSync("src/app/tournaments/[id]/page.tsx", "utf8");
  const start = source.indexOf("  const resolveMatchEntry =");
  const end = source.indexOf("  const resolveMatchUserId =", start);
  assert.ok(start >= 0 && end > start);
  const compiled = ts.transpileModule(`${source.slice(start, end)}; return resolveMatchEntry;`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const original = { id: "original", userId: "alice", clubName: "Arsenal" };
  const current = { id: "current", userId: "charlie", clubName: "Chelsea" };
  const resolve = new Function("participantByEntryId", "resolveActiveEntryId", compiled)(
    new Map([[original.id, original], [current.id, current]]), () => current.id,
  ) as (match: object, side: 1 | 2) => typeof original;
  for (const side of [1, 2] as const) {
    const match = { [`participant${side}EntryId`]: original.id, [`participant${side}Entry`]: original };
    assert.equal(resolve(match, side), original);
  }
});
