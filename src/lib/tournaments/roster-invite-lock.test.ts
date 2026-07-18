import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

test("roster invitations share the accept-flow advisory lock", () => {
  const route = readFileSync(
    path.join(process.cwd(), "src", "app", "api", "tournaments", "[id]", "roster", "invite", "route.ts"),
    "utf8",
  );

  assert.match(route, /pg_advisory_xact_lock\(hashtext\(\$\{`tournament-roster:\$\{captainMember\.registrationId\}`\}\)\)/);
  assert.match(route, /\$transaction\([\s\S]+activeMembersCount[\s\S]+tournamentRegistrationMember\.(?:create|update)/);
});

test("admin participant mutations share the public registration lock", () => {
  const applications = readFileSync(
    path.join(process.cwd(), "src", "app", "api", "admin", "tournaments", "[id]", "applications", "[applicationId]", "route.ts"),
    "utf8",
  );
  const participants = readFileSync(
    path.join(process.cwd(), "src", "app", "api", "admin", "tournaments", "[id]", "participants", "route.ts"),
    "utf8",
  );

  assert.match(applications, /tournament-registration:\$\{params\.id\}/);
  assert.match(applications, /error\.code === "P2034"/);
  assert.match(participants, /tournament-registration:\$\{params\.id\}/);
  assert.match(participants, /pg_advisory_xact_lock[\s\S]+const lockedBefore = await tx\.tournamentRegistration\.findFirst/);
  assert.match(participants, /\["P2002", "P2025"\]\.includes\(error\.code\)/);
});
