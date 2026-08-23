import assert from "node:assert/strict";
import test from "node:test";
import {
  describeStageGraphTransition,
  normalizeStageGraph,
  resolveStageGraphAssignments,
  topologicalStageOrder,
  validateStageGraph,
} from "@/lib/tournament-stage-graph";

test("normalizes individually configured leagues without losing their names and capacities", () => {
  const graph = normalizeStageGraph({
    stages: [{
      id: "national-leagues",
      name: "Национальные лиги",
      type: "LEAGUE",
      divisions: [
        { id: "england", name: "Англия", participantsCount: 8, roundsCount: 2, matchesPerOpponent: 2 },
        { id: "spain", name: "Испания", participantsCount: 10, roundsCount: 3, matchesPerOpponent: 1 },
      ],
      points: { win: 3, draw: 1, loss: 0 },
    }],
  });

  assert.deepEqual(graph.stages[0]?.divisions.map((division) => [division.name, division.participantsCount, division.roundsCount]), [
    ["Англия", 8, 2],
    ["Испания", 10, 3],
  ]);
  assert.equal(graph.stages[0]?.divisionsCount, 2);
});

test("keeps explicitly cleared names empty so the editor does not restore a fallback while typing", () => {
  const graph = normalizeStageGraph({
    stages: [{
      id: "opening",
      name: "",
      type: "GROUPS",
      divisions: [{ id: "group-a", name: "" }],
    }],
  });

  assert.equal(graph.stages[0]?.name, "");
  assert.equal(graph.stages[0]?.divisions[0]?.name, "");
  assert.ok(validateStageGraph(graph).some((issue) => issue.path === "stages.0.name"));
  assert.ok(validateStageGraph(graph).some((issue) => issue.path === "stages.0.divisions.0.name"));
});

test("preserves spaces while an administrator types a multi-word stage name", () => {
  const graph = normalizeStageGraph({
    stages: [{ id: "final", name: "Золотой ", type: "PLAYOFF" }],
  });

  assert.equal(graph.stages[0]?.name, "Золотой ");
  assert.equal(normalizeStageGraph({ ...graph, stages: [{ ...graph.stages[0]!, name: "Золотой финал" }] }).stages[0]?.name, "Золотой финал");
});

test("keeps legacy quick setup graphs compatible", () => {
  const graph = normalizeStageGraph({
    stages: [
      { id: "opening", name: "Группы", type: "GROUPS", divisionsCount: 4, participantsPerDivision: 4, roundsCount: 3 },
      { id: "final", name: "Финал", type: "PLAYOFF", bracketSize: 8 },
    ],
    transitions: [{ id: "top", fromStageId: "opening", toStageId: "final", fromRank: 1, toRank: 2 }],
  });

  assert.equal(graph.version, 3);
  assert.equal(graph.mode, "QUICK");
  assert.equal(graph.stages[0]?.divisions.length, 4);
  assert.equal(graph.stages[0]?.divisions[0]?.name, "Группа A");
  assert.equal(validateStageGraph(graph).length, 0);
});

test("rejects cycles, duplicate transitions and duplicate explicit destination slots", () => {
  const graph = normalizeStageGraph({
    stages: [
      { id: "a", name: "A", type: "LEAGUE" },
      { id: "b", name: "B", type: "PLAYOFF", bracketSize: 4 },
    ],
    transitions: [
      { id: "one", fromStageId: "a", toStageId: "b", fromRank: 1, toSlotStart: 1 },
      { id: "copy", fromStageId: "a", toStageId: "b", fromRank: 1, toSlotStart: 1 },
      { id: "back", fromStageId: "b", toStageId: "a", result: "WINNER" },
    ],
  });
  const messages = validateStageGraph(graph).map((issue) => issue.message);

  assert.ok(messages.some((message) => message.includes("цикл")));
  assert.ok(messages.some((message) => message.includes("дублирует")));
  assert.ok(messages.some((message) => /слот/i.test(message)));
});

test("rejects playoff overflow with an actionable error", () => {
  const graph = normalizeStageGraph({
    stages: [
      { id: "league", name: "Лига", type: "LEAGUE", divisionsCount: 2 },
      { id: "playoff-a", name: "Плей-офф A", type: "PLAYOFF", bracketSize: 8 },
    ],
    transitions: [{ id: "top", fromStageId: "league", toStageId: "playoff-a", result: "RANK", fromRank: 1, toRank: 6 }],
  });
  const issue = validateStageGraph(graph).find((item) => item.path === "stages.1.bracketSize");

  assert.equal(issue?.message, "Плей-офф A рассчитан на 8 участников, но переходы передают 12. Уменьшите диапазон мест или увеличьте размер сетки.");
});

