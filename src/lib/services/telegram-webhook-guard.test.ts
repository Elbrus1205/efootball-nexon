import assert from "node:assert/strict";
import test from "node:test";
import { claimTelegramUpdate, consumeTelegramAiRateLimit } from "@/lib/services/telegram-webhook-guard";

test("Telegram update claim treats a repeated update_id as a duplicate", async () => {
  let calls = 0;
  const repository = {
    createProcessedUpdate: async () => {
      calls += 1;
      if (calls > 1) throw { code: "P2002" };
    },
    deleteExpiredProcessedUpdates: async () => undefined,
  };

  assert.equal(await claimTelegramUpdate(123, repository), true);
  assert.equal(await claimTelegramUpdate(123, repository), false);
});

test("AI rate limit is scoped to the Telegram user and chat minute", async () => {
  const counts = new Map<string, number>();
  const repository = {
    incrementRateBucket: async (scopeKey: string, windowStartedAt: Date) => {
      const key = `${scopeKey}:${windowStartedAt.toISOString()}`;
      const count = (counts.get(key) ?? 0) + 1;
      counts.set(key, count);
      return count;
    },
  };
  const now = new Date("2026-08-24T16:00:20.000Z");

  for (let index = 0; index < 5; index += 1) {
    assert.equal((await consumeTelegramAiRateLimit({ userId: "10", chatId: "20", now, repository })).allowed, true);
  }
  const blocked = await consumeTelegramAiRateLimit({ userId: "10", chatId: "20", now, repository });
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.retryAfterSeconds, 40);
  assert.equal((await consumeTelegramAiRateLimit({ userId: "11", chatId: "20", now, repository })).allowed, true);
});
