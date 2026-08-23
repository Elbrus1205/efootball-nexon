import { PlayoffType, SeedingMethod, SortRule } from "@prisma/client";

export type StageGraphStageType = "GROUPS" | "LEAGUE" | "PLAYOFF" | "SUPERCUP";
export type StageGraphResult = "RANK" | "WINNER" | "RUNNER_UP" | "THIRD_PLACE" | "UPPER_BRACKET_LOSER" | "LOWER_BRACKET_WINNER" | "WILDCARD" | "MANUAL";
export type StageGraphTargetBracket = "upper" | "lower";
export type StageGraphDistribution = "SOURCE_ORDER" | "SEED" | "SNAKE" | "RANDOM" | "MANUAL";

export type StageGraphDivision = {
  id: string;
  name: string;
  participantsCount: number | null;
  roundsCount: number;
  matchesPerOpponent: number;
  advancingRanks: Array<{ from: number; to: number }>;
};

export type StageGraphStage = {
  id: string;
  name: string;
  description: string;
  type: StageGraphStageType;
  order: number;
  divisionsCount: number;
  participantsPerDivision: number | null;
  roundsCount: number;
  matchesPerOpponent: number | null;
  divisions: StageGraphDivision[];
  participantCalculation: "AUTO" | "MANUAL";
  allowIncompleteDivisions: boolean;
  points: { win: number; draw: number; loss: number };
  sortRules: SortRule[];
  playoffType?: PlayoffType;
  bracketSize?: number | null;
  bracketFill?: "AUTO" | "MANUAL";
  bestOfWins?: number;
  legsCount?: number;
  thirdPlaceMatch?: boolean;
  penaltyRule?: "REQUIRED_ON_DRAW" | "EXTRA_MATCH";
  seedingMethod?: SeedingMethod;
};

export type StageGraphTransition = {
  id: string;
  fromStageId: string;
  fromDivisionId: string | null;
  toStageId: string;
  toDivisionId: string | null;
  result: StageGraphResult;
  fromDivisionIndex: number | null;
  fromRank: number | null;
  toRank: number | null;
  quantity: number | null;
  toDivisionIndex: number | null;
  targetBracket: StageGraphTargetBracket;
  toSlotStart: number | null;
  distribution: StageGraphDistribution;
  allowMerge: boolean;
};

export type StageGraphSuperCup = {
  enabled: boolean;
  stageId: string;
  name: string;
  sourcePlayoffIds: string[];
  result: Exclude<StageGraphResult, "RANK">;
  playoffType: PlayoffType;
  bracketSize: number | null;
  bestOfWins: number;
  legsCount: number;
  thirdPlaceMatch: boolean;
  penaltyRule: "REQUIRED_ON_DRAW" | "EXTRA_MATCH";
  seedingMethod: SeedingMethod;
};

export type StageGraphBlueprint = { version: 3; mode: "QUICK" | "VISUAL"; stages: StageGraphStage[]; transitions: StageGraphTransition[]; superCup: StageGraphSuperCup };
export type StageGraphValidationIssue = { path: string; message: string; stageId?: string; transitionId?: string };
export type StageGraphStanding = { registrationId: string; divisionIndex: number; divisionId?: string | null; rank: number | null; seed?: number | null };
export type StageGraphPlayoffResult = { registrationId: string; result: Exclude<StageGraphResult, "RANK">; seed?: number | null };
export type StageGraphAssignment = { registrationId: string; toStageId: string; toDivisionIndex: number; toDivisionId: string | null; targetBracket: StageGraphTargetBracket; toSlot: number | null; sourceTransitionId: string };

const DEFAULT_SORT_RULES = [SortRule.POINTS, SortRule.GOAL_DIFFERENCE, SortRule.GOALS_FOR, SortRule.WINS];
const RESULT_VALUES = new Set<StageGraphResult>(["RANK", "WINNER", "RUNNER_UP", "THIRD_PLACE", "UPPER_BRACKET_LOSER", "LOWER_BRACKET_WINNER", "WILDCARD", "MANUAL"]);

