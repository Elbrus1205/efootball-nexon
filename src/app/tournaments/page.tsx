import { ParticipantStatus, TournamentStatus } from "@prisma/client";
import { getToken } from "next-auth/jwt";
import { headers } from "next/headers";
import { DivisionPreviewCard } from "@/components/divisions/division-preview-card";
import { TournamentCard } from "@/components/tournaments/tournament-card";
import { db } from "@/lib/db";
import { getDivisionPreviewSettings, isDivisionAdminRole } from "@/lib/services/divisions";
import { shouldSyncTournamentRegistrationLifecycle, syncTournamentLifecycleStatus } from "@/lib/services/tournaments";

export const dynamic = "force-dynamic";

function logTiming(label: string, start: number) {
  if (process.env.NODE_ENV === "production") return;
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

function canSeeTestTournaments(role?: string | null) {
  return role === "FOUNDER" || role === "ADMIN" || role === "ORGANIZER" || role === "JUDGE" || role === "TRAINEE";
}

async function getCurrentRoleFromToken() {
  const requestHeaders = headers();
  const token = await getToken({
    req: { headers: Object.fromEntries(requestHeaders.entries()), cookies: {} } as Parameters<typeof getToken>[0]["req"],
    secret: process.env.NEXTAUTH_SECRET,
  });

  return typeof token?.role === "string" ? token.role : null;
}

export default async function TournamentsPage() {
  const pageStart = performance.now();
  const roleStart = performance.now();
  const tournamentsStart = performance.now();
  const tournamentListStart = performance.now();
  const [currentRole, initialTournamentList] = await Promise.all([
    getCurrentRoleFromToken().finally(() => logTiming("load-role-token", roleStart)),
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
          isTest: true,
          autoOpenRegistration: true,
          registrationStartsAt: true,
          _count: {
            select: {
              participants: {
                where: { status: { not: ParticipantStatus.REMOVED } },
              },
            },
          },
        },
        orderBy: [{ status: "asc" }, { startsAt: "asc" }],
      })
      .finally(() => logTiming("load-tournament-list", tournamentListStart)),
  ]);

  const showTestTournaments = canSeeTestTournaments(currentRole);
  const visibleInitialTournamentList = showTestTournaments
    ? initialTournamentList
    : initialTournamentList.filter((tournament) => !tournament.isTest);
  const syncStart = performance.now();
  const syncCandidates = visibleInitialTournamentList.filter(shouldSyncTournamentForList);
  await Promise.all(
    syncCandidates.map((tournament) => syncTournamentLifecycleStatus(tournament.id).catch(() => null)),
  );
  logTiming("sync-tournaments", syncStart);

  const tournamentList = syncCandidates.length
    ? await db.tournament.findMany({
        where: showTestTournaments ? undefined : { isTest: false },
        select: {
          id: true,
          title: true,
          status: true,
          startsAt: true,
          maxParticipants: true,
          prizePool: true,
          coverImage: true,
          isTest: true,
          _count: {
            select: {
              participants: {
                where: { status: { not: ParticipantStatus.REMOVED } },
              },
            },
          },
        },
        orderBy: [{ status: "asc" }, { startsAt: "asc" }],
      })
    : visibleInitialTournamentList;
  const canOpenDivisions = isDivisionAdminRole(currentRole);
  const divisionSettingsStart = performance.now();
  const divisionSettings = canOpenDivisions
    ? await getDivisionPreviewSettings().finally(() => logTiming("load-division-settings", divisionSettingsStart))
    : { coverImage: null };
  logTiming("load-tournaments", tournamentsStart);
  logTiming("tournaments-page", pageStart);

  return (
    <div className="page-shell space-y-8">
      <div className="text-sm font-semibold uppercase tracking-[0.24em] text-primary">Турниры</div>

      <DivisionPreviewCard canOpen={canOpenDivisions} coverImage={divisionSettings.coverImage} />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {tournamentList.map((tournament) => (
          <TournamentCard key={tournament.id} tournament={tournament} participantsCount={tournament._count.participants} />
        ))}
      </div>
    </div>
  );
}