test("routes rank ranges and playoff winners into separate destinations", () => {
  const graph = normalizeStageGraph({
    stages: [
      { id: "league", name: "Лига 1", type: "LEAGUE" },
      { id: "a", name: "Плей-офф A", type: "PLAYOFF" },
      { id: "b", name: "Плей-офф B", type: "PLAYOFF" },
      { id: "cup", name: "Суперкубок", type: "SUPERCUP" },
    ],
    transitions: [
      { id: "league-a", fromStageId: "league", toStageId: "a", result: "RANK", fromRank: 1, toRank: 2 },
      { id: "league-b", fromStageId: "league", toStageId: "b", result: "RANK", fromRank: 3, toRank: 4 },
      { id: "winner-a", fromStageId: "a", toStageId: "cup", result: "WINNER" },
      { id: "winner-b", fromStageId: "b", toStageId: "cup", result: "WINNER" },
    ],
  });
  const rankAssignments = resolveStageGraphAssignments({
    graph,
    fromStageId: "league",
    standings: [1, 2, 3, 4].map((rank) => ({ registrationId: `r${rank}`, divisionIndex: 1, rank })),
  });
  const winnerAssignments = resolveStageGraphAssignments({ graph, fromStageId: "a", playoffResults: [{ registrationId: "r1", result: "WINNER" }] });

  assert.deepEqual(rankAssignments.map((item) => [item.registrationId, item.toStageId]), [["r1", "a"], ["r2", "a"], ["r3", "b"], ["r4", "b"]]);
  assert.deepEqual(winnerAssignments.map((item) => [item.registrationId, item.toStageId]), [["r1", "cup"]]);
});

test("materializes a configurable super cup only from at least two playoffs", () => {
  const graph = normalizeStageGraph({
    stages: [
      { id: "p1", name: "Кубок A", type: "PLAYOFF" },
      { id: "p2", name: "Кубок B", type: "PLAYOFF" },
    ],
    superCup: { enabled: true, name: "Кубок чемпионов", sourcePlayoffIds: ["p1", "p2"], bracketSize: 2, bestOfWins: 2 },
  });

  const superCup = graph.stages.find((stage) => stage.type === "SUPERCUP");
  assert.equal(superCup?.name, "Кубок чемпионов");
  assert.equal(superCup?.bestOfWins, 2);
  assert.equal(graph.transitions.filter((transition) => transition.toStageId === superCup?.id).length, 2);
  assert.equal(validateStageGraph(graph).length, 0);
});

test("describes transitions in administrator language", () => {
  const graph = normalizeStageGraph({
    stages: [
      { id: "league", name: "Лиги", type: "LEAGUE", divisions: [{ id: "england", name: "Англия" }] },
      { id: "playoff", name: "Плей-офф A", type: "PLAYOFF" },
    ],
    transitions: [{ id: "route", fromStageId: "league", fromDivisionId: "england", toStageId: "playoff", result: "RANK", fromRank: 1, toRank: 8, targetBracket: "upper" }],
  });

  assert.equal(describeStageGraphTransition(graph, graph.transitions[0]!), "Англия, места 1–8 → Плей-офф A, верхняя сетка");
  assert.deepEqual(topologicalStageOrder(graph).map((stage) => stage.id), ["league", "playoff"]);
});

test("distributes incoming participants across target groups and supports snake order", () => {
  const graph = normalizeStageGraph({
    stages: [
      { id: "source", name: "Лига", type: "LEAGUE" },
      { id: "target", name: "Финальные группы", type: "GROUPS", divisionsCount: 3 },
    ],
    transitions: [{ id: "snake", fromStageId: "source", toStageId: "target", result: "RANK", fromRank: 1, toRank: 6, distribution: "SNAKE" }],
  });

  const assignments = resolveStageGraphAssignments({
    graph,
    fromStageId: "source",
    standings: Array.from({ length: 6 }, (_, index) => ({ registrationId: `p${index + 1}`, divisionIndex: 1, rank: index + 1 })),
  });

  assert.deepEqual(assignments.map((assignment) => assignment.toDivisionIndex), [1, 2, 3, 3, 2, 1]);
});
