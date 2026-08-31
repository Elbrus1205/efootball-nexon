import assert from "node:assert/strict";
import test from "node:test";

import { TournamentParticipantMode } from "@prisma/client";
import { selectTournamentBonusPlayerIds } from "./rating-bonus-matches";

test("team tournament bonus includes captain and every accepted roster member once", () => {
  assert.deepEqual(
    selectTournamentBonusPlayerIds({
      participantMode: TournamentParticipantMode.TEAM,
      captainId: "captain",
      rosterMemberIds: ["captain", "member-1", "member-2"],
      sidePlayerIds: ["member-1"],
    }),
    ["captain", "member-1", "member-2"],
  );
});

test("non-team tournament bonus keeps the resolved match side", () => {
  assert.deepEqual(
    selectTournamentBonusPlayerIds({
      participantMode: TournamentParticipantMode.SINGLE,
      captainId: "captain",
      rosterMemberIds: ["captain", "member-1"],
      sidePlayerIds: ["player-1", "player-2"],
    }),
    ["player-1", "player-2"],
  );
});

test("team tournament bonus prefers the historical lineup over a replaced current roster", () => {
  assert.deepEqual(
    selectTournamentBonusPlayerIds({
      participantMode: TournamentParticipantMode.TEAM,
      captainId: "captain",
      rosterMemberIds: ["captain", "replacement"],
      sidePlayerIds: ["replacement"],
      historicalPlayerIds: ["captain", "member-before-replacement"],
    }),
    ["captain", "member-before-replacement"],
  );
});
