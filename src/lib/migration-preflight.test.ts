import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

test("the pending-club unique index has a documented read-only preflight", () => {
  const sql = readFileSync(
    path.join(process.cwd(), "deploy", "sql", "preflight-notification-outbox.sql"),
    "utf8",
  );
  const readme = readFileSync(path.join(process.cwd(), "README.md"), "utf8");

  assert.match(sql, /GROUP BY "tournamentId", "clubSlug"[\s\S]+HAVING COUNT\(\*\) > 1/);
  assert.match(readme, /preflight-notification-outbox\.sql/);
});
