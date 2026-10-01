import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const participantRouteSource = readFileSync(
  "src/app/api/admin/tournaments/[id]/participants/route.ts",
  "utf8",
);

test("a roster replacement only transfers open matches assigned to the replaced player", () => {
  const branchStart = participantRouteSource.indexOf('if (body.action === "replaceMember"');
  const branchEnd = participantRouteSource.indexOf('if (body.action === "addMember"', branchStart);
  const branch = participantRouteSource.slice(branchStart, branchEnd);

  assert.match(
    branch,
    /participant1EntryId: registrationId, player1Id: member\.userId/,
  );
  assert.match(
    branch,
    /participant2EntryId: registrationId, player2Id: member\.userId/,
  );
  assert.doesNotMatch(
    branch,
    /filter\(\(m\) => m\.participant1EntryId === registrationId\)/,
  );
});

test("replacing a member reactivates the registration for subsequent matches", () => {
  const participantRouteSource = readFileSync(
    "src/app/api/admin/tournaments/[id]/participants/route.ts",
    "utf8",
  );

  assert.match(
    participantRouteSource,
    /data: \{ \.\.\.clubAssignment, isActive: true, inactiveFromRound: null, inactiveSince: null \}/,
  );
});

test("a roster replacement does not clear another captain's half-filled team slot", () => {
  const branchStart = participantRouteSource.indexOf('if (body.action === "replaceMember"');
  const branchEnd = participantRouteSource.indexOf('if (body.action === "addMember"', branchStart);
  const branch = participantRouteSource.slice(branchStart, branchEnd);

  assert.doesNotMatch(branch, /OR: \[\{ player1Id: null \}, \{ player2Id: null \}\]/);
  assert.doesNotMatch(branch, /data: \{ player1Id: null, player2Id: null/);
});
