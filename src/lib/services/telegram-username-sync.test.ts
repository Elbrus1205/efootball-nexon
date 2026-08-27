import assert from "node:assert/strict";
import test from "node:test";
import { resolveUsernameChange } from "@/lib/services/telegram-username-sync";
import { readFileSync } from "node:fs";

test("detects a changed Telegram username regardless of @ prefix and case handling", () => {
  const result = resolveUsernameChange("old_nick", "@new_nick");
  assert.deepEqual(result, { changed: true, nextUsername: "new_nick" });
});

test("treats identical usernames as unchanged even when one carries an @ prefix", () => {
  assert.deepEqual(resolveUsernameChange("player", "@player"), { changed: false, nextUsername: "player" });
});

test("detects when a username was removed on Telegram", () => {
  assert.deepEqual(resolveUsernameChange("player", null), { changed: true, nextUsername: null });
});

test("detects when a username first appears", () => {
  assert.deepEqual(resolveUsernameChange(null, "player"), { changed: true, nextUsername: "player" });
});

test("normalizes empty strings to null and reports no change against null", () => {
  assert.deepEqual(resolveUsernameChange(null, "   "), { changed: false, nextUsername: null });
});

test("production refresh is scheduled every 12 hours and avoids burst requests", () => {
  const service = readFileSync("src/lib/services/telegram-username-sync.ts", "utf8");
  const schedule = readFileSync("deploy/sql/telegram-username-sync.sql", "utf8");
  assert.match(schedule, /efootball-telegram-username-sync/);
  assert.match(schedule, /'0 \*\/12 \* \* \*'/);
  assert.match(schedule, /api\/telegram\/sync-usernames/);
  assert.doesNotMatch(service, /Promise\.all\(batch\.map/);
  assert.match(service, /getTelegramRetryAfterMs/);
});
