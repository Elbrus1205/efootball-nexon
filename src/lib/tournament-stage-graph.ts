import { PlayoffType } from "@prisma/client";

export type StageGraphStageType = "GROUPS" | "LEAGUE" | "PLAYOFF";
export type StageGraphResult = "RANK" | "WINNER" | "RUNNER_UP" | "THIRD_PLACE";
export type StageGraphTargetBracket = "upper" | "lower";

export type StageGraphStage = {
  id: string;
  name: string;
  type: StageGraphStageType;
  divisionsCount: number;
  participantsPerDivision: number | null;
  roundsCount: number;
  matchesPerOpponent: number | null;
  playoffType?: PlayoffType;
  legsCount?: number;
  thirdPlaceMatch?: boolean;
};

export type StageGraphTransition = {
  id: string;
  fromStageId: string;
  toStageId: string;
  result: StageGraphResult;
  fromDivisionIndex: number | null;
  fromRank: number | null;
  toDivisionIndex: number | null;
  targetBracket: StageGraphTargetBracket;
};

export type StageGraphSuperCup = {
  enabled: boolean;
  name: string;
  sourcePlayoffIds: string[];
};

export type StageGraphBlueprint = {
  stages: StageGraphStage[];
  transitions: StageGraphTransition[];
  superCup: StageGraphSuperCup;
};

export type StageGraphValidationIssue = {
  path: string;
  message: string;
};

function id(prefix: string, index: number) {
  return `${prefix}_${index + 1}`;
}

function positive(value: unknown, fallback: number, max: number) {
  const parsed = Number(value);
  return Math.max(1, Math.min(max, Number.isFinite(parsed) ? Math.floor(parsed) : fallback));
}

function optionalPositive(value: unknown, max: number) {
  if (value === null || value === undefined || value === "") return null;
  return positive(value, 1, max);
}

export function normalizeStageGraph(input: unknown): StageGraphBlueprint {
  const value = input && typeof input === "object" ? input as Partial<StageGraphBlueprint> : {};
  const rawStages = Array.isArray(value.stages) ? value.stages : [];
  const stages = rawStages.map((raw, index) => {
    const stage = raw && typeof raw === "object" ? raw as Partial<StageGraphStage> : {};
    const type: StageGraphStageType = stage.type === "LEAGUE" || stage.type === "PLAYOFF" ? stage.type : "GROUPS";
    return {
      id: typeof stage.id === "string" && stage.id.trim() ? stage.id : id("stage", index),
      name: typeof stage.name === "string" && stage.name.trim() ? stage.name.trim() : `Этап ${index + 1}`,
      type,
      divisionsCount: type === "PLAYOFF" ? 1 : positive(stage.divisionsCount, 1, 32),
      participantsPerDivision: type === "PLAYOFF" ? null : optionalPositive(stage.participantsPerDivision, 64),
      roundsCount: positive(stage.roundsCount, 1, 128),
      matchesPerOpponent: optionalPositive(stage.matchesPerOpponent, 6),
      playoffType: type === "PLAYOFF" ? (stage.playoffType === PlayoffType.DOUBLE ? PlayoffType.DOUBLE : PlayoffType.SINGLE) : undefined,
      legsCount: type === "PLAYOFF" ? positive(stage.legsCount, 1, 2) : undefined,
      thirdPlaceMatch: type === "PLAYOFF" ? Boolean(stage.thirdPlaceMatch) : undefined,
    } satisfies StageGraphStage;
  });

  const transitions = (Array.isArray(value.transitions) ? value.transitions : []).flatMap((raw, index) => {
    if (!raw || typeof raw !== "object") return [];
    const transition = raw as Partial<StageGraphTransition>;
    const fromRank = transition.fromRank == null ? null : positive(transition.fromRank, 1, 128);
    const result: StageGraphResult = transition.result === "WINNER" || transition.result === "RUNNER_UP" || transition.result === "THIRD_PLACE" ? transition.result : "RANK";
    return [{
      id: typeof transition.id === "string" && transition.id.trim() ? transition.id : id("transition", index),
      fromStageId: typeof transition.fromStageId === "string" ? transition.fromStageId : "",
      toStageId: typeof transition.toStageId === "string" ? transition.toStageId : "",
      result,
      fromDivisionIndex: transition.fromDivisionIndex == null ? null : positive(transition.fromDivisionIndex, 1, 32),
      fromRank: result === "RANK" ? fromRank : null,
      toDivisionIndex: transition.toDivisionIndex == null ? null : positive(transition.toDivisionIndex, 1, 32),
      targetBracket: transition.targetBracket === "lower" ? "lower" : "upper",
    } satisfies StageGraphTransition];
  });

  const rawSuperCup = value.superCup && typeof value.superCup === "object" ? value.superCup as Partial<StageGraphSuperCup> : {};
  const playoffIds = new Set(stages.filter((stage) => stage.type === "PLAYOFF").map((stage) => stage.id));
  const sourcePlayoffIds = Array.isArray(rawSuperCup.sourcePlayoffIds)
    ? rawSuperCup.sourcePlayoffIds.filter((sourceId): sourceId is string => typeof sourceId === "string" && playoffIds.has(sourceId))
    : [];

  return {
    stages,
    transitions,
    superCup: {
      enabled: Boolean(rawSuperCup.enabled) && sourcePlayoffIds.length >= 2,
      name: typeof rawSuperCup.name === "string" && rawSuperCup.name.trim() ? rawSuperCup.name.trim() : "Суперкубок",
      sourcePlayoffIds,
    },
  };
}

