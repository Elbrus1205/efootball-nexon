type SubmittedScore = {
  player1Score: number;
  player2Score: number;
  player1PenaltyScore: number | null;
  player2PenaltyScore: number | null;
};

export type SubmittedScoreDecision =
  | { state: "confirmed" }
  | { state: "retry" | "disputed"; mismatchAttempts: number; attemptsLeft: number };

export function decideSubmittedScores(
  first: SubmittedScore,
  second: SubmittedScore,
  previousRejectedSubmissions: number,
): SubmittedScoreDecision {
  const scoresMatch =
    first.player1Score === second.player1Score &&
    first.player2Score === second.player2Score &&
    first.player1PenaltyScore === second.player1PenaltyScore &&
    first.player2PenaltyScore === second.player2PenaltyScore;

  if (scoresMatch) return { state: "confirmed" };

  const mismatchAttempts = Math.floor(previousRejectedSubmissions / 2) + 1;
  const attemptsLeft = Math.max(0, 3 - mismatchAttempts);
  return {
    state: mismatchAttempts >= 3 ? "disputed" : "retry",
    mismatchAttempts,
    attemptsLeft,
  };
}
