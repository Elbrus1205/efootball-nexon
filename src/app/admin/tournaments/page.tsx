import Link from "next/link";
import { ParticipantStatus, TournamentStatus } from "@prisma/client";
import {
  Eye,
  GitBranch,
  Globe2,
  Layers3,
  Pencil,
  Plus,
  RefreshCw,
  Shuffle,
  Table2,
  Trash2,
  Trophy,
  Users,
  XCircle,
} from "lucide-react";
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
import { shouldSyncTournamentRegistrationLifecycle, syncTournamentLifecycleStatus } from "@/lib/services/tournaments";
import { formatDate } from "@/lib/utils";

const actionButtonClass =
  "h-full min-h-11 w-full gap-1.5 whitespace-normal rounded-md px-2.5 py-2 text-center text-[12px] leading-snug sm:px-3 sm:text-sm [&_svg]:h-3.5 [&_svg]:w-3.5 [&_svg]:shrink-0 sm:[&_svg]:h-4 sm:[&_svg]:w-4";

const wideActionButtonClass = `${actionButtonClass} col-span-2 sm:col-span-1`;

const quickButtonClass =
  "h-full min-h-11 w-full gap-1.5 whitespace-normal rounded-md px-2.5 py-2 text-center text-[12px] leading-tight sm:min-h-10 sm:px-2.5 sm:text-sm [&_svg]:h-3.5 [&_svg]:w-3.5 [&_svg]:shrink-0 sm:[&_svg]:h-4 sm:[&_svg]:w-4";

