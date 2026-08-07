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
  assert.match(
    source,
    /match\.player1Id \? <option value=\{match\.player1Id\}>\{match\.isCaptainAssignedTeamMatch \? match\.player1\?\.name \?\? "Игрок не выбран" : participantName\(selectedParticipantOne\)\}<\/option>/,
  );
  assert.match(
    source,
    /match\.player2Id \? <option value=\{match\.player2Id\}>\{match\.isCaptainAssignedTeamMatch \? match\.player2\?\.name \?\? "Игрок не выбран" : participantName\(selectedParticipantTwo\)\}<\/option>/,
  );
});
