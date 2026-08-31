import { notFound } from "next/navigation";
import { getAdminTournamentAccessWhere } from "@/lib/admin-tournament-access";
import { requirePermission } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { TournamentBuilderForm } from "@/components/admin/tournament-builder-form";
import { Card, CardDescription } from "@/components/ui/card";
import { formatMoscowDateTimeLocalInput } from "@/lib/utils";

export default async function AdminTournamentEditPage(props: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ error?: string }>;
}) {
  const params = await props.params;
  const searchParams = await props.searchParams;
  const session = await requirePermission("tournaments.createEdit");

  const tournament = await db.tournament.findFirst({
    where: { id: params.id, ...getAdminTournamentAccessWhere(session) },
    include: { selectedLeagues: { select: { league: { select: { slug: true } } } } },
  });

  if (!tournament) notFound();

  return (
    <div className="space-y-6">
      {searchParams?.error ? (
        <Card className="border-red-400/25 bg-red-500/10" role="alert" aria-live="polite">
          <CardDescription className="break-words text-red-100">{searchParams.error}</CardDescription>
        </Card>
      ) : null}
      <TournamentBuilderForm
        action={`/api/admin/tournaments/${tournament.id}/update`}
        submitLabel="Сохранить изменения"
        initialValues={{
          title: tournament.title,
          rules: tournament.rules,
          startsAt: formatMoscowDateTimeLocalInput(tournament.startsAt),
          endsAt: formatMoscowDateTimeLocalInput(tournament.endsAt),
          registrationEndsAt: formatMoscowDateTimeLocalInput(tournament.registrationEndsAt),
          maxParticipants: tournament.maxParticipants,
          participantMode: tournament.participantMode,
          rosterSize: tournament.rosterSize,
          topRankingRestrictionEnabled: tournament.topRankingRestrictionEnabled,
          topRankingLimit: tournament.topRankingLimit,
          topRankingPlayerLimit: tournament.topRankingPlayerLimit,
          captainsCreateTeamMatches: tournament.captainsCreateTeamMatches,
          matchupFormat: tournament.matchupFormat,
          bestOfWins: tournament.bestOfWins,
          isTest: tournament.isTest,
          prizePool: tournament.prizePool ?? "",
          format: tournament.format,
          status: tournament.status,
          coverImage: tournament.coverImage ?? "",
          lineupPhotoExampleUrl: tournament.lineupPhotoExampleUrl ?? "",
          playoffType: tournament.playoffType ?? "",
          playoffLegs: tournament.playoffLegs,
          playoffThirdPlace: tournament.playoffThirdPlace,
          formatBlueprint: tournament.formatBlueprintJson as never,
          seedingMethod: tournament.seedingMethod,
          roundsInLeague: tournament.roundsInLeague,
          groupsCount: tournament.groupsCount,
          participantsPerGroup: tournament.participantsPerGroup,
          playoffTeamsPerGroup: tournament.playoffTeamsPerGroup,
          pointsForWin: tournament.pointsForWin,
          pointsForDraw: tournament.pointsForDraw,
          pointsForLoss: tournament.pointsForLoss,
          autoCreateMatches: tournament.autoCreateMatches,
          autoCreateSchedule: tournament.autoCreateSchedule,
          autoOpenRegistration: tournament.autoOpenRegistration,
          autoAdvanceFromGroups: tournament.autoAdvanceFromGroups,
          manualBracketControl: tournament.manualBracketControl,
          manualPlayoffSelection: tournament.manualPlayoffSelection,
          checkInRequired: tournament.checkInRequired,
          requireLineupPhoto: tournament.requireLineupPhoto,
          telegramCommunityId: tournament.telegramCommunityId ?? "",
          telegramChannelId: tournament.telegramChannelId ?? "",
          telegramGroupId: tournament.telegramGroupId ?? "",
          telegramAutoPublish: tournament.telegramAutoPublish,
          clubSelectionMode: tournament.clubSelectionMode,
          clubSelectionByLeague: tournament.clubSelectionByLeague,
          participantDistributionByLeague: tournament.participantDistributionByLeague,
          clubSelectionInGameOnly: tournament.clubSelectionInGameOnly,
          selectedLeagueSlugs: tournament.selectedLeagues.map((item) => item.league.slug),
          sortRules: tournament.sortRules,
        }}
      />
    </div>
  );
}
