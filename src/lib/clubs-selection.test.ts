import assert from "node:assert/strict";
import test from "node:test";
import { filterClubsForTournament } from "./clubs-selection";

const clubs = [
  { slug: "arsenal", name: "Arsenal", imagePath: "/arsenal.png", leagueSlug: "premier-league", isRegistrationEnabled: true, isInGameEnabled: true },
  { slug: "psg", name: "PSG", imagePath: "/psg.png", leagueSlug: "ligue-1", isRegistrationEnabled: true, isInGameEnabled: false },
  { slug: "hidden", name: "Hidden", imagePath: "/hidden.png", leagueSlug: "premier-league", isRegistrationEnabled: false, isInGameEnabled: true },
];

test("filters disabled clubs and optionally limits selection to selected leagues", () => {
  assert.deepEqual(
    filterClubsForTournament(clubs, { byLeague: true, inGameOnly: true, selectedLeagueSlugs: ["premier-league"] }).map((club) => club.slug),
    ["arsenal"],
  );
  assert.deepEqual(
    filterClubsForTournament(clubs, { byLeague: false, inGameOnly: false, selectedLeagueSlugs: [] }).map((club) => club.slug),
    ["arsenal", "psg"],
  );
  assert.deepEqual(
    filterClubsForTournament(clubs, { byLeague: true, inGameOnly: true, selectedLeagueSlugs: [] }).map((club) => club.slug),
    [],
  );
});
