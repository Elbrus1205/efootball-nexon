import assert from "node:assert/strict";
import test from "node:test";
import { validateStageGraph, normalizeStageGraph, topologicalStageOrder } from "@/lib/tournament-stage-graph";

test("normalizes a multi-league route and preserves rank transitions", () => {
  const graph = normalizeStageGraph({
    stages: [
      { id: "five", name: "5 лиг", type: "LEAGUE", divisionsCount: 5 },
      { id: "elite", name: "Элита", type: "LEAGUE", divisionsCount: 1 },
      { id: "final", name: "Финал", type: "PLAYOFF" },
    ],
    transitions: [
      { id: "a", fromStageId: "five", toStageId: "elite", fromDivisionIndex: 1, fromRank: 1 },
      { id: "b", fromStageId: "elite", toStageId: "final", result: "RANK", fromRank: 1 },
    ],
  });
  assert.equal(validateStageGraph(graph).length, 0);
  assert.deepEqual(topologicalStageOrder(graph).map((stage) => stage.id), ["five", "elite", "final"]);
});

test("rejects a cycle and enables super cup only with multiple playoffs", () => {
  const graph = normalizeStageGraph({
    stages: [{ id: "a", name: "A", type: "LEAGUE" }, { id: "b", name: "B", type: "PLAYOFF" }],
    transitions: [{ id: "one", fromStageId: "a", toStageId: "b", fromRank: 1 }, { id: "two", fromStageId: "b", toStageId: "a", result: "WINNER" }],
    superCup: { enabled: true, sourcePlayoffIds: ["b"] },
  });
  assert.ok(validateStageGraph(graph).some((issue) => issue.path === "transitions"));
  assert.equal(graph.superCup.enabled, false);
});
