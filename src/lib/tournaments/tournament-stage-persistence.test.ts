import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const serviceSource = readFileSync(new URL("../services/tournaments.ts", import.meta.url), "utf8");

test("graph ids remain tournament-local metadata instead of global database primary keys", () => {
  assert.doesNotMatch(serviceSource, /id: node\.id,/);
  assert.doesNotMatch(serviceSource, /id: divisionSettings\?\.id/);
  assert.match(serviceSource, /graphId: node\.id/);
  assert.match(serviceSource, /getPersistedGraphStageId/);
});
