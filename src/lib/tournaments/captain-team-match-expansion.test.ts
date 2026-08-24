import assert from "node:assert/strict";
import test from "node:test";
import {
  planCaptainTeamFixtureExpansion,
  type CaptainTeamFixtureRow,
} from "./captain-team-match-expansion";

function finalLeg(id: string, legNumber: number): CaptainTeamFixtureRow {
  return {
    id,
    stageId: "playoff-stage",
    groupId: null,
    bracketId: "playoff-bracket",
    round: 3,
    matchNumber: 1,
    bracket: "upper",
    seriesKey: "playoff-bracket:upper:3:1:main",
    legNumber,
    canExpand: true,
  };
}

test("repairs a partially expanded two-leg team final to six player matches", () => {
  const rows = [finalLeg("final-leg-1", 1), finalLeg("final-leg-2", 2)];
  const plan = planCaptainTeamFixtureExpansion(rows, 3);

  assert.equal(rows.length + plan.reduce((sum, item) => sum + item.additionalRows, 0), 6);
  assert.deepEqual(plan, [
    { sourceId: "final-leg-1", additionalRows: 2 },
    { sourceId: "final-leg-2", additionalRows: 2 },
  ]);
});

test("adds only the missing rows when one leg was partially expanded", () => {
  const rows = [
    finalLeg("final-leg-1-a", 1),
    finalLeg("final-leg-1-b", 1),
    finalLeg("final-leg-2", 2),
  ];

  assert.deepEqual(planCaptainTeamFixtureExpansion(rows, 3), [
    { sourceId: "final-leg-1-a", additionalRows: 1 },
    { sourceId: "final-leg-2", additionalRows: 2 },
  ]);
});

test("does not duplicate an already complete team fixture", () => {
  const rows = [1, 2, 3].map((index) => ({ ...finalLeg(`final-${index}`, 1) }));
  assert.deepEqual(planCaptainTeamFixtureExpansion(rows, 3), []);
});

test("does not use a played row as a repair source", () => {
  const playedRow = { ...finalLeg("played", 1), canExpand: false };
  assert.deepEqual(planCaptainTeamFixtureExpansion([playedRow], 3), []);
});