function fallbackId(prefix: string, index: number) { return `${prefix}_${index + 1}`; }
function text(value: unknown, fallback: string) { return typeof value === "string" && value.trim() ? value.trim() : fallback; }
function integer(value: unknown, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  return Math.max(min, Math.min(max, Number.isFinite(parsed) ? Math.floor(parsed) : fallback));
}
function optionalInteger(value: unknown, min: number, max: number) { return value === null || value === undefined || value === "" ? null : integer(value, min, min, max); }
function optionalPowerOfTwo(value: unknown, max = 256) {
  const parsed = optionalInteger(value, 2, max);
  return parsed === null ? null : 2 ** Math.ceil(Math.log2(parsed));
}
function stageType(value: unknown): StageGraphStageType { return value === "LEAGUE" || value === "PLAYOFF" || value === "SUPERCUP" ? value : "GROUPS"; }
function defaultDivisionName(type: StageGraphStageType, index: number, count: number, stageName: string) {
  if (count === 1) return stageName;
  return type === "GROUPS" ? `Группа ${String.fromCharCode(65 + index)}` : `Лига ${index + 1}`;
}
function normalizeRanges(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const range = item as { from?: unknown; to?: unknown };
    const from = integer(range.from, 1, 1, 256);
    return [{ from, to: integer(range.to, from, from, 256) }];
  });
}

function normalizeStage(raw: unknown, index: number): StageGraphStage {
  const value = raw && typeof raw === "object" ? raw as Partial<StageGraphStage> : {};
  const type = stageType(value.type);
  const isBracket = type === "PLAYOFF" || type === "SUPERCUP";
  const name = text(value.name, type === "SUPERCUP" ? "Суперкубок" : `Этап ${index + 1}`);
  const rawDivisions = Array.isArray(value.divisions) ? value.divisions : [];
  const divisionsCount = isBracket ? 1 : integer(value.divisionsCount ?? rawDivisions.length, 1, 1, 32);
  const participantsPerDivision = isBracket ? null : optionalInteger(value.participantsPerDivision, 2, 256);
  const roundsCount = integer(value.roundsCount, 1, 1, 256);
  const matchesPerOpponent = isBracket ? null : (optionalInteger(value.matchesPerOpponent, 1, 12) ?? 1);
  const stageId = text(value.id, fallbackId("stage", index));
  const divisions = isBracket ? [] : Array.from({ length: divisionsCount }, (_, divisionIndex) => {
    const rawDivision = rawDivisions[divisionIndex] && typeof rawDivisions[divisionIndex] === "object" ? rawDivisions[divisionIndex] as Partial<StageGraphDivision> : {};
    return {
      id: text(rawDivision.id, `${stageId}_division_${divisionIndex + 1}`),
      name: text(rawDivision.name, defaultDivisionName(type, divisionIndex, divisionsCount, name)),
      participantsCount: optionalInteger(rawDivision.participantsCount, 2, 256) ?? participantsPerDivision,
      roundsCount: integer(rawDivision.roundsCount, roundsCount, 1, 256),
      matchesPerOpponent: integer(rawDivision.matchesPerOpponent, matchesPerOpponent ?? 1, 1, 12),
      advancingRanks: normalizeRanges(rawDivision.advancingRanks),
    } satisfies StageGraphDivision;
  });
  const rawPoints: Partial<StageGraphStage["points"]> = value.points && typeof value.points === "object" ? value.points : {};
  const rawSortRules = Array.isArray(value.sortRules) ? value.sortRules : [];
  const sortRules = rawSortRules.filter((rule): rule is SortRule => Object.values(SortRule).includes(rule as SortRule));
  return {
    id: stageId,
    name,
    description: typeof value.description === "string" ? value.description.trim() : "",
    type,
    order: integer(value.order, index + 1, 1, 999),
    divisionsCount,
    participantsPerDivision,
    roundsCount,
    matchesPerOpponent,
    divisions,
    participantCalculation: value.participantCalculation === "MANUAL" ? "MANUAL" : "AUTO",
    allowIncompleteDivisions: Boolean(value.allowIncompleteDivisions),
    points: { win: integer(rawPoints.win, 3, 0, 99), draw: integer(rawPoints.draw, 1, 0, 99), loss: integer(rawPoints.loss, 0, 0, 99) },
    sortRules: sortRules.length ? sortRules : [...DEFAULT_SORT_RULES],
    playoffType: isBracket ? (value.playoffType === PlayoffType.DOUBLE ? PlayoffType.DOUBLE : PlayoffType.SINGLE) : undefined,
    bracketSize: isBracket ? optionalPowerOfTwo(value.bracketSize) : null,
    bracketFill: isBracket && value.bracketFill === "MANUAL" ? "MANUAL" : isBracket ? "AUTO" : undefined,
    bestOfWins: isBracket ? integer(value.bestOfWins, 1, 1, 9) : undefined,
    legsCount: isBracket ? integer(value.legsCount, 1, 1, 2) : undefined,
    thirdPlaceMatch: isBracket ? Boolean(value.thirdPlaceMatch) : undefined,
    penaltyRule: isBracket && value.penaltyRule === "EXTRA_MATCH" ? "EXTRA_MATCH" : isBracket ? "REQUIRED_ON_DRAW" : undefined,
    seedingMethod: isBracket && Object.values(SeedingMethod).includes(value.seedingMethod as SeedingMethod) ? value.seedingMethod : isBracket ? SeedingMethod.GROUP_RESULTS : undefined,
  };
}

