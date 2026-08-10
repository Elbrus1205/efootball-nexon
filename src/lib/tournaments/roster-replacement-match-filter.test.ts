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
