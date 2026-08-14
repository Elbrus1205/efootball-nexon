export type CaptainTeamPlayerCorrectionMatch = {
  id: string;
  player1Id: string | null;
  player2Id: string | null;
};

export type CaptainTeamPlayerCorrection = {
  matchId: string;
  previousPlayerId: string | null;
  nextPlayerId: string;
};

export function planCaptainTeamPlayerCorrection(params: {
  target: CaptainTeamPlayerCorrectionMatch;
  siblings: CaptainTeamPlayerCorrectionMatch[];
  side: 1 | 2;
  nextPlayerId: string;
}) {
  const sideField = params.side === 1 ? "player1Id" : "player2Id";
  const previousPlayerId = params.target[sideField];
  if (previousPlayerId === params.nextPlayerId) return [];

  const occupiedMatch = params.siblings.find((match) => match[sideField] === params.nextPlayerId);
  const corrections: CaptainTeamPlayerCorrection[] = [
    {
      matchId: params.target.id,
      previousPlayerId,
      nextPlayerId: params.nextPlayerId,
    },
  ];

  if (occupiedMatch) {
    if (!previousPlayerId) {
      throw new Error("CAPTAIN_TEAM_PLAYER_ALREADY_ASSIGNED");
    }

    corrections.push({
      matchId: occupiedMatch.id,
      previousPlayerId: params.nextPlayerId,
      nextPlayerId: previousPlayerId,
    });
  }

  return corrections;
}
