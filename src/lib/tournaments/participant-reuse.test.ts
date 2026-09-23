import assert from "node:assert/strict";
import test from "node:test";
import { canReuseActiveParticipant } from "./participant-reuse";

test("a replaced solo participant can be selected again without reusing a team roster", () => {
  assert.equal(
    canReuseActiveParticipant({
      registrationId: "hamburg",
      userId: "dzidah",
      participantMode: "SINGLE",
      rosterMemberUserIds: ["dzidah"],
    }, "southampton"),
    true,
  );
  assert.equal(
    canReuseActiveParticipant({
      registrationId: "team",
      userId: "captain",
      participantMode: "TEAM",
      rosterMemberUserIds: ["captain", "teammate"],
    }, "southampton"),
    false,
  );
  assert.equal(
    canReuseActiveParticipant({
      registrationId: "southampton",
      userId: "dzidah",
      participantMode: "SINGLE",
      rosterMemberUserIds: ["dzidah"],
    }, "southampton"),
    false,
  );
});
