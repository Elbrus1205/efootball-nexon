import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";

test("finalized match always performs a final lifecycle sync after bracket resolution", () => {
  const source = readFileSync(path.join(process.cwd(), "src", "lib", "tournaments", "finalize-confirmed-match.ts"), "utf8");
  const resolveIndex = source.indexOf("await resolveConfirmedMatch(match.id);");
  const syncIndex = source.indexOf("await syncTournamentLifecycleStatus(match.tournamentId);", resolveIndex);

  assert.notEqual(resolveIndex, -1);
  assert.notEqual(syncIndex, -1);
});
