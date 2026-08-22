import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";

import { getNotificationRetryDelayMs } from "./delivery-retry";
import { TelegramApiError, getTelegramRetryAfterMs } from "../telegram-bot";

test("notification delivery retries use bounded exponential backoff", () => {
  assert.equal(getNotificationRetryDelayMs(1), 30_000);
  assert.equal(getNotificationRetryDelayMs(2), 60_000);
  assert.equal(getNotificationRetryDelayMs(6), 5 * 60_000);
  assert.equal(getNotificationRetryDelayMs(20), 5 * 60_000);
});

test("Telegram retry_after takes precedence over generic backoff", () => {
  assert.equal(getNotificationRetryDelayMs(20, 12_000), 12_000);
  assert.equal(getTelegramRetryAfterMs(new TelegramApiError("Too Many Requests", {
    status: 429,
    errorCode: 429,
    retryAfterSeconds: 17,
  })), 17_000);
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
  assert.match(worker, /MAX_DELIVERY_RUNTIME_MS = 20_000/);
  assert.match(worker, /DEFAULT_DELIVERY_LIMIT = 8/);
  assert.match(worker, /DELIVERY_CONCURRENCY = 8/);
  assert.match(worker, /MAX_DELIVERY_ATTEMPTS = 12/);
  assert.match(worker, /permanent:\$\{message\}/);
  assert.match(worker, /getTelegramRetryAfterMs/);
});
