export type InactiveParticipantState = {
  isActive: boolean;
  inactiveFromRound: number | null;
};

export type InactiveParticipantSide = {
  playerId: string | null;
  entry: (InactiveParticipantState & {
    rosterMembers?: Array<{ userId: string; status: string }>;
  }) | null;
};

function isInactiveAtRound(state: InactiveParticipantState, round: number) {
  return !state.isActive && state.inactiveFromRound !== null && round >= state.inactiveFromRound;
}

export function shouldExcludeMatchFromStatistics(
  round: number,
  sideOne: InactiveParticipantState,
  sideTwo: InactiveParticipantState,
  alreadyExcluded = false,
) {
  return alreadyExcluded || isInactiveAtRound(sideOne, round) || isInactiveAtRound(sideTwo, round);
}

export function isUserInactiveForMatch(
  userId: string,
  round: number,
  sideOne: InactiveParticipantSide,
  sideTwo: InactiveParticipantSide,
) {
  const isUserOnInactiveSide = (side: InactiveParticipantSide) => {
    if (!side.entry) return false;

    const isDirectPlayer = side.playerId === userId;
    const isAcceptedRosterMember = (side.entry.rosterMembers ?? []).some(
      (member) => member.userId === userId && member.status === "ACCEPTED",
    );

    return (isDirectPlayer || isAcceptedRosterMember) && isInactiveAtRound(side.entry, round);
  };

  return isUserOnInactiveSide(sideOne) || isUserOnInactiveSide(sideTwo);
}
