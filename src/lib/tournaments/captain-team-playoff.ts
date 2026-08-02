type CaptainTeamPlayoffMatch = {
  id: string;
  isCaptainAssignedTeamMatch: boolean;
  isTeamCaptainTiebreak: boolean;
  isPenaltyTiebreak: boolean;
  status: string;
  participant1EntryId: string | null;
  participant2EntryId: string | null;
  player1Score: number | null;
  player2Score: number | null;
};

type CaptainTeamPlayoffPending = {
  state: "pending";
};

type CaptainTeamPlayoffTied = {
  state: "tied";
  participant1EntryId: string;
  participant2EntryId: string;
  participant1Score: number;
  participant2Score: number;
  winnerEntryId: null;
  loserEntryId: null;
};

type CaptainTeamPlayoffWinner = {
  state: "winner";
  participant1EntryId: string;
  participant2EntryId: string;
  participant1Score: number;
  participant2Score: number;
  winnerEntryId: string;
  loserEntryId: string;
};

export type CaptainTeamPlayoffResolution =
  | CaptainTeamPlayoffPending
  | CaptainTeamPlayoffTied
  | CaptainTeamPlayoffWinner;

const COMPLETED_STATUSES = new Set(["CONFIRMED", "FINISHED", "FORFEIT"]);

export function resolveCaptainTeamPlayoffAggregate(
  matches: readonly CaptainTeamPlayoffMatch[],
): CaptainTeamPlayoffResolution {
  const baseMatches = matches.filter(
    (match) => match.isCaptainAssignedTeamMatch && !match.isTeamCaptainTiebreak && !match.isPenaltyTiebreak,
  );
  const referenceMatch = baseMatches.find(
    (match) => match.participant1EntryId && match.participant2EntryId,
  );

  if (!referenceMatch?.participant1EntryId || !referenceMatch.participant2EntryId || !baseMatches.length) {
    return { state: "pending" };
  }

  if (
    !baseMatches.every(
      (match) =>
        COMPLETED_STATUSES.has(match.status) &&
        match.player1Score !== null &&
        match.player2Score !== null,
    )
  ) {
    return { state: "pending" };
  }

  let participant1Score = 0;
  let participant2Score = 0;

  for (const match of baseMatches) {
    const sameOrder =
      match.participant1EntryId === referenceMatch.participant1EntryId &&
      match.participant2EntryId === referenceMatch.participant2EntryId;
    const reversedOrder =
      match.participant1EntryId === referenceMatch.participant2EntryId &&
      match.participant2EntryId === referenceMatch.participant1EntryId;

    if (!sameOrder && !reversedOrder) {
      return { state: "pending" };
    }

    participant1Score += sameOrder ? match.player1Score! : match.player2Score!;
    participant2Score += sameOrder ? match.player2Score! : match.player1Score!;
  }

  if (participant1Score === participant2Score) {
    return {
      state: "tied",
      participant1EntryId: referenceMatch.participant1EntryId,
      participant2EntryId: referenceMatch.participant2EntryId,
      participant1Score,
      participant2Score,
      winnerEntryId: null,
      loserEntryId: null,
    };
  }

  const participant1Won = participant1Score > participant2Score;
  return {
    state: "winner",
    participant1EntryId: referenceMatch.participant1EntryId,
    participant2EntryId: referenceMatch.participant2EntryId,
    participant1Score,
    participant2Score,
    winnerEntryId: participant1Won ? referenceMatch.participant1EntryId : referenceMatch.participant2EntryId,
    loserEntryId: participant1Won ? referenceMatch.participant2EntryId : referenceMatch.participant1EntryId,
  };
}
