import assert from "node:assert/strict";
import test from "node:test";

import { getSessionActivityCutoff, shouldRefreshSessionActivity } from "./session-activity";

const now = new Date("2026-07-17T12:00:00.000Z");

test("active sessions are not written on every authenticated request", () => {
  assert.equal(shouldRefreshSessionActivity(new Date("2026-07-17T11:58:00.000Z"), now), false);
  assert.equal(shouldRefreshSessionActivity(new Date("2026-07-17T11:54:59.999Z"), now), true);
});

test("the database cutoff uses the same activity interval", () => {
  assert.equal(getSessionActivityCutoff(now).toISOString(), "2026-07-17T11:55:00.000Z");
});
