export type InactiveParticipantState = {
  isActive: boolean;
  inactiveFromRound: number | null;
  inactiveSince?: Date | null;
};

export type InactiveParticipantSide = {
  playerId: string | null;
  entry: (InactiveParticipantState & {
    rosterMembers?: Array<{ userId: string; status: string }>;
  }) | null;
};

function isInactiveAtRound(state: InactiveParticipantState, round: number, playedAt?: Date | null) {
  if (state.isActive || state.inactiveFromRound === null || round < state.inactiveFromRound) return false;
  if (state.inactiveSince && playedAt && playedAt < state.inactiveSince) return false;
  return true;
}

export function shouldExcludeMatchFromStatistics(
  round: number,
  sideOne: InactiveParticipantState,
  sideTwo: InactiveParticipantState,
  playedAtOrAlreadyExcluded?: Date | null | boolean,
  alreadyExcluded = false,
) {
  const playedAt = typeof playedAtOrAlreadyExcluded === "boolean" ? undefined : playedAtOrAlreadyExcluded;
  const wasAlreadyExcluded = typeof playedAtOrAlreadyExcluded === "boolean" ? playedAtOrAlreadyExcluded : alreadyExcluded;
  return wasAlreadyExcluded || isInactiveAtRound(sideOne, round, playedAt) || isInactiveAtRound(sideTwo, round, playedAt);
}

export function isUserInactiveForMatch(
  userId: string,
  round: number,
  sideOne: InactiveParticipantSide,
  sideTwo: InactiveParticipantSide,
  playedAt?: Date | null,
) {
  const isUserOnInactiveSide = (side: InactiveParticipantSide) => {
    if (!side.entry) return false;

    const isDirectPlayer = side.playerId === userId;
    const isAcceptedRosterMember = (side.entry.rosterMembers ?? []).some(
      (member) => member.userId === userId && member.status === "ACCEPTED",
    );

    return (isDirectPlayer || isAcceptedRosterMember) && isInactiveAtRound(side.entry, round, playedAt);
  };

  return isUserOnInactiveSide(sideOne) || isUserOnInactiveSide(sideTwo);
}