function normalizeTransition(raw: unknown, index: number): StageGraphTransition | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Partial<StageGraphTransition>;
  const result = RESULT_VALUES.has(value.result as StageGraphResult) ? value.result as StageGraphResult : "RANK";
  const fromRank = result === "RANK" ? optionalInteger(value.fromRank, 1, 256) : null;
  return {
    id: text(value.id, fallbackId("transition", index)),
    fromStageId: typeof value.fromStageId === "string" ? value.fromStageId : "",
    fromDivisionId: typeof value.fromDivisionId === "string" && value.fromDivisionId ? value.fromDivisionId : null,
    toStageId: typeof value.toStageId === "string" ? value.toStageId : "",
    toDivisionId: typeof value.toDivisionId === "string" && value.toDivisionId ? value.toDivisionId : null,
    result,
    fromDivisionIndex: value.fromDivisionIndex == null ? null : integer(value.fromDivisionIndex, 1, 1, 32),
    fromRank,
    toRank: result === "RANK" ? integer(value.toRank, fromRank ?? 1, fromRank ?? 1, 256) : null,
    quantity: optionalInteger(value.quantity, 1, 256),
    toDivisionIndex: value.toDivisionIndex == null ? null : integer(value.toDivisionIndex, 1, 1, 32),
    targetBracket: value.targetBracket === "lower" ? "lower" : "upper",
    toSlotStart: optionalInteger(value.toSlotStart, 1, 256),
    distribution: value.distribution === "SEED" || value.distribution === "SNAKE" || value.distribution === "RANDOM" || value.distribution === "MANUAL" ? value.distribution : "SOURCE_ORDER",
    allowMerge: value.allowMerge !== false,
  };
}

