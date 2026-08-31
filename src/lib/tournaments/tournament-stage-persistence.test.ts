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

test("league and group stages keep all matches against one opponent in the same tour", () => {
  const generationSource = serviceSource.slice(serviceSource.indexOf("export async function generateTournamentMatches"));
  const roundRobinModes = Array.from(generationSource.matchAll(/roundsMode:\s*"(cycles|series)"/g), (match) => match[1]);

  assert.ok(roundRobinModes.length >= 4, "expected every league/group generation path to select a round-robin mode");
  assert.deepEqual(new Set(roundRobinModes), new Set(["series"]));
});
