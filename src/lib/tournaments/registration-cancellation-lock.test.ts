import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

test("registration cancellation reopens only an eligible locked tournament", () => {
  const route = readFileSync(
    path.join(process.cwd(), "src", "app", "api", "tournaments", "[id]", "register", "route.ts"),
    "utf8",
  );

  assert.match(route, /tournamentRegistration\.delete[\s\S]+tx\.tournament\.updateMany/);
  assert.match(route, /status: \{ in: \[TournamentStatus\.REGISTRATION_CLOSED, TournamentStatus\.AWAITING_START\] \}/);
  assert.doesNotMatch(route, /await syncTournamentLifecycleStatus\(params\.id\)/);
});
