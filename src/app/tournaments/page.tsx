import { db } from "@/lib/db";
import { TournamentCard } from "@/components/tournaments/tournament-card";

export const revalidate = 3600;

export default async function TournamentsPage() {
  const tournaments = await db.tournament.findMany({
    include: {
      _count: { select: { participants: true } },
    },
    orderBy: [{ status: "asc" }, { startsAt: "asc" }],
  });

  return (
    <div className="page-shell space-y-8">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {tournaments.map((tournament) => (
          <TournamentCard key={tournament.id} tournament={tournament} participantsCount={tournament._count.participants} />
        ))}
      </div>
    </div>
  );
}
