export type ActiveParticipantReuseCandidate = {
  registrationId: string;
  userId: string;
  participantMode: "SINGLE" | "COOP" | "TEAM";
  rosterMemberUserIds: string[];
};

/**
 * A solo registration can be moved after replacement because its played
 * matches stay attached to the old registration. Team and coop rosters have
 * multiple identities that cannot be merged into a new club slot safely.
 */
export function canReuseActiveParticipant(candidate: ActiveParticipantReuseCandidate, targetRegistrationId: string) {
  if (candidate.registrationId === targetRegistrationId || candidate.participantMode !== "SINGLE") return false;
  return candidate.rosterMemberUserIds.every((userId) => userId === candidate.userId);
}
