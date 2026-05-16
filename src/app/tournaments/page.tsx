import { TournamentStatus } from "@prisma/client";
import { DivisionPreviewCard } from "@/components/divisions/division-preview-card";
import { TournamentCard } from "@/components/tournaments/tournament-card";
import { getCurrentSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { isDivisionAdminRole } from "@/lib/services/divisions";
import { syncTournamentLifecycleStatus } from "@/lib/services/tournaments";

export const dynamic = "force-dynamic";

export default async function TournamentsPage() {
  const session = await getCurrentSession();
  const syncCandidates = await db.tournament.findMany({
    where: { status: { in: [TournamentStatus.DRAFT, TournamentStatus.REGISTRATION_OPEN] } },
    select: { id: true },
  });
  await Promise.all(syncCandidates.map((tournament) => syncTournamentLifecycleStatus(tournament.id).catch(() => null)));

  const tournaments = await db.tournament.findMany({
    include: {
      _count: { select: { participants: true } },
    },
    orderBy: [{ status: "asc" }, { startsAt: "asc" }],
  });

  return (
    <div className="page-shell space-y-8">
      <div className="text-sm font-semibold uppercase tracking-[0.24em] text-primary">Турниры</div>

      <DivisionPreviewCard canOpen={isDivisionAdminRole(session?.user?.role)} />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {tournaments.map((tournament) => (
          <TournamentCard key={tournament.id} tournament={tournament} participantsCount={tournament._count.participants} />
        ))}
      </div>
    </div>
  );
}
