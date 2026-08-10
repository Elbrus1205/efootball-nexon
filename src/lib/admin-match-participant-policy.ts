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
}) {
  return !(
    LOCKED_RESULT_STATUSES.has(match.status) ||
    match.player1Score !== null ||
    match.player2Score !== null ||
    match.winnerId !== null
  );
}
