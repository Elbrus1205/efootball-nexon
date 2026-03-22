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
  const filters = [
    { value: "REGISTRATION_OPEN", label: "Открыта регистрация" },
    { value: "IN_PROGRESS", label: "Идут сейчас" },
    { value: "COMPLETED", label: "Завершённые" },
  ];

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
        eyebrow="Турниры"
        title="Все турниры"
        description="В этом разделе собраны актуальные турниры, стадии сезона и быстрый переход к карточке каждого события."
      />
      <div className="flex flex-wrap gap-3 text-sm text-zinc-400">
        {filters.map((item) => (
          <a key={item.value} href={`/tournaments?status=${item.value}`} className="rounded-full border border-white/10 px-4 py-2 hover:border-primary/40 hover:text-white">
            {item.label}
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