function normalizeSuperCup(raw: unknown): StageGraphSuperCup {
  const value = raw && typeof raw === "object" ? raw as Partial<StageGraphSuperCup> : {};
  return {
    enabled: Boolean(value.enabled), stageId: text(value.stageId, "supercup"), name: text(value.name, "Суперкубок"),
    sourcePlayoffIds: Array.isArray(value.sourcePlayoffIds) ? value.sourcePlayoffIds.filter((id): id is string => typeof id === "string" && Boolean(id)) : [],
    result: value.result && RESULT_VALUES.has(value.result) ? value.result : "WINNER",
    playoffType: value.playoffType === PlayoffType.DOUBLE ? PlayoffType.DOUBLE : PlayoffType.SINGLE,
    bracketSize: optionalPowerOfTwo(value.bracketSize), bestOfWins: integer(value.bestOfWins, 1, 1, 9), legsCount: integer(value.legsCount, 1, 1, 2),
    thirdPlaceMatch: Boolean(value.thirdPlaceMatch), penaltyRule: value.penaltyRule === "EXTRA_MATCH" ? "EXTRA_MATCH" : "REQUIRED_ON_DRAW",
    seedingMethod: Object.values(SeedingMethod).includes(value.seedingMethod as SeedingMethod) ? value.seedingMethod! : SeedingMethod.GROUP_RESULTS,
  };
}

export function normalizeStageGraph(input: unknown): StageGraphBlueprint {
  const value = input && typeof input === "object" ? input as Partial<StageGraphBlueprint> : {};
  const stages = (Array.isArray(value.stages) ? value.stages : []).map(normalizeStage);
  const transitions = (Array.isArray(value.transitions) ? value.transitions : []).map(normalizeTransition).filter((item): item is StageGraphTransition => item !== null);
  const superCup = normalizeSuperCup(value.superCup);
  if (superCup.enabled) {
    const playoffIds = new Set(stages.filter((stage) => stage.type === "PLAYOFF").map((stage) => stage.id));
    superCup.sourcePlayoffIds = [...new Set(superCup.sourcePlayoffIds.filter((stageId) => playoffIds.has(stageId)))];
    const existingIndex = stages.findIndex((stage) => stage.id === superCup.stageId || stage.type === "SUPERCUP");
    const existing = existingIndex >= 0 ? stages[existingIndex] : undefined;
    const cupStage = normalizeStage({ ...existing, id: existing?.id ?? superCup.stageId, name: superCup.name, type: "SUPERCUP", playoffType: superCup.playoffType, bracketSize: superCup.bracketSize, bestOfWins: superCup.bestOfWins, legsCount: superCup.legsCount, thirdPlaceMatch: superCup.thirdPlaceMatch, penaltyRule: superCup.penaltyRule, seedingMethod: superCup.seedingMethod, order: stages.length + 1 }, existingIndex >= 0 ? existingIndex : stages.length);
    superCup.stageId = cupStage.id;
    if (existingIndex >= 0) stages[existingIndex] = cupStage; else stages.push(cupStage);
    for (const sourceId of superCup.sourcePlayoffIds) {
      if (!transitions.some((transition) => transition.fromStageId === sourceId && transition.toStageId === cupStage.id)) transitions.push(normalizeTransition({ id: `supercup_${sourceId}`, fromStageId: sourceId, toStageId: cupStage.id, result: superCup.result }, transitions.length)!);
    }
  }
  const legacyAdvanced = stages.filter((stage) => stage.type !== "PLAYOFF").length > 1 || superCup.enabled || transitions.some((transition) => transition.result !== "RANK");
  return { version: 3, mode: value.mode === "VISUAL" || (value.mode !== "QUICK" && legacyAdvanced) ? "VISUAL" : "QUICK", stages, transitions, superCup };
}

export function transitionParticipantCount(graph: StageGraphBlueprint, transition: StageGraphTransition) {
  if (transition.quantity !== null) return transition.quantity;
  if (transition.result !== "RANK") return 1;
  const source = graph.stages.find((stage) => stage.id === transition.fromStageId);
  const rankCount = Math.max(0, (transition.toRank ?? transition.fromRank ?? 0) - (transition.fromRank ?? 1) + 1);
  if (!source || transition.fromDivisionId !== null || transition.fromDivisionIndex !== null) return rankCount;
  return rankCount * Math.max(source.divisionsCount, 1);
}

