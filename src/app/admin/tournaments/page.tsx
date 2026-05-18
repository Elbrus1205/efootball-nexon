import Link from "next/link";
import { ParticipantStatus, TournamentStatus } from "@prisma/client";
import { Eye, Layers3, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  playoffTypeLabel,
  tournamentStatusLabel,
  tournamentStatusVariant,
} from "@/lib/admin-display";
import { requireAnyPermission } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { syncTournamentLifecycleStatus } from "@/lib/services/tournaments";
import { formatDate } from "@/lib/utils";

export default async function AdminTournamentsPage({
  searchParams,
}: {
  searchParams?: { created?: string; warning?: string };
}) {
  await requireAnyPermission(["tournaments.createEdit", "tournaments.manageParticipants", "tournaments.manageStructure", "ownTournaments.moderateMatches", "allTournaments.moderateMatches"]);

  const syncCandidates = await db.tournament.findMany({
    where: { status: { in: [TournamentStatus.DRAFT, TournamentStatus.REGISTRATION_OPEN] } },
    select: { id: true },
  });
  await Promise.all(syncCandidates.map((tournament) => syncTournamentLifecycleStatus(tournament.id).catch(() => null)));

  const tournaments = await db.tournament.findMany({
    include: {
      _count: { select: { participants: { where: { status: { not: ParticipantStatus.REMOVED } } }, stages: true, matches: true } },
      season: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      {searchParams?.created ? (
        <Card className="border-emerald-400/20 bg-emerald-500/10">
          <CardDescription className="p-5 text-sm text-emerald-100">
            Турнир успешно создан.
            {searchParams.warning ? ` ${searchParams.warning}` : ""}
          </CardDescription>
        </Card>
      ) : null}

      {!searchParams?.created && searchParams?.warning ? (
        <Card className="border-amber-400/20 bg-amber-500/10">
          <CardDescription className="p-5 text-sm text-amber-100">{searchParams.warning}</CardDescription>
        </Card>
      ) : null}

      <Card>
        <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <CardTitle>Турниры и форматы</CardTitle>
            <CardDescription>
              Единый список турниров, стадий и операционных действий: регистрация, клубы, группы, плей-офф и запуск турнира.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button asChild variant="secondary">
              <Link href="/admin/tournaments/builder">
                <Layers3 className="mr-2 h-4 w-4" />
                Конструктор турнира
              </Link>
            </Button>
            <Button asChild>
              <Link href="/admin/tournaments/builder">
                <Plus className="mr-2 h-4 w-4" />
                Создать турнир
              </Link>
            </Button>
          </div>
        </CardHeader>
      </Card>

      <div className="grid gap-4">
        {tournaments.map((tournament) => {
          const canCloseRegistration = tournament.status === TournamentStatus.REGISTRATION_OPEN;
          const canStartTournament = tournament.status === TournamentStatus.REGISTRATION_CLOSED || tournament.status === TournamentStatus.AWAITING_START;
          const canAssignClubs = tournament.status === TournamentStatus.REGISTRATION_CLOSED || tournament.status === TournamentStatus.AWAITING_START;
          const canRegenerateMatches =
            tournament.status === TournamentStatus.IN_PROGRESS || tournament.status === TournamentStatus.COMPLETED;
          const canResetMatches =
            tournament._count.matches > 0 && tournament.status !== TournamentStatus.COMPLETED;

          return (
            <Card key={tournament.id} className="p-5">
              <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="font-medium text-white">{tournament.title}</div>
                    <Badge variant={tournamentStatusVariant[tournament.status]}>{tournamentStatusLabel[tournament.status]}</Badge>
                    {tournament.playoffType ? (
                      <Badge variant="accent">{playoffTypeLabel[tournament.playoffType] ?? tournament.playoffType}</Badge>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap gap-4 text-sm text-zinc-500">
                    <span>Старт: {formatDate(tournament.startsAt)}</span>
                    <span>
                      Участники: {tournament._count.participants}/{tournament.maxParticipants}
                    </span>
                    <span>Стадии: {tournament._count.stages}</span>
                    <span>Матчи: {tournament._count.matches}</span>
                    <span>Сезон: {tournament.season?.name ?? "Без сезона"}</span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button asChild variant="secondary">
                    <Link href={`/admin/tournaments/${tournament.id}`}>
                      <Eye className="mr-2 h-4 w-4" />
                      Workspace
                    </Link>
                  </Button>

                  {canCloseRegistration ? (
                    <form action={`/api/admin/tournaments/${tournament.id}`} method="post">
                      <input type="hidden" name="_method" value="close" />
                      <Button variant="outline">Закрыть регистрацию</Button>
                    </form>
                  ) : null}

                  {canAssignClubs ? (
                    <form action={`/api/admin/tournaments/${tournament.id}`} method="post">
                      <input type="hidden" name="_method" value="assign-random-clubs" />
                      <Button variant="outline">Распределить клубы</Button>
                    </form>
                  ) : null}

                  {canStartTournament ? (
                    <form action={`/api/admin/tournaments/${tournament.id}`} method="post">
                      <input type="hidden" name="_method" value="start" />
                      <Button>Начать турнир</Button>
                    </form>
                  ) : null}

                  {canRegenerateMatches ? (
                    <form action={`/api/admin/tournaments/${tournament.id}`} method="post">
                      <input type="hidden" name="_method" value="generate-matches" />
                      <Button variant="outline">Пересоздать матчи и расписание</Button>
                    </form>
                  ) : null}

                  {canResetMatches ? (
                    <form action={`/api/admin/tournaments/${tournament.id}`} method="post">
                      <input type="hidden" name="_method" value="reset-matches" />
                      <Button variant="outline">Сбросить и пересоздать матчи</Button>
                    </form>
                  ) : null}

                  <Button asChild variant="outline">
                    <Link href={`/tournaments/${tournament.id}`}>Публичная страница</Link>
                  </Button>

                  <Button asChild variant="outline">
                    <Link href={`/admin/tournaments/${tournament.id}/edit`}>Редактировать</Link>
                  </Button>
                  <Button asChild variant="outline">
                    <Link href={`/admin/tournaments/${tournament.id}/participants`}>Участники</Link>
                  </Button>
                  <Button asChild variant="outline">
                    <Link href={`/admin/tournaments/${tournament.id}/stages`}>Стадии</Link>
                  </Button>
                  <Button asChild variant="outline">
                    <Link href={`/admin/tournaments/${tournament.id}/standings`}>Таблицы</Link>
                  </Button>
                  <Button asChild variant="outline">
                    <Link href={`/admin/tournaments/${tournament.id}/bracket`}>Сетка</Link>
                  </Button>

                  <form action={`/api/admin/tournaments/${tournament.id}`} method="post" className="flex flex-col gap-2 rounded-2xl border border-red-400/10 bg-red-500/[0.03] p-2">
                    <input type="hidden" name="_method" value="delete" />
                    <label className="flex max-w-[220px] items-start gap-2 px-1 text-xs leading-4 text-zinc-400">
                      <input
                        type="checkbox"
                        name="preserveHomeStats"
                        className="mt-0.5 h-4 w-4 rounded border-white/15 bg-black/40 text-primary accent-primary"
                      />
                      <span>Сохранить турнир и призовой фонд в статистике главной</span>
                    </label>
                    <Button
                      variant="outline"
                      className="border-red-400/20 bg-red-500/10 text-red-200 hover:bg-red-500/20 hover:text-red-100"
                    >
                      Удалить турнир
                    </Button>
                  </form>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {!tournaments.length ? (
        <Card className="p-6 text-sm text-zinc-500">
          Первый турнир можно собрать через конструктор: формат, клубы, стадии, участники и запуск турнира.
        </Card>
      ) : null}
    </div>
  );
}
