import assert from "node:assert/strict";
import test from "node:test";
import { TournamentParticipantMode } from "@prisma/client";
import { resolveMatchPenaltyTargetUserIds } from "@/lib/services/reliability-penalty-targets";

const baseMatch = {
  player1Id: "player-1",
  player2Id: "player-2",
  lineupPlayers: [],
  participant1Entry: null,
  participant2Entry: null,
};

test("a penalty can target both players in a single-player match", () => {
  assert.deepEqual(
    resolveMatchPenaltyTargetUserIds(
      { ...baseMatch, participantMode: TournamentParticipantMode.SINGLE },
      ["player-1", "player-2"],
    ),
    ["player-1", "player-2"],
  );
});

test("targeting both sides expands to both historical coop lineups without duplicates", () => {
  assert.deepEqual(
    resolveMatchPenaltyTargetUserIds(
      {
        ...baseMatch,
        participantMode: TournamentParticipantMode.COOP,
        lineupPlayers: [
          { userId: "player-1", side: 1 },
          { userId: "teammate-1", side: 1 },
          { userId: "player-2", side: 2 },
          { userId: "teammate-2", side: 2 },
        ],
      },
      ["player-1", "player-2", "player-1"],
    ),
    ["player-1", "teammate-1", "player-2", "teammate-2"],
  );
});
