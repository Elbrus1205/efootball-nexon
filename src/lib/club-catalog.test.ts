import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";
import { TOP_FIVE_LEAGUES } from "./club-catalog";

test("top-five leagues use the uploaded league emblem assets", () => {
  assert.deepEqual(
    TOP_FIVE_LEAGUES.map((league) => league.badgePath),
    [
      "/emblem-league/apl-league.png",
      "/emblem-league/la-liga.png",
      "/emblem-league/league1-mc.png",
      "/emblem-league/bundesliga.png",
      "/emblem-league/serie-a.png",
    ],
  );

  for (const league of TOP_FIVE_LEAGUES) {
    assert.equal(existsSync(new URL(`../../public${league.badgePath}`, import.meta.url)), true, `missing ${league.badgePath}`);
  }
});
