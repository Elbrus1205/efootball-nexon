import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";

import { MemoryRateLimiter } from "./rate-limit";

test("rate limiter blocks requests beyond the policy and reports retry time", () => {
  const limiter = new MemoryRateLimiter();
  const policy = { limit: 2, windowMs: 1_000 };

  assert.equal(limiter.consume("login:client", policy, 10_000).allowed, true);
  assert.equal(limiter.consume("login:client", policy, 10_100).allowed, true);

  const blocked = limiter.consume("login:client", policy, 10_200);
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.retryAfterSeconds, 1);

  assert.equal(limiter.consume("login:client", policy, 11_001).allowed, true);
});

test("rate limit keys are isolated", () => {
  const limiter = new MemoryRateLimiter();
  const policy = { limit: 1, windowMs: 60_000 };

  assert.equal(limiter.consume("login:first", policy, 0).allowed, true);
  assert.equal(limiter.consume("login:first", policy, 1).allowed, false);
  assert.equal(limiter.consume("login:second", policy, 1).allowed, true);
});

test("the real credentials callback enforces its own rate limit", () => {
  const options = readFileSync(path.join(process.cwd(), "src", "lib", "auth", "options.ts"), "utf8");
  assert.match(options, /consumeRequestRateLimit\([\s\S]*?"auth-authorize"/);
});
