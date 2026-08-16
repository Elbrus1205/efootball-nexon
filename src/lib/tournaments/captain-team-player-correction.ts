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

export type CaptainTeamPlayerChangeSide = 1 | 2 | "MULTIPLE" | null;

export function resolveCaptainTeamPlayerChangeSide(params: {
  currentPlayer1Id: string | null;
  currentPlayer2Id: string | null;
  nextPlayer1Id: string | null;
  nextPlayer2Id: string | null;
  player1Provided: boolean;
  player2Provided: boolean;
}): CaptainTeamPlayerChangeSide {
  const changedSides: Array<1 | 2> = [];

  if (params.player1Provided && params.currentPlayer1Id !== params.nextPlayer1Id) changedSides.push(1);
  if (params.player2Provided && params.currentPlayer2Id !== params.nextPlayer2Id) changedSides.push(2);

  if (changedSides.length > 1) return "MULTIPLE";
  return changedSides[0] ?? null;
}

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
