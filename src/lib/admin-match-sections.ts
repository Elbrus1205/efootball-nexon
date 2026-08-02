import { StageType } from "@prisma/client";

export type AdminMatchSectionItem = {
  id: string;
  round: number;
  matchNumber: number;
  stageId?: string | null;
  stage?: {
    id?: string;
    name: string | null;
    type: StageType;
    orderIndex?: number;
  } | null;
  group?: unknown | null;
};

export function isAdminTourMatch(match: AdminMatchSectionItem) {
  return match.stage?.type === StageType.GROUP_STAGE || match.stage?.type === StageType.LEAGUE || Boolean(match.group);
}

export function adminMatchSectionKey(match: AdminMatchSectionItem) {
  const stageKey = match.stageId ?? match.stage?.id ?? `${match.stage?.type ?? "unstaged"}:${match.stage?.name ?? ""}`;
  return `${stageKey}:${isAdminTourMatch(match) ? "tour" : "round"}:${match.round}`;
}

function adminMatchSectionLabel(match: AdminMatchSectionItem) {
  const unit = isAdminTourMatch(match) ? "Тур" : "Раунд";
  const stageName = match.stage?.name?.trim();
  return stageName ? `${stageName} · ${unit} ${match.round}` : `${unit} ${match.round}`;
}

export function buildAdminMatchSections<T extends AdminMatchSectionItem>(matches: readonly T[]) {
  const grouped = new Map<string, T[]>();

  for (const match of matches) {
    const key = adminMatchSectionKey(match);
    grouped.set(key, [...(grouped.get(key) ?? []), match]);
  }

  return Array.from(grouped, ([key, sectionMatches]) => {
    const firstMatch = sectionMatches[0];
    return {
      key,
      label: adminMatchSectionLabel(firstMatch),
      stageOrder: firstMatch.stage?.orderIndex ?? Number.MAX_SAFE_INTEGER,
      round: firstMatch.round,
      matches: [...sectionMatches].sort((a, b) => a.matchNumber - b.matchNumber || a.id.localeCompare(b.id)),
    };
  }).sort(
    (a, b) =>
      a.stageOrder - b.stageOrder ||
      a.round - b.round ||
      a.label.localeCompare(b.label, "ru") ||
      a.key.localeCompare(b.key),
  );
}
