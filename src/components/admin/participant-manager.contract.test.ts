import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const component = readFileSync(path.join(root, "src", "components", "admin", "participant-manager.tsx"), "utf8");
const route = readFileSync(
  path.join(root, "src", "app", "api", "admin", "tournaments", "[id]", "participants", "route.ts"),
  "utf8",
);

test("adding an admin participant requires a club and supports an optional group", () => {
  assert.match(component, /Клуб участника/);
  assert.match(component, /Без группы — распределить автоматически по рейтингу/);
  assert.match(component, /action: "add", userId: selectedUserId, clubSlug: selectedClubSlug, groupId: selectedGroupId/);
  assert.match(route, /resolveParticipantClub\(body\.clubSlug/);
});

test("replacing a participant sends the selected club to the canonical registration", () => {
  assert.match(component, /Клуб после замены/);
  assert.match(component, /clubSlug: replacementClubSlug/);
  assert.match(component, /action: "replaceMember"[\s\S]*clubSlug: replacementClubSlug/);
  assert.match(route, /\.\.\.clubAssignment/);
});
