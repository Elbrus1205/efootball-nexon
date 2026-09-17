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

test("replacement identity is stored independently from transient search results", () => {
  assert.match(component, /useState<Record<string, UserOption \| undefined>>\(\{\}\)/);
  assert.match(component, /const selectedReplacement = replacementByParticipant\[participant\.id\]/);
  assert.match(component, /const selectedMemberReplacement = replacementByParticipant\[targetId\]/);
  assert.doesNotMatch(component, /usersById\.get|allLoadedUsers/);
});

test("single and roster choices retain the full player while API payloads still use ids", () => {
  assert.match(component, /\[participant\.id\]: user,/);
  assert.match(component, /\[targetId\]: user,/);
  assert.match(component, /const replacementUserId = selectedReplacement\?\.id \?\? ""/);
  assert.match(component, /const memberReplacementUserId = selectedMemberReplacement\?\.id \?\? ""/);
  assert.match(component, /\[participant\.id\]: undefined/);
  assert.match(component, /\[targetId\]: undefined/);
});

test("each replacement form renders only one persistent selected-player card", () => {
  assert.equal((component.match(/userLabel\(selectedReplacement\)/g) ?? []).length, 1);
  assert.equal((component.match(/userLabel\(selectedMemberReplacement\)/g) ?? []).length, 1);
  assert.equal((component.match(/>Выбранный игрок</g) ?? []).length, 2);
});
