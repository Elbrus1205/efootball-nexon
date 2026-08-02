import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const source = readFileSync(path.join(process.cwd(), "src", "components", "admin", "match-manager.tsx"), "utf8");

test("captain-assigned admin matches show the assigned players rather than registration captains", () => {
  assert.match(source, /playerName=\{match\.isCaptainAssignedTeamMatch \? match\.player1\?\.name/);
  assert.match(source, /playerName=\{match\.isCaptainAssignedTeamMatch \? match\.player2\?\.name/);
  assert.match(source, /showPlayerName=\{!match\.isCaptainAssignedTeamMatch \|\| Boolean\(match\.player1Id\)\}/);
  assert.match(source, /showPlayerName=\{!match\.isCaptainAssignedTeamMatch \|\| Boolean\(match\.player2Id\)\}/);
});
