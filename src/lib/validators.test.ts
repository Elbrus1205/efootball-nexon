import assert from "node:assert/strict";
import test from "node:test";
import { SeedingMethod, TournamentFormat, TournamentParticipantMode } from "@prisma/client";
import { tournamentBuilderSchema } from "./validators";

test("random single tournaments do not require a top-ranking player limit", () => {
  const result = tournamentBuilderSchema.safeParse({
    title: "Random tournament",
    rules: "Минимальные правила турнира для проверки схемы.",
    startsAt: "2026-09-01T12:00",
    maxParticipants: 16,
    participantMode: TournamentParticipantMode.SINGLE,
    rosterSize: 1,
    format: TournamentFormat.SINGLE_ELIMINATION,
    seedingMethod: SeedingMethod.RANDOM,
    topRankingPlayerLimit: null,
  });

  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.topRankingPlayerLimit, 1);
  }
});