function transitionSignature(transition: StageGraphTransition) {
  return [transition.fromStageId, transition.fromDivisionId ?? transition.fromDivisionIndex ?? "*", transition.toStageId, transition.toDivisionId ?? transition.toDivisionIndex ?? "*", transition.result, transition.fromRank, transition.toRank, transition.targetBracket, transition.toSlotStart].join(":");
}

export function validateStageGraph(graph: StageGraphBlueprint): StageGraphValidationIssue[] {
  const issues: StageGraphValidationIssue[] = [];
  const stageIds = new Set<string>();
  const stageNames = new Map<string, number>();
  graph.stages.forEach((stage, index) => {
    if (stageIds.has(stage.id)) issues.push({ path: `stages.${index}.id`, stageId: stage.id, message: "ID этапа должен быть уникальным." });
    stageIds.add(stage.id);
    const normalizedName = stage.name.trim().toLocaleLowerCase("ru");
    stageNames.set(normalizedName, (stageNames.get(normalizedName) ?? 0) + 1);
    if (!stage.name.trim()) issues.push({ path: `stages.${index}.name`, stageId: stage.id, message: "Название этапа не может быть пустым." });
    const divisionIds = new Set<string>();
    stage.divisions.forEach((division, divisionIndex) => {
      if (divisionIds.has(division.id)) issues.push({ path: `stages.${index}.divisions.${divisionIndex}.id`, stageId: stage.id, message: `В этапе «${stage.name}» ID групп или лиг должны быть уникальными.` });
      divisionIds.add(division.id);
      if (!division.name.trim()) issues.push({ path: `stages.${index}.divisions.${divisionIndex}.name`, stageId: stage.id, message: "Название группы или лиги не может быть пустым." });
    });
  });
  graph.stages.forEach((stage, index) => {
    if ((stageNames.get(stage.name.trim().toLocaleLowerCase("ru")) ?? 0) > 1) issues.push({ path: `stages.${index}.name`, stageId: stage.id, message: `Название «${stage.name}» повторяется. Переименуйте этап, чтобы схема читалась однозначно.` });
  });
  const outgoing = new Map<string, string[]>();
  const signatures = new Set<string>();
  const occupiedSlots = new Map<string, string>();
  graph.transitions.forEach((transition, index) => {
    const source = graph.stages.find((stage) => stage.id === transition.fromStageId);
    const target = graph.stages.find((stage) => stage.id === transition.toStageId);
    const issue = (path: string, message: string) => issues.push({ path: `transitions.${index}${path}`, transitionId: transition.id, message });
    if (!source) issue(".fromStageId", "Исходный этап не найден.");
    if (!target) issue(".toStageId", "Целевой этап не найден.");
    if (transition.fromStageId === transition.toStageId && transition.fromStageId) issue("", "Этап нельзя соединить сам с собой.");
    if (transition.result === "RANK" && transition.fromRank === null) issue(".fromRank", "Для перехода по месту укажите начальное место.");
    if (transition.fromDivisionId && source && !source.divisions.some((division) => division.id === transition.fromDivisionId)) issue(".fromDivisionId", "Исходная группа или лига не найдена.");
    if (transition.toDivisionId && target && !target.divisions.some((division) => division.id === transition.toDivisionId)) issue(".toDivisionId", "Целевая группа или лига не найдена.");
    const signature = transitionSignature(transition);
    if (signatures.has(signature)) issue("", "Этот переход дублирует уже настроенный переход.");
    signatures.add(signature);
    const count = transitionParticipantCount(graph, transition);
    if (transition.toSlotStart !== null) for (let slot = transition.toSlotStart; slot < transition.toSlotStart + count; slot += 1) {
      const key = `${transition.toStageId}:${transition.targetBracket}:${slot}`;
      if (occupiedSlots.has(key)) issue(".toSlotStart", `Слот ${slot} этапа «${target?.name ?? transition.toStageId}» уже занят другим переходом.`); else occupiedSlots.set(key, transition.id);
    }
    const list = outgoing.get(transition.fromStageId) ?? [];
    list.push(transition.toStageId);
    outgoing.set(transition.fromStageId, list);
  });
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const hasCycle = (stageId: string): boolean => {
    if (visiting.has(stageId)) return true;
    if (visited.has(stageId)) return false;
    visiting.add(stageId);
    for (const next of outgoing.get(stageId) ?? []) if (hasCycle(next)) return true;
    visiting.delete(stageId); visited.add(stageId); return false;
  };
  if (graph.stages.some((stage) => hasCycle(stage.id))) issues.push({ path: "transitions", message: "Схема этапов содержит цикл. Удалите переход, который возвращает участников на предыдущий этап." });
  const incomingByStage = new Map<string, StageGraphTransition[]>();
  for (const transition of graph.transitions) incomingByStage.set(transition.toStageId, [...(incomingByStage.get(transition.toStageId) ?? []), transition]);
  graph.stages.forEach((stage, index) => {
    const incoming = incomingByStage.get(stage.id) ?? [];
    const incomingParticipants = incoming.reduce((sum, transition) => sum + transitionParticipantCount(graph, transition), 0);
    if ((stage.type === "PLAYOFF" || stage.type === "SUPERCUP") && incoming.length) {
      if (stage.bracketSize !== null && stage.bracketSize !== undefined && incomingParticipants > stage.bracketSize) issues.push({ path: `stages.${index}.bracketSize`, stageId: stage.id, message: `${stage.name} рассчитан на ${stage.bracketSize} участников, но переходы передают ${incomingParticipants}. Уменьшите диапазон мест или увеличьте размер сетки.` });
    } else if (incoming.length && !stage.allowIncompleteDivisions) {
      const capacity = stage.divisions.reduce((sum, division) => sum + (division.participantsCount ?? 0), 0);
      if (capacity > 0 && incomingParticipants > capacity) issues.push({ path: `stages.${index}.divisions`, stageId: stage.id, message: `Этап «${stage.name}» вмещает ${capacity} участников, а переходы передают ${incomingParticipants}.` });
    }
  });
  if (graph.stages.length > 1) {
    const connected = new Set(graph.transitions.flatMap((transition) => [transition.fromStageId, transition.toStageId]));
    graph.stages.forEach((stage, index) => { if (!connected.has(stage.id)) issues.push({ path: `stages.${index}`, stageId: stage.id, message: `Этап «${stage.name}» недостижим: добавьте входящий или исходящий переход.` }); });
  }
  if (graph.superCup.enabled && graph.superCup.sourcePlayoffIds.length < 2) issues.push({ path: "superCup.sourcePlayoffIds", stageId: graph.superCup.stageId, message: "Для Суперкубка выберите минимум два плей-офф." });
  return issues;
}

