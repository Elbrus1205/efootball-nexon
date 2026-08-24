export type CaptainTeamFixtureRow = {
  id: string;
  stageId: string | null;
  groupId: string | null;
  bracketId: string | null;
  round: number;
  matchNumber: number;
  bracket: string;
  seriesKey: string | null;
  legNumber: number | null;
  canExpand: boolean;
};

export type CaptainTeamFixtureExpansion = {
  sourceId: string;
  additionalRows: number;
};

export function planCaptainTeamFixtureExpansion(
  rows: readonly CaptainTeamFixtureRow[],
  rosterSize: number,
): CaptainTeamFixtureExpansion[] {
  if (rosterSize < 2) return [];

  const groups = new Map<string, CaptainTeamFixtureRow[]>();

  for (const row of rows) {
    const key = JSON.stringify([
      row.stageId,
      row.groupId,
      row.bracketId,
      row.round,
      row.matchNumber,
      row.bracket,
      row.seriesKey,
      row.legNumber,
    ]);
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }

  const plan: CaptainTeamFixtureExpansion[] = [];
  for (const group of groups.values()) {
    if (group.length >= rosterSize) continue;
    const source = group.find((row) => row.canExpand);
    if (!source) continue;
    plan.push({ sourceId: source.id, additionalRows: rosterSize - group.length });
  }

  return plan;
}
