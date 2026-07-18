import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";

import { getNotificationRetryDelayMs } from "./delivery-retry";

test("notification delivery retries use bounded exponential backoff", () => {
  assert.equal(getNotificationRetryDelayMs(1), 30_000);
  assert.equal(getNotificationRetryDelayMs(2), 60_000);
  assert.equal(getNotificationRetryDelayMs(6), 16 * 60_000);
  assert.equal(getNotificationRetryDelayMs(20), 60 * 60_000);
});

test("outbox checkpoints push and Telegram independently", () => {
  const schema = readFileSync(path.join(process.cwd(), "prisma", "schema.prisma"), "utf8");
  const worker = readFileSync(path.join(process.cwd(), "src", "lib", "notifications", "delivery-worker.ts"), "utf8");
  assert.match(schema, /pushDeliveredAt\s+DateTime\?/);
  assert.match(schema, /telegramDeliveredAt\s+DateTime\?/);
  assert.match(worker, /pushDeliveredAt: new Date\(\)/);
  assert.match(worker, /telegramDeliveredAt: new Date\(\)/);
  assert.match(worker, /const channelErrors: string\[\] = \[\]/);
  assert.match(worker, /if \(!telegramDelivered\)[\s\S]+if \(channelErrors\.length\)/);
});
