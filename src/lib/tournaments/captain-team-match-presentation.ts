type CaptainTeamMatch = {
  id: string;
  isCaptainAssignedTeamMatch: boolean;
  stageId?: string | null;
  groupId?: string | null;
  bracketId?: string | null;
  round: number;
  matchNumber: number;
  participant1EntryId?: string | null;
  participant2EntryId?: string | null;
  createdAt: Date | string;
  stage?: { orderIndex: number } | null;
  group?: { orderIndex: number } | null;
};

function fixtureKey(match: CaptainTeamMatch) {
  return [
    match.stageId ?? "stage",
    match.groupId ?? "group",
    match.bracketId ?? "bracket",
    match.round,
    match.matchNumber,
    match.participant1EntryId ?? "home",
    match.participant2EntryId ?? "away",
  ].join(":");
}

function compareCreatedMatches(a: CaptainTeamMatch, b: CaptainTeamMatch) {
  return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime() || a.id.localeCompare(b.id);
}

export function buildCaptainTeamMatchSlotLabels(matches: readonly CaptainTeamMatch[]) {
  const fixtures = new Map<string, CaptainTeamMatch[]>();

  for (const match of matches) {
    if (!match.isCaptainAssignedTeamMatch) continue;
    const key = fixtureKey(match);
    fixtures.set(key, [...(fixtures.get(key) ?? []), match]);
  }

  const labels = new Map<string, string>();
  for (const fixtureMatches of fixtures.values()) {
    const orderedMatches = [...fixtureMatches].sort(compareCreatedMatches);
    orderedMatches.forEach((match, index) => {
      labels.set(match.id, `Пара ${index + 1} из ${orderedMatches.length}`);
    });
  }

  return labels;
}

export function compareCaptainAssignedTeamMatches(
  a: CaptainTeamMatch,
  b: CaptainTeamMatch,
  currentRegistrationId?: string | null,
) {
  if (!a.isCaptainAssignedTeamMatch || !b.isCaptainAssignedTeamMatch) return null;

  const stageOrder = (a.stage?.orderIndex ?? 999) - (b.stage?.orderIndex ?? 999);
  if (stageOrder) return stageOrder;

  const roundOrder = a.round - b.round;
  if (roundOrder) return roundOrder;

  const groupOrder = (a.group?.orderIndex ?? 0) - (b.group?.orderIndex ?? 0);
  if (groupOrder) return groupOrder;

  if (currentRegistrationId) {
    const aHomeOrder = a.participant1EntryId === currentRegistrationId ? 0 : 1;
    const bHomeOrder = b.participant1EntryId === currentRegistrationId ? 0 : 1;
    if (aHomeOrder !== bHomeOrder) return aHomeOrder - bHomeOrder;
  }

  return a.matchNumber - b.matchNumber || compareCreatedMatches(a, b);
}
