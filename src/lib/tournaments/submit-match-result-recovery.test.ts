import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

test("a repeated confirmed submission can resume idempotent finalization", () => {
  const command = readFileSync(
    path.join(root, "src", "lib", "tournaments", "submit-match-result.ts"),
    "utf8",
  );
  const route = readFileSync(
    path.join(root, "src", "app", "api", "matches", "[id]", "submit", "route.ts"),
    "utf8",
  );
  const reliability = readFileSync(
    path.join(root, "src", "lib", "services", "reliability.ts"),
    "utf8",
  );
  const tournaments = readFileSync(
    path.join(root, "src", "lib", "services", "tournaments.ts"),
    "utf8",
  );
  // Post-confirm side effects (incl. the match-result outcome notification) were
  // extracted into finalizeConfirmedMatch so the HTTP route and the Telegram
  // confirm path share one implementation.
  const finalize = readFileSync(
    path.join(root, "src", "lib", "tournaments", "finalize-confirmed-match.ts"),
    "utf8",
  );

  assert.match(command, /match\.status === MatchStatus\.CONFIRMED[\s\S]+state: "confirmed"/);
  assert.doesNotMatch(
    route,
    /if \(match\.status === MatchStatus\.CONFIRMED \|\| match\.status === MatchStatus\.FINISHED\)[\s\S]{0,250}status: 409/,
  );
  assert.match(finalize, /dedupeKey: `match-result:\$\{match\.id\}:\$\{userId\}`/);
  assert.match(tournaments, /resolveConfirmedMatch[\s\S]+ensureMatchLineupSnapshot\(match\.id\)/);
  assert.match(reliability, /pg_advisory_xact_lock\(hashtext\([\s\S]+reliability-user:/);
  assert.doesNotMatch(reliability, /reliability-confirmed:/);
  assert.match(reliability, /userId: \{ in: lockedUserIds \}/);
  assert.match(tournaments, /penaltyMatchId[\s\S]+match\.upsert/);
});