export default async function AdminTournamentsPage({
  searchParams,
}: {
  searchParams?: { created?: string; warning?: string };
}) {
  await requireAnyPermission(["tournaments.createEdit", "tournaments.manageParticipants", "tournaments.manageStructure", "ownTournaments.moderateMatches", "allTournaments.moderateMatches"]);

  const syncCandidates = await db.tournament.findMany({
    where: { status: { in: [TournamentStatus.DRAFT, TournamentStatus.REGISTRATION_OPEN] } },
    select: {
      id: true,
      status: true,
      autoOpenRegistration: true,
      registrationStartsAt: true,
      startsAt: true,
    },
  });
  await Promise.all(
    syncCandidates
      .filter(shouldSyncTournamentRegistrationLifecycle)
      .map((tournament) => syncTournamentLifecycleStatus(tournament.id).catch(() => null)),
  );

  const tournaments = await db.tournament.findMany({
    select: {
      id: true,
      title: true,
      status: true,
      playoffType: true,
      startsAt: true,
      maxParticipants: true,
      _count: { select: { participants: { where: { status: { not: ParticipantStatus.REMOVED } } }, stages: true, matches: true } },
      season: { select: { name: true } },
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
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Button asChild variant="secondary" className="h-10 min-h-10 rounded-md px-3 text-sm">
              <Link href="/admin/tournaments/builder">
                <Layers3 className="mr-2 h-4 w-4" />
                Конструктор
              </Link>
            </Button>
            <Button asChild className="h-10 min-h-10 rounded-md px-3 text-sm">
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
          return (
            <Card key={tournament.id} className="overflow-hidden p-0">
              <div className="grid gap-4 p-4 sm:p-5 xl:grid-cols-[minmax(260px,0.85fr)_minmax(0,1.35fr)] xl:items-start">
                <div className="min-w-0 space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="min-w-0 break-words text-base font-semibold leading-tight text-white sm:text-lg">{tournament.title}</div>
                    <Badge variant={tournamentStatusVariant[tournament.status]}>{tournamentStatusLabel[tournament.status]}</Badge>
                    {tournament.playoffType ? (
                      <Badge variant="accent">{playoffTypeLabel[tournament.playoffType] ?? tournament.playoffType}</Badge>
                    ) : null}
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[12px] text-zinc-400 sm:flex sm:flex-wrap sm:gap-x-5 sm:gap-y-2 sm:text-sm">
                    <span>Старт: {formatDate(tournament.startsAt)}</span>
                    <span>
                      Участники: {tournament._count.participants}/{tournament.maxParticipants}
                    </span>
                    <span>Стадии: {tournament._count.stages}</span>
                    <span>Матчи: {tournament._count.matches}</span>
                    <span className="col-span-2">Сезон: {tournament.season?.name ?? "Без сезона"}</span>
                  </div>
                </div>

                <div className="grid min-w-0 gap-2.5 xl:max-w-[860px] xl:justify-self-end">
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 2xl:grid-cols-4">
                    <Button asChild variant="secondary" className={wideActionButtonClass}>
                      <Link href={`/admin/tournaments/${tournament.id}`}>
                        <Eye />
                        Workspace
                      </Link>
                    </Button>

                    {canCloseRegistration ? (
                      <form action={`/api/admin/tournaments/${tournament.id}`} method="post" className="col-span-2 grid min-w-0 sm:col-span-1">
                        <input type="hidden" name="_method" value="close" />
                        <Button variant="outline" className={actionButtonClass}>
                          <XCircle />
                          Закрыть регистрацию
                        </Button>
                      </form>
                    ) : null}

                    {canAssignClubs ? (
                      <form action={`/api/admin/tournaments/${tournament.id}`} method="post" className="col-span-2 grid min-w-0 sm:col-span-1">
                        <input type="hidden" name="_method" value="assign-random-clubs" />
                        <Button variant="outline" className={actionButtonClass}>
                          <Shuffle />
                          Распределить клубы
                        </Button>
                      </form>
                    ) : null}

                    {canStartTournament ? (
                      <form action={`/api/admin/tournaments/${tournament.id}`} method="post" className="col-span-2 grid min-w-0 sm:col-span-1">
                        <input type="hidden" name="_method" value="start" />
                        <Button className={actionButtonClass}>
                          <Trophy />
                          Начать турнир
                        </Button>
                      </form>
                    ) : null}

                    {canRegenerateMatches ? (
                      <form action={`/api/admin/tournaments/${tournament.id}`} method="post" className="col-span-2 grid min-w-0 sm:col-span-1">
                        <input type="hidden" name="_method" value="generate-matches" />
                        <Button variant="outline" className={actionButtonClass}>
                          <RefreshCw />
                          Пересоздать матчи и расписание
                        </Button>
                      </form>
                    ) : null}

                    <Button asChild variant="outline" className={wideActionButtonClass}>
                      <Link href={`/tournaments/${tournament.id}`}>
                        <Globe2 />
                        Публичная страница
                      </Link>
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                    <Button asChild variant="outline" className={quickButtonClass}>
                      <Link href={`/admin/tournaments/${tournament.id}/edit`}>
                        <Pencil />
                        Редактировать
                      </Link>
                    </Button>
                    <Button asChild variant="outline" className={quickButtonClass}>
                      <Link href={`/admin/tournaments/${tournament.id}/participants`}>
                        <Users />
                        Участники
                      </Link>
                    </Button>
                    <Button asChild variant="outline" className={quickButtonClass}>
                      <Link href={`/admin/tournaments/${tournament.id}/stages`}>
                        <GitBranch />
                        Стадии
                      </Link>
                    </Button>
                    <Button asChild variant="outline" className={quickButtonClass}>
                      <Link href={`/admin/tournaments/${tournament.id}/standings`}>
                        <Table2 />
                        Таблицы
                      </Link>
                    </Button>
                    <Button asChild variant="outline" className={`${quickButtonClass} col-span-2 sm:col-span-1`}>
                      <Link href={`/admin/tournaments/${tournament.id}/bracket`}>
                        <GitBranch />
                        Сетка
                      </Link>
                    </Button>
                  </div>

                  <form action={`/api/admin/tournaments/${tournament.id}`} method="post" className="grid gap-2 rounded-md border border-red-400/15 bg-red-500/[0.045] p-2.5 sm:grid-cols-[minmax(0,1fr)_180px] sm:items-center">
                    <input type="hidden" name="_method" value="delete" />
                    <label className="flex min-w-0 items-start gap-2 px-1 text-[11px] leading-4 text-zinc-400 sm:text-xs">
                      <input
                        type="checkbox"
                        name="preserveHomeStats"
                        className="mt-0.5 h-4 w-4 rounded border-white/15 bg-black/40 text-primary accent-primary"
                      />
                      <span>Сохранить турнир и призовой фонд в статистике главной</span>
                    </label>
                    <Button
                      variant="outline"
                      className="min-h-10 w-full gap-1.5 rounded-md border-red-400/20 bg-red-500/10 px-3 py-2 text-[12px] leading-tight text-red-200 hover:bg-red-500/20 hover:text-red-100 sm:text-sm"
                    >
                      <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
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
