import assert from "node:assert/strict";
import test from "node:test";
import {
  getStandingZoneStyle,
  isStandingEliminatedRank,
  relegationStyle,
  standingZoneColors,
} from "./tournament-standing-colors";

test("standing zones keep the requested order and distinct colors", () => {
  assert.match(getStandingZoneStyle(0).rowClass, /blue/);
  assert.match(getStandingZoneStyle(1).rowClass, /amber/);
  assert.match(getStandingZoneStyle(2).rowClass, /emerald/);
  assert.equal(new Set(standingZoneColors.map((style) => style.rowClass)).size, 8);
  assert.equal(getStandingZoneStyle(8).rowClass, getStandingZoneStyle(0).rowClass);
});

test("uncovered standings are relegation zones and use red", () => {
  const highlights = [
    { fromRank: 1, toRank: 6 },
    { fromRank: 7, toRank: 12 },
    { fromRank: 13, toRank: 18 },
  ];

  assert.equal(isStandingEliminatedRank(12, highlights), false);
  assert.equal(isStandingEliminatedRank(19, highlights), true);
  assert.equal(isStandingEliminatedRank(19, []), false);
  assert.match(relegationStyle.rowClass, /red/);
  assert.match(relegationStyle.dotClass, /red/);
});
