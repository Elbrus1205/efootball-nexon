import assert from "node:assert/strict";
import test from "node:test";
import { SeedingMethod } from "@prisma/client";
import { selectableTournamentSeedingMethods } from "./admin-display";

test("tournament creation offers only manual, random, and rating seeding", () => {
  assert.deepEqual(selectableTournamentSeedingMethods, [
    SeedingMethod.MANUAL,
    SeedingMethod.RANDOM,
    SeedingMethod.RANKING,
  ]);
});