export function topologicalStageOrder(graph: StageGraphBlueprint): StageGraphStage[] {
  const incoming = new Map(graph.stages.map((stage) => [stage.id, 0]));
  for (const transition of graph.transitions) if (incoming.has(transition.toStageId) && incoming.has(transition.fromStageId)) incoming.set(transition.toStageId, (incoming.get(transition.toStageId) ?? 0) + 1);
  const queue = graph.stages.filter((stage) => incoming.get(stage.id) === 0).sort((a, b) => a.order - b.order);
  const result: StageGraphStage[] = [];
  while (queue.length) {
    const stage = queue.shift()!; result.push(stage);
    for (const transition of graph.transitions.filter((item) => item.fromStageId === stage.id)) {
      const next = (incoming.get(transition.toStageId) ?? 0) - 1; incoming.set(transition.toStageId, next);
      if (next === 0) { const target = graph.stages.find((item) => item.id === transition.toStageId); if (target) queue.push(target); }
    }
    queue.sort((a, b) => a.order - b.order);
  }
  return result.length === graph.stages.length ? result : [...graph.stages].sort((a, b) => a.order - b.order);
}

export function resolveStageGraphAssignments(params: { graph: StageGraphBlueprint; fromStageId: string; standings?: StageGraphStanding[]; playoffResults?: StageGraphPlayoffResult[] }) {
  const assignments: StageGraphAssignment[] = [];
  const seen = new Set<string>();
  for (const transition of params.graph.transitions.filter((item) => item.fromStageId === params.fromStageId)) {
    let candidates: Array<{ registrationId: string; seed?: number | null }> = transition.result === "RANK"
      ? (params.standings ?? []).filter((standing) => standing.rank !== null && transition.fromRank !== null && standing.rank >= transition.fromRank && standing.rank <= (transition.toRank ?? transition.fromRank) && (transition.fromDivisionId === null || standing.divisionId === transition.fromDivisionId) && (transition.fromDivisionIndex === null || standing.divisionIndex === transition.fromDivisionIndex))
      : (params.playoffResults ?? []).filter((result) => result.result === transition.result);
    if (transition.distribution === "SEED") candidates = [...candidates].sort((left, right) => (left.seed ?? Number.MAX_SAFE_INTEGER) - (right.seed ?? Number.MAX_SAFE_INTEGER));
    if (transition.quantity !== null) candidates = candidates.slice(0, transition.quantity);
    const target = params.graph.stages.find((stage) => stage.id === transition.toStageId);
    const targetDivisionCount = Math.max(target?.divisionsCount ?? 1, 1);
    for (const [index, candidate] of candidates.entries()) {
      const duplicateKey = `${transition.toStageId}:${candidate.registrationId}`;
      if (!candidate.registrationId || seen.has(duplicateKey)) continue;
      seen.add(duplicateKey);
      const snakeCycle = Math.floor(index / targetDivisionCount);
      const distributedIndex = transition.distribution === "SNAKE" && snakeCycle % 2 === 1 ? targetDivisionCount - (index % targetDivisionCount) : (index % targetDivisionCount) + 1;
      const toDivisionIndex = transition.toDivisionId || transition.toDivisionIndex ? transition.toDivisionIndex ?? 1 : distributedIndex;
      assignments.push({ registrationId: candidate.registrationId, toStageId: transition.toStageId, toDivisionIndex, toDivisionId: transition.toDivisionId, targetBracket: transition.targetBracket, toSlot: transition.toSlotStart === null ? null : transition.toSlotStart + index, sourceTransitionId: transition.id });
    }
  }
  return assignments;
}