export function validateStageGraph(graph: StageGraphBlueprint): StageGraphValidationIssue[] {
  const issues: StageGraphValidationIssue[] = [];
  const stageIds = new Set<string>();

  graph.stages.forEach((stage, index) => {
    if (stageIds.has(stage.id)) issues.push({ path: `stages.${index}.id`, message: "ID этапа должен быть уникальным." });
    stageIds.add(stage.id);
    if (!stage.name.trim()) issues.push({ path: `stages.${index}.name`, message: "Название этапа не может быть пустым." });
  });

  const outgoing = new Map<string, string[]>();
  graph.transitions.forEach((transition, index) => {
    if (!stageIds.has(transition.fromStageId)) issues.push({ path: `transitions.${index}.fromStageId`, message: "Исходный этап не найден." });
    if (!stageIds.has(transition.toStageId)) issues.push({ path: `transitions.${index}.toStageId`, message: "Целевой этап не найден." });
    if (transition.fromStageId === transition.toStageId && transition.fromStageId) issues.push({ path: `transitions.${index}`, message: "Этап нельзя соединить сам с собой." });
    if (transition.result === "RANK" && transition.fromRank === null) issues.push({ path: `transitions.${index}.fromRank`, message: "Для перехода по месту укажите ранг." });
    const list = outgoing.get(transition.fromStageId) ?? [];
    list.push(transition.toStageId);
    outgoing.set(transition.fromStageId, list);
  });

  const visiting = new Set<string>();
  const visited = new Set<string>();
  const walk = (stageId: string) => {
    if (visiting.has(stageId)) return true;
    if (visited.has(stageId)) return false;
    visiting.add(stageId);
    for (const next of outgoing.get(stageId) ?? []) if (walk(next)) return true;
    visiting.delete(stageId);
    visited.add(stageId);
    return false;
  };
  for (const stage of graph.stages) if (walk(stage.id)) {
    issues.push({ path: "transitions", message: "Схема этапов не может содержать циклы." });
    break;
  }

  const incoming = new Set(graph.transitions.map((transition) => transition.toStageId));
  if (graph.stages.length > 1 && graph.stages.filter((stage) => !incoming.has(stage.id)).length === 0) {
    issues.push({ path: "stages", message: "Нужен хотя бы один стартовый этап без входящих переходов." });
  }
  if (graph.superCup.enabled && graph.superCup.sourcePlayoffIds.length < 2) {
    issues.push({ path: "superCup.sourcePlayoffIds", message: "Для Суперкубка выберите минимум два плей-офф." });
  }
  return issues;
}

export function topologicalStageOrder(graph: StageGraphBlueprint): StageGraphStage[] {
  const incoming = new Map(graph.stages.map((stage) => [stage.id, 0]));
  for (const transition of graph.transitions) incoming.set(transition.toStageId, (incoming.get(transition.toStageId) ?? 0) + 1);
  const queue = graph.stages.filter((stage) => incoming.get(stage.id) === 0);
  const result: StageGraphStage[] = [];
  while (queue.length) {
    const stage = queue.shift()!;
    result.push(stage);
    for (const transition of graph.transitions.filter((item) => item.fromStageId === stage.id)) {
      const next = (incoming.get(transition.toStageId) ?? 0) - 1;
      incoming.set(transition.toStageId, next);
      if (next === 0) queue.push(graph.stages.find((item) => item.id === transition.toStageId)!);
    }
  }
  return result.length === graph.stages.length ? result : graph.stages;
}
