import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (...segments: string[]) => readFileSync(path.join(root, ...segments), "utf8");

test("Redis gateway fails closed and does not queue commands offline", () => {
  const gateway = read("src", "lib", "redis.ts");
  assert.match(gateway, /disableOfflineQueue: true/);
  assert.match(gateway, /commandsQueueMaxLength: 256/);
  assert.match(gateway, /connectTimeout: timeoutMs/);
  assert.match(gateway, /reconnectStrategy: false/);
  assert.match(gateway, /fallback=postgresql/);
  assert.match(gateway, /disabledUntil/);
});

test("Redis notification queue is atomically bounded and deduplicated", () => {
  const queue = read("src", "lib", "redis-notification-queue.ts");
  assert.match(queue, /ZSCORE/);
  assert.match(queue, /ZCARD/);
  assert.match(queue, /ZADD/);
  assert.match(queue, /EXPIRE/);
  assert.match(queue, /ZRANGEBYSCORE/);
  assert.match(queue, /ZREM/);
});

test("large read caches have Redis invalidation seams", () => {
  const ratings = read("src", "lib", "ratings-cache.ts");
  const tournaments = read("src", "lib", "tournament-cache.ts");
  assert.match(ratings, /deleteRedisKeysByPattern/);
  assert.match(ratings, /ratings:players:/);
  assert.match(tournaments, /public-tournaments/);
  assert.match(tournaments, /tournaments:list:/);
});

test("private match cache is scoped to the authenticated user", () => {
  const page = read("src", "app", "dashboard", "matches", "page.tsx");
  const cache = read("src", "lib", "tournament-cache.ts");
  assert.match(page, /matches:mine:\$\{session\.user\.id\}/);
  assert.match(cache, /matches:mine:/);
});

test("notification delivery keeps PostgreSQL outbox as the fallback", () => {
  const service = read("src", "lib", "services", "notifications.ts");
  const worker = read("src", "lib", "notifications", "delivery-worker.ts");
  assert.match(service, /enqueueNotificationDelivery\(notification\.id/);
  assert.match(worker, /drainNotificationDeliveryQueue\(DEFAULT_DELIVERY_LIMIT\)/);
  assert.match(worker, /deliverNotificationOutbox\(\)/);
});

test("queue adapter passes due time and supports duplicate-safe drain", async () => {
  const { createNotificationQueue } = await import("./redis-notification-queue");
  const commands: string[][] = [];
  const queue = createNotificationQueue({
    key: "queue",
    maxLength: 2,
    now: () => 1_000,
    execute: async (command) => {
      commands.push(command);
      return commands.length === 2 ? ["n1"] : 1;
    },
  });

  assert.equal(await queue.enqueue("n1", 900), true);
  assert.deepEqual(await queue.drain(1), ["n1"]);
  assert.match(commands[0].join(" "), /n1 900 2/);
  assert.match(commands[1].join(" "), /1000 1/);
});

test("queue adapter treats Redis failure as an unavailable accelerator", async () => {
  const { createNotificationQueue } = await import("./redis-notification-queue");
  const queue = createNotificationQueue({
    key: "queue",
    maxLength: 2,
    execute: async () => null,
  });

  assert.equal(await queue.enqueue("n1"), false);
  assert.equal(await queue.drain(1), null);
});