export function describeStageGraphTransition(graph: StageGraphBlueprint, transition: StageGraphTransition) {
  const source = graph.stages.find((stage) => stage.id === transition.fromStageId);
  const target = graph.stages.find((stage) => stage.id === transition.toStageId);
  const sourceDivision = source?.divisions.find((division) => division.id === transition.fromDivisionId) ?? (transition.fromDivisionIndex ? source?.divisions[transition.fromDivisionIndex - 1] : null);
  const targetDivision = target?.divisions.find((division) => division.id === transition.toDivisionId) ?? (transition.toDivisionIndex ? target?.divisions[transition.toDivisionIndex - 1] : null);
  const result = transition.result === "RANK" ? `мест${transition.fromRank === transition.toRank ? "о" : "а"} ${transition.fromRank ?? 1}${transition.fromRank === transition.toRank ? "" : `–${transition.toRank ?? transition.fromRank ?? 1}`}` : ({ WINNER: "победитель", RUNNER_UP: "финалист", THIRD_PLACE: "третье место", UPPER_BRACKET_LOSER: "проигравший верхней сетки", LOWER_BRACKET_WINNER: "победитель нижней сетки", WILDCARD: "wildcard", MANUAL: "ручной выбор" } as const)[transition.result];
  const targetSuffix = target?.type === "PLAYOFF" || target?.type === "SUPERCUP" ? `, ${transition.targetBracket === "lower" ? "нижняя" : "верхняя"} сетка` : "";
  return `${sourceDivision?.name ?? source?.name ?? "Неизвестный этап"}, ${result} → ${targetDivision?.name ?? target?.name ?? "Неизвестный этап"}${targetSuffix}`;
}
