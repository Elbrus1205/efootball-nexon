import assert from "node:assert/strict";
import test from "node:test";
import { resolveStageGraphAssignments, validateStageGraph, normalizeStageGraph, topologicalStageOrder } from "@/lib/tournament-stage-graph";

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

test("resolves rank routes without duplicating a registration", () => {
  const graph = normalizeStageGraph({
    stages: [{ id: "source", name: "Источник", type: "LEAGUE" }, { id: "elite", name: "Элита", type: "LEAGUE" }, { id: "rest", name: "Резерв", type: "LEAGUE" }],
    transitions: [
      { id: "top", fromStageId: "source", toStageId: "elite", fromRank: 1 },
      { id: "also-top", fromStageId: "source", toStageId: "rest", fromRank: 1 },
    ],
  });
  const assignments = resolveStageGraphAssignments({ graph, fromStageId: "source", standings: [{ registrationId: "r1", divisionIndex: 1, rank: 1 }, { registrationId: "r2", divisionIndex: 1, rank: 2 }] });
  assert.deepEqual(assignments.map((item) => [item.registrationId, item.toStageId]), [["r1", "elite"], ["r1", "rest"]]);
});

test("routes a rank range into one downstream league", () => {
  const graph = normalizeStageGraph({
    stages: [{ id: "source", name: "Источник", type: "LEAGUE" }, { id: "elite", name: "Элита", type: "LEAGUE" }],
    transitions: [{ id: "top-eight", fromStageId: "source", toStageId: "elite", result: "RANK", fromDivisionIndex: 1, fromRank: 1, toRank: 2 }],
  });
  const assignments = resolveStageGraphAssignments({ graph, fromStageId: "source", standings: [{ registrationId: "r1", divisionIndex: 1, rank: 1 }, { registrationId: "r2", divisionIndex: 1, rank: 2 }, { registrationId: "r3", divisionIndex: 1, rank: 3 }] });
  assert.deepEqual(assignments.map((item) => item.registrationId), ["r1", "r2"]);
});

test("materializes a super cup stage from two playoff winners", () => {
  const graph = normalizeStageGraph({
    stages: [{ id: "p1", name: "Кубок A", type: "PLAYOFF" }, { id: "p2", name: "Кубок B", type: "PLAYOFF" }],
    superCup: { enabled: true, sourcePlayoffIds: ["p1", "p2"] },
  });
  assert.equal(graph.superCup.enabled, true);
  assert.equal(graph.stages.some((stage) => stage.id === "supercup"), true);
  assert.equal(graph.transitions.filter((transition) => transition.toStageId === "supercup").length, 2);
});
