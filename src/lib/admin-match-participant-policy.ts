import { MatchStatus } from "@prisma/client";

const LOCKED_RESULT_STATUSES = new Set<MatchStatus>([
  MatchStatus.CONFIRMED,
  MatchStatus.FINISHED,
  MatchStatus.FORFEIT,
]);

export function canEditMatchParticipants(match: {
  status: MatchStatus;
  player1Score: number | null;
  player2Score: number | null;
  winnerId: string | null;
  isCaptainAssignedTeamMatch?: boolean;
  isTeamCaptainTiebreak?: boolean;
}, requested: {
  player1Id?: unknown;
  player2Id?: unknown;
  participant1EntryId?: unknown;
  participant2EntryId?: unknown;
}) {
  const resultExists =
    LOCKED_RESULT_STATUSES.has(match.status) ||
    match.player1Score !== null ||
    match.player2Score !== null ||
    match.winnerId !== null;
  if (!resultExists) return true;

  const changesTeamIdentity = "participant1EntryId" in requested || "participant2EntryId" in requested;
  const requestedPlayerIds = [
    ...(Object.prototype.hasOwnProperty.call(requested, "player1Id") ? [requested.player1Id] : []),
    ...(Object.prototype.hasOwnProperty.call(requested, "player2Id") ? [requested.player2Id] : []),
  ];
  const changesExactlyOneAssignedPlayer = requestedPlayerIds.length === 1 &&
    typeof requestedPlayerIds[0] === "string" && requestedPlayerIds[0].length > 0;
  return Boolean(
    match.isCaptainAssignedTeamMatch &&
      !match.isTeamCaptainTiebreak &&
      changesExactlyOneAssignedPlayer &&
      !changesTeamIdentity,
  );
}
