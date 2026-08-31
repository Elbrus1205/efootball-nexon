import assert from "node:assert/strict";
import test from "node:test";
import { resolveStageDeadlineRoundsCount } from "./tournament-deadlines";

test("deadline rounds follow generated paired tours instead of empty configured tours", () => {
  assert.equal(resolveStageDeadlineRoundsCount(38, Array.from({ length: 19 }, (_, index) => index + 1)), 19);
});

test("deadline rounds still include generated matches beyond stale stage metadata", () => {
  assert.equal(resolveStageDeadlineRoundsCount(19, Array.from({ length: 38 }, (_, index) => index + 1)), 38);
});

test("deadline rounds use configured metadata before matches are generated", () => {
  assert.equal(resolveStageDeadlineRoundsCount(8, []), 8);
});

test("saved deadline rows remain visible so administrators can edit or remove them", () => {
  assert.equal(resolveStageDeadlineRoundsCount(19, [1, 19], [22]), 22);
});
