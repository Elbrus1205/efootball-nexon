import { Prisma, TournamentStatus } from "@prisma/client";
import { DivisionPreviewCard } from "@/components/divisions/division-preview-card";
import { TournamentCard } from "@/components/tournaments/tournament-card";
import { getCurrentSession } from "@/lib/auth/session";
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

type TournamentListRow = {
  id: string;
  title: string;
  status: TournamentStatus;
  startsAt: Date;
  maxParticipants: number;
  prizePool: string | null;
  hasCoverImage: boolean;
  updatedAt: Date;
  isTest: boolean;
  autoOpenRegistration: boolean;
  registrationStartsAt: Date | null;
  participantsCount: number;
};

function getTournamentCoverUrl(tournament: Pick<TournamentListRow, "id" | "hasCoverImage" | "updatedAt">) {
  return tournament.hasCoverImage ? `/api/tournaments/${tournament.id}/cover?v=${tournament.updatedAt.getTime()}` : null;
}

function loadTournamentList(showTestTournaments: boolean) {
  const whereClause = showTestTournaments ? Prisma.empty : Prisma.sql`WHERE t."isTest" = false`;

  return db.$queryRaw<TournamentListRow[]>(Prisma.sql`
    SELECT
      t.id,
      t.title,
      t.status::text AS status,
      t."startsAt",
      t."maxParticipants",
      t."prizePool",
      (t."coverImage" IS NOT NULL AND t."coverImage" <> '') AS "hasCoverImage",
      t."updatedAt",
      t."isTest",
      t."autoOpenRegistration",
      t."registrationStartsAt",
      (
        SELECT COUNT(*)::int
        FROM "TournamentRegistration" p
        WHERE p."tournamentId" = t.id AND p.status <> 'REMOVED'::"ParticipantStatus"
      ) AS "participantsCount"
    FROM "Tournament" t
    ${whereClause}
    ORDER BY t.status ASC, t."startsAt" ASC
  `);
}

export default async function TournamentsPage() {
  const pageStart = performance.now();
  const roleStart = performance.now();
  const session = await getCurrentSession().finally(() => logTiming("load-session-role", roleStart));

  const currentRole = session?.user.role ?? null;
  const showTestTournaments = canSeeTestTournaments(currentRole);

  const tournamentsStart = performance.now();
  const tournamentListStart = performance.now();
  const canOpenDivisions = isDivisionAdminRole(currentRole);
  const divisionSettingsStart = performance.now();
  const [initialTournamentList, divisionSettings] = await Promise.all([
    loadTournamentList(showTestTournaments).finally(() => logTiming("load-tournament-list", tournamentListStart)),
    canOpenDivisions
      ? getDivisionPreviewSettings().finally(() => logTiming("load-division-settings", divisionSettingsStart))
      : Promise.resolve({ coverImage: null }),
  ]);

  const syncStart = performance.now();
  const syncCandidates = initialTournamentList.filter(shouldSyncTournamentForList);
  await Promise.all(
    syncCandidates.map((tournament) => syncTournamentLifecycleStatus(tournament.id).catch(() => null)),
  );
  logTiming("sync-tournaments", syncStart);

  const tournamentList = syncCandidates.length
    ? await loadTournamentList(showTestTournaments)
    : initialTournamentList;
  logTiming("load-tournaments", tournamentsStart);
  logTiming("tournaments-page", pageStart);

  return (
    <div className="page-shell space-y-8">
      <div className="text-sm font-semibold uppercase tracking-[0.24em] text-primary">Турниры</div>

      <DivisionPreviewCard canOpen={canOpenDivisions} coverImage={canOpenDivisions ? divisionSettings.coverImage : null} />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {tournamentList.map((tournament, index) => (
          <TournamentCard
            key={tournament.id}
            tournament={{ ...tournament, coverImage: getTournamentCoverUrl(tournament) }}
            participantsCount={tournament.participantsCount}
            priorityImage={index === 0}
          />
        ))}
      </div>
    </div>
  );
}
