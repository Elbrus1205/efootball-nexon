import { ParticipantStatus, TournamentStatus } from "@prisma/client";
import { DivisionPreviewCard } from "@/components/divisions/division-preview-card";
import { TournamentCard } from "@/components/tournaments/tournament-card";
import { getCurrentSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { getDivisionPreviewSettings, isDivisionAdminRole } from "@/lib/services/divisions";
import { shouldSyncTournamentRegistrationLifecycle, syncTournamentLifecycleStatus } from "@/lib/services/tournaments";

export const dynamic = "force-dynamic";

function logTiming(label: string, start: number) {
  console.log(`${label}: ${(performance.now() - start).toFixed(3)}ms`);
}

function shouldSyncTournamentForList(tournament: {
  status: TournamentStatus;
  autoOpenRegistration: boolean;
  registrationStartsAt: Date | null;
  startsAt: Date;
}) {
  return shouldSyncTournamentRegistrationLifecycle(tournament);
}

export default async function TournamentsPage() {
  const pageStart = performance.now();
  const sessionStart = performance.now();
  const tournamentsStart = performance.now();
  const tournamentListStart = performance.now();
  const participantCountsStart = performance.now();
  const divisionSettingsStart = performance.now();
  const [session, initialTournamentList, participantCounts, divisionSettings] = await Promise.all([
    getCurrentSession().finally(() => logTiming("load-session", sessionStart)),
    db.tournament
      .findMany({
        select: {
          id: true,
          title: true,
          status: true,
          startsAt: true,
          maxParticipants: true,
          prizePool: true,
          coverImage: true,
          autoOpenRegistration: true,
          registrationStartsAt: true,
        },
        orderBy: [{ status: "asc" }, { startsAt: "asc" }],
      })
      .finally(() => logTiming("load-tournament-list", tournamentListStart)),
    db.tournamentRegistration
      .groupBy({
        by: ["tournamentId"],
        where: { status: { not: ParticipantStatus.REMOVED } },
        _count: { _all: true },
      })
      .finally(() => logTiming("load-participant-counts", participantCountsStart)),
    getDivisionPreviewSettings().finally(() => logTiming("load-division-settings", divisionSettingsStart)),
  ]);

  const syncStart = performance.now();
  const syncCandidates = initialTournamentList.filter(shouldSyncTournamentForList);
  await Promise.all(
    syncCandidates.map((tournament) => syncTournamentLifecycleStatus(tournament.id).catch(() => null)),
  );
  logTiming("sync-tournaments", syncStart);

  const tournamentList = syncCandidates.length
    ? await db.tournament.findMany({
        select: {
          id: true,
          title: true,
          status: true,
          startsAt: true,
          maxParticipants: true,
          prizePool: true,
          coverImage: true,
        },
        orderBy: [{ status: "asc" }, { startsAt: "asc" }],
      })
    : initialTournamentList;
  const participantCountByTournamentId = new Map(participantCounts.map((item) => [item.tournamentId, item._count._all]));
  const tournaments = tournamentList.map((tournament) => ({
    ...tournament,
    _count: { participants: participantCountByTournamentId.get(tournament.id) ?? 0 },
  }));
  logTiming("load-tournaments", tournamentsStart);
  logTiming("tournaments-page", pageStart);

  return (
    <div className="page-shell space-y-8">
      <div className="text-sm font-semibold uppercase tracking-[0.24em] text-primary">Турниры</div>

      <DivisionPreviewCard canOpen={isDivisionAdminRole(session?.user?.role)} coverImage={divisionSettings.coverImage} />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {tournaments.map((tournament) => (
          <TournamentCard key={tournament.id} tournament={tournament} participantsCount={tournament._count.participants} />
        ))}
      </div>
    </div>
  );
}
