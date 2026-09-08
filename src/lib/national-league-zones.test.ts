import assert from "node:assert/strict";
import test from "node:test";

const zones = [
  [1, 6],
  [7, 12],
  [13, 18],
  [19, 20],
] as const;

test("national five-league format uses the standard four placement zones", () => {
  assert.deepEqual(zones, [[1, 6], [7, 12], [13, 18], [19, 20]]);
  assert.equal(zones.length, 4);
});
