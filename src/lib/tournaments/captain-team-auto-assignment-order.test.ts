import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const serviceSource = readFileSync("src/lib/services/tournaments.ts", "utf8");

test("the public schedule cache is invalidated before automatic-assignment notifications are sent", () => {
  const assignmentStart = serviceSource.indexOf("export async function autoAssignExpiredCaptainTeamMatchSlots");
  const assignmentEnd = serviceSource.indexOf("export async function notifyUpcomingRoundDeadlineReminders", assignmentStart);
  const assignmentSource = serviceSource.slice(assignmentStart, assignmentEnd);
  const invalidationIndex = assignmentSource.indexOf("invalidateTournamentSchedule(tournament.id)");
  const notificationIndex = assignmentSource.indexOf("await Promise.all(result.matchIds.map((matchId) => notifyMatchReady(matchId)))");

  assert.notEqual(invalidationIndex, -1);
  assert.notEqual(notificationIndex, -1);
  assert.ok(invalidationIndex < notificationIndex);
});
