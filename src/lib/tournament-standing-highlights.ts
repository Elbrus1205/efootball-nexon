import type { StandingHighlight } from "@/lib/tournament-public-view";
import { normalizeFormatBlueprint } from "@/lib/format-blueprint";
import { getStandingZoneStyle, relegationStyle, type StandingColorStyle } from "@/lib/tournament-standing-colors";
import type { StageGraphStage, StageGraphTransition } from "@/lib/tournament-stage-graph";

function selectedStageIdFromSettings(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const graphId = (value as { graphId?: unknown }).graphId;
  return typeof graphId === "string" && graphId.trim() ? graphId : null;
}

function sourceDivisionIndexes(sourceStage: StageGraphStage, transition: StageGraphTransition) {
  const explicitIndex = transition.fromDivisionIndex
    ?? (transition.fromDivisionId ? sourceStage.divisions.findIndex((division) => division.id === transition.fromDivisionId) + 1 : 0);
  if (explicitIndex > 0) return [explicitIndex];
  return Array.from({ length: Math.max(sourceStage.divisions.length, sourceStage.divisionsCount, 1) }, (_, index) => index + 1);
}

function isRelegationTarget(stage: StageGraphStage) {
  return /вылет|relegat/i.test(stage.name);
}

function transitionLabel(targetStage: StageGraphStage, transition: StageGraphTransition) {
  if (transition.targetBracket === "lower" && targetStage.type === "PLAYOFF") return `${targetStage.name} • Нижняя сетка`;
  return targetStage.name;
}

function rankTransitionsForStage(
  blueprint: ReturnType<typeof normalizeFormatBlueprint>,
  selectedStageId: string | null,
) {
  return blueprint.stageGraph?.transitions
    .filter((transition) => transition.result === "RANK" && transition.fromRank !== null && transition.toRank !== null)
    .filter((transition) => !selectedStageId || transition.fromStageId === selectedStageId)
    .map((transition, index) => ({ transition, index }))
    .sort((left, right) => {
      const rankDifference = (left.transition.fromRank ?? Number.MAX_SAFE_INTEGER) - (right.transition.fromRank ?? Number.MAX_SAFE_INTEGER);
      return rankDifference || left.index - right.index;
    }) ?? [];
}

export function buildStandingHighlightsFromBlueprint(params: {
  formatBlueprintJson: unknown;
  selectedStageId?: string | null;
  stageSettingsJson?: unknown;
}) {
  const blueprint = normalizeFormatBlueprint(params.formatBlueprintJson);
  const selectedStageId = params.selectedStageId ?? selectedStageIdFromSettings(params.stageSettingsJson);
  const byDivision = new Map<number, StandingHighlight[]>();
  const styleByTarget = new Map<string, StandingColorStyle>();
  let styleIndex = 0;

  for (const { transition } of rankTransitionsForStage(blueprint, selectedStageId)) {
    const sourceStage = blueprint.stageGraph?.stages.find((stage) => stage.id === transition.fromStageId);
    const targetStage = blueprint.stageGraph?.stages.find((stage) => stage.id === transition.toStageId);
    if (!sourceStage || !targetStage || (sourceStage.type !== "GROUPS" && sourceStage.type !== "LEAGUE")) continue;

    const targetKey = `${sourceStage.id}:${targetStage.id}:${transition.targetBracket}`;
    if (!styleByTarget.has(targetKey)) {
      styleByTarget.set(targetKey, isRelegationTarget(targetStage) ? relegationStyle : getStandingZoneStyle(styleIndex++));
    }
    const style = styleByTarget.get(targetKey)!;
    const label = transitionLabel(targetStage, transition);

    for (const divisionIndex of sourceDivisionIndexes(sourceStage, transition)) {
      const bucket = byDivision.get(divisionIndex) ?? [];
      bucket.push({
        fromRank: transition.fromRank!,
        toRank: transition.toRank!,
        label,
        rowClass: style.rowClass,
        badgeClass: style.badgeClass,
        rankClass: style.rankClass,
        dotClass: style.dotClass,
      });
      byDivision.set(divisionIndex, bucket);
    }
  }

  return byDivision;
}
