type CaptainTeamMatch = {
  id: string;
  isCaptainAssignedTeamMatch: boolean;
  isTeamCaptainTiebreak?: boolean;
  stageId?: string | null;
  groupId?: string | null;
  bracketId?: string | null;
  round: number;
  matchNumber: number;
  participant1EntryId?: string | null;
  participant2EntryId?: string | null;
  player1Id?: string | null;
  player2Id?: string | null;
  createdAt: Date | string;
  stage?: { orderIndex: number } | null;
  group?: { orderIndex: number } | null;
};

export function isCaptainTeamMatchVisibleToUser(params: {
  match: Pick<CaptainTeamMatch, "participant1EntryId" | "participant2EntryId" | "player1Id" | "player2Id">;
  currentUserId: string;
  currentCaptainRegistrationId?: string | null;
  captainsCreateTeamMatches: boolean;
}) {
  if (!params.captainsCreateTeamMatches) return false;
  if (
    params.match.player1Id === params.currentUserId ||
    params.match.player2Id === params.currentUserId
  ) {
    return true;
  }
  return Boolean(
    params.currentCaptainRegistrationId &&
      (params.match.participant1EntryId === params.currentCaptainRegistrationId ||
        params.match.participant2EntryId === params.currentCaptainRegistrationId),
  );
}

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
    if (!match.isCaptainAssignedTeamMatch || match.isTeamCaptainTiebreak) continue;
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

  const tiebreakOrder = Number(a.isTeamCaptainTiebreak) - Number(b.isTeamCaptainTiebreak);
  if (tiebreakOrder) return tiebreakOrder;

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
