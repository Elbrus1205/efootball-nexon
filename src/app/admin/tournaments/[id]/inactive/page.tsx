import { ParticipantStatus } from "@prisma/client";
import { notFound } from "next/navigation";
import { UserRoundX } from "lucide-react";
import { InactiveParticipantManager } from "@/components/admin/inactive-participant-manager";
import { getAdminTournamentAccessWhere } from "@/lib/admin-tournament-access";
import { requirePermission } from "@/lib/auth/session";
import { db } from "@/lib/db";

export default async function AdminTournamentInactiveParticipantsPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await requirePermission("tournaments.manageParticipants");
  const tournament = await db.tournament.findFirst({
    where: { id: params.id, ...getAdminTournamentAccessWhere(session) },
    select: {
      id: true,
      title: true,
      status: true,
      stages: {
        where: { type: "GROUP_STAGE" },
        select: { groups: { select: { id: true } } },
      },
      participants: {
        where: { status: { not: ParticipantStatus.REMOVED } },
        select: {
          id: true,
          status: true,
          isActive: true,
          inactiveFromRound: true,
          inactiveSince: true,
          seed: true,
          clubSlug: true,
          clubName: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              publicId: true,
              telegramUsername: true,
            },
          },
          group: { select: { name: true } },
        },
        orderBy: [{ seed: "asc" }, { createdAt: "asc" }],
      },
    },
  });

  if (!tournament) notFound();

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3">
        <div className="mt-1 rounded-lg border border-amber-200/20 bg-amber-200/[0.08] p-2.5 text-amber-100">
          <UserRoundX className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-200/75">Управление участниками</p>
          <h1 className="mt-1 break-words font-display text-2xl font-thin text-white sm:text-3xl">Неактивные игроки</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">
            Турнир «{tournament.title}». Неактивный игрок остается в заявке, но не может отправлять результаты. Тур определяется автоматически по дедлайну: при запасе от 12 часов — текущий, иначе следующий. Матчи с этого тура не влияют на таблицы, рейтинг и статистику.
          </p>
        </div>
      </div>
      <InactiveParticipantManager
        tournamentId={tournament.id}
        tournamentTitle={tournament.title}
        participants={tournament.participants}
      />
    </div>
  );
}
