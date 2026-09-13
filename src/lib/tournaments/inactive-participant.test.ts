import assert from "node:assert/strict";
import test from "node:test";
import {
  isUserInactiveForMatch,
  shouldExcludeMatchFromStatistics,
  type InactiveParticipantState,
} from "@/lib/tournaments/inactive-participant";
import { resolveEffectiveParticipantRound } from "@/lib/tournaments/effective-participant-round";

const active: InactiveParticipantState = { isActive: true, inactiveFromRound: null };
const inactiveFromRound12: InactiveParticipantState = { isActive: false, inactiveFromRound: 12 };

test("excludes matches from the participant's inactive round for both sides", () => {
  assert.equal(shouldExcludeMatchFromStatistics(11, inactiveFromRound12, active), false);
  assert.equal(shouldExcludeMatchFromStatistics(12, inactiveFromRound12, active), true);
  assert.equal(shouldExcludeMatchFromStatistics(17, active, inactiveFromRound12), true);
  assert.equal(shouldExcludeMatchFromStatistics(1, active, active, true), true);
});

test("detects inactive direct players and accepted cooperative members", () => {
  const sideOne = {
    playerId: "inactive-player",
    entry: { ...inactiveFromRound12, rosterMembers: [] },
  };
  const sideTwo = {
    playerId: "captain",
    entry: {
      ...active,
      rosterMembers: [
        { userId: "inactive-member", status: "ACCEPTED" },
        { userId: "pending-member", status: "PENDING" },
      ],
    },
  };

  assert.equal(isUserInactiveForMatch("inactive-player", 12, sideOne, sideTwo), true);
  assert.equal(isUserInactiveForMatch("inactive-member", 12, { ...sideOne, playerId: "other" }, sideTwo), false);
  assert.equal(
    isUserInactiveForMatch("inactive-member", 12, sideOne, {
      ...sideTwo,
      entry: { ...sideTwo.entry, ...inactiveFromRound12 },
    }),
    true,
  );
  assert.equal(isUserInactiveForMatch("pending-member", 12, sideOne, sideTwo), false);
});

test("starts participant changes in the current round only with twelve hours left", () => {
  const now = new Date("2026-09-13T00:00:00.000Z");
  assert.equal(resolveEffectiveParticipantRound(18, new Date("2026-09-13T12:00:00.000Z"), now), 18);
  assert.equal(resolveEffectiveParticipantRound(18, new Date("2026-09-13T11:59:59.999Z"), now), 19);
});
