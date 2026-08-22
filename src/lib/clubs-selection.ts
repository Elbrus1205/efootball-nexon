import type { ClubOption } from "@/lib/clubs";

export type TournamentClubSelectionSettings = {
  byLeague: boolean;
  inGameOnly: boolean;
  selectedLeagueSlugs: readonly string[];
};

export function filterClubsForTournament(
  clubs: readonly ClubOption[],
  settings: TournamentClubSelectionSettings,
) {
  const selectedLeagues = new Set(settings.selectedLeagueSlugs);
  return clubs.filter((club) => {
    if (club.isRegistrationEnabled === false) return false;
    if (settings.inGameOnly && club.isInGameEnabled === false) return false;
    if (settings.byLeague && (selectedLeagues.size === 0 || !selectedLeagues.has(club.leagueSlug ?? ""))) return false;
    return true;
  });
}
