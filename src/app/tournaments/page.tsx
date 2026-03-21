import { TournamentStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { TournamentCard } from "@/components/tournaments/tournament-card";
import { SectionHeader } from "@/components/shared/section-header";

export const revalidate = 3600;

export default async function TournamentsPage({
  searchParams,
}: {
  searchParams: { status?: string };
}) {
  const status = searchParams.status as TournamentStatus | undefined;

  const tournaments = await db.tournament.findMany({
    where: status ? { status } : undefined,
    include: {
      _count: { select: { participants: true } },
    },
    orderBy: [{ status: "asc" }, { startsAt: "asc" }],
  });

  return (
    <div className="page-shell space-y-8">
      <SectionHeader
        eyebrow="Каталог"
        title="Все турниры"
        description="Фильтруйте соревнования по статусу и переходите к сетке, правилам и участникам."
      />
      <div className="flex flex-wrap gap-3 text-sm text-zinc-400">
        {["REGISTRATION_OPEN", "IN_PROGRESS", "COMPLETED"].map((item) => (
          <a key={item} href={`/tournaments?status=${item}`} className="rounded-full border border-white/10 px-4 py-2 hover:border-primary/40 hover:text-white">
            {item}
          </a>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {tournaments.map((tournament) => (
          <TournamentCard key={tournament.id} tournament={tournament} participantsCount={tournament._count.participants} />
        ))}
      </div>
    </div>
  );
}
