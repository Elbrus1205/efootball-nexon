import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

test("twin alerts are queued through the notification outbox", () => {
  const source = readFileSync(path.join(process.cwd(), "src", "lib", "auth", "twin-detection.ts"), "utf8");
  const notifications = readFileSync(path.join(process.cwd(), "src", "lib", "auth", "notifications.ts"), "utf8");

  assert.match(source, /createNotification\(/);
  assert.doesNotMatch(source, /sendTelegramMessage\(/);
  assert.match(notifications, /after\(async \(\) =>/);
});
