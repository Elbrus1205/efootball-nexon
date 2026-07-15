import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const registerRoute = readFileSync(
  path.join(process.cwd(), "src", "app", "api", "tournaments", "[id]", "register", "route.ts"),
  "utf8",
);

test("an approved lineup application can be submitted again after registration cancellation", () => {
  assert.doesNotMatch(
    registerRoute,
    /existingApplication\?\.status === TournamentApplicationStatus\.APPROVED/,
  );
});

test("a rejected lineup application is reset to pending when it is submitted again", () => {
  assert.match(
    registerRoute,
    /update:\s*{\s*status: TournamentApplicationStatus\.PENDING,/,
  );
});
