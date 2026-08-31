import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getBundledClubLeagueSlug } from "@/lib/clubs";

describe("managed club league mapping", () => {
  it("assigns Lyon to Ligue 1", () => {
    assert.equal(getBundledClubLeagueSlug("lyon-big-2022"), "ligue-1");
  });

  it("keeps Valencia in La Liga for the canonical badge slug", () => {
    assert.equal(getBundledClubLeagueSlug("valencia"), "la-liga");
  });
});
