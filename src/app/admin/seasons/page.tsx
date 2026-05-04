import Link from "next/link";
import { Archive, Award, CalendarRange, CheckCircle2, Flag, Play, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requireRole } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/utils";
import { UserRole } from "@prisma/client";

function dateRange(startsAt: Date | null, endsAt: Date | null) {
  if (!startsAt && !endsAt) return "Даты не указаны";
  if (startsAt && !endsAt) return `С ${formatDate(startsAt, "d MMM yyyy")}`;
  if (!startsAt && endsAt) return `До ${formatDate(endsAt, "d MMM yyyy")}`;
  return `${formatDate(startsAt!, "d MMM yyyy")} - ${formatDate(endsAt!, "d MMM yyyy")}`;
}

export default async function AdminSeasonsPage({
  searchParams,
}: {
  searchParams?: { created?: string; deleted?: string; cleared?: string; finished?: string; error?: string };
}) {
  await requireRole([UserRole.FOUNDER]);

  const [seasons, tournamentsWithoutSeason, pendingStatusesCount] = await db.$transaction([
    db.season.findMany({
      include: { _count: { select: { tournaments: true } } },
      orderBy: [{ isActive: "desc" }, { startsAt: "desc" }, { createdAt: "desc" }],
    }),
    db.tournament.count({ where: { seasonId: null } }),
    db.userProfileStatus.count({ where: { approvalStatus: "PENDING" } }),
  ]);

  const activeSeason = seasons.find((season) => season.isActive) ?? null;
  const archivedSeasons = seasons.filter((season) => !season.isActive);
  const seasonTournamentCount = seasons.reduce((total, season) => total + season._count.tournaments, 0);

  return (
    <div className="space-y-6">
      {searchParams?.created ? (
        <Card className="rounded-lg border-emerald-400/20 bg-emerald-500/10 p-4 text-sm text-emerald-100">
          Новый сезон начат. Текущий рейтинг теперь считается заново, а прошлый сезон остался в архиве.
        </Card>
      ) : null}

      {searchParams?.finished ? (
        <Card className="rounded-lg border-sky-400/20 bg-sky-500/10 p-4 text-sm text-sky-100">
          Сезон завершён. Игроки получили уведомление, а сезонные статусы отправлены в раздел проверки.
        </Card>
      ) : null}

      {searchParams?.deleted ? (
        <Card className="rounded-lg border-amber-400/20 bg-amber-500/10 p-4 text-sm text-amber-100">Сезон удалён.</Card>
      ) : null}

      {searchParams?.cleared ? (
        <Card className="rounded-lg border-amber-400/20 bg-amber-500/10 p-4 text-sm text-amber-100">Все сезоны очищены.</Card>
      ) : null}

      {searchParams?.error ? (
        <Card className="rounded-lg border-rose-400/25 bg-rose-500/10 p-4 text-sm text-rose-100">{searchParams.error}</Card>
      ) : null}

      <Card className="rounded-lg p-5">
        <CardHeader className="mb-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>Сезоны</CardTitle>
              <CardDescription>
                Управляйте стартом, завершением и архивом сезонов. Статусы вынесены в отдельный раздел админ-панели.
              </CardDescription>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-primary/25 bg-primary/10 text-primary">
              <CalendarRange className="h-5 w-5" />
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-5">
          <form action="/api/admin/seasons" method="post" className="grid gap-3 rounded-lg border border-white/10 bg-white/[0.03] p-4 md:grid-cols-[1fr_auto] md:items-end">
            <input type="hidden" name="_action" value="create" />
            <div className="space-y-2">
              <Label htmlFor="season-name">Название нового сезона</Label>
              <Input id="season-name" name="name" required minLength={2} placeholder="Например: Весенний сезон 2026" className="rounded-lg" />
            </div>
            <Button type="submit" className="rounded-lg">
              <Play className="mr-2 h-4 w-4" />
              Начать сезон
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="rounded-lg p-5">
          <div className="text-sm text-zinc-400">Активный сезон</div>
          <div className="mt-3 truncate text-2xl font-semibold text-white">{activeSeason?.name ?? "Не выбран"}</div>
        </Card>
        <Card className="rounded-lg p-5">
          <div className="text-sm text-zinc-400">Всего сезонов</div>
          <div className="mt-3 text-2xl font-semibold text-white">{seasons.length}</div>
        </Card>
        <Card className="rounded-lg p-5">
          <div className="text-sm text-zinc-400">Архивных сезонов</div>
          <div className="mt-3 text-2xl font-semibold text-white">{archivedSeasons.length}</div>
        </Card>
        <Card className="rounded-lg p-5">
          <div className="text-sm text-zinc-400">Турниров в сезонах</div>
          <div className="mt-3 text-2xl font-semibold text-white">{seasonTournamentCount}</div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <Card className="rounded-lg p-5">
          <CardHeader>
            <CardTitle>Список сезонов</CardTitle>
            <CardDescription>Активный сезон применяется к новым турнирам и текущему рейтингу.</CardDescription>
          </CardHeader>

          <div className="grid gap-3">
            {seasons.map((season) => (
              <div key={season.id} className="rounded-lg border border-white/10 bg-black/20 p-4">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="truncate font-semibold text-white">{season.name}</div>
                      {season.isActive ? <Badge variant="success">Активный</Badge> : <Badge>Архив</Badge>}
                    </div>
                    <div className="flex flex-wrap gap-4 text-sm text-zinc-500">
                      <span>{dateRange(season.startsAt, season.endsAt)}</span>
                      <span>Турниров: {season._count.tournaments}</span>
                    </div>
                  </div>

                  <div className="grid min-w-[240px] gap-2 xl:w-[380px]">
                    {season.isActive ? (
                      <form action={`/api/admin/seasons/${season.id}`} method="post">
                        <input type="hidden" name="_action" value="finish" />
                        <Button type="submit" variant="accent" className="w-full rounded-lg">
                          <Flag className="mr-2 h-4 w-4" />
                          Завершить сезон
                        </Button>
                      </form>
                    ) : null}

                    <form action={`/api/admin/seasons/${season.id}`} method="post" className="grid gap-2 sm:grid-cols-[1fr_auto]">
                      <input type="hidden" name="_method" value="delete" />
                      <Input name="confirmation" placeholder="УДАЛИТЬ" className="rounded-lg" aria-label="Подтверждение удаления сезона" />
                      <Button
                        type="submit"
                        variant="outline"
                        className="rounded-lg border-rose-400/25 bg-rose-500/10 text-rose-100 hover:bg-rose-500/20"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Удалить
                      </Button>
                    </form>
                  </div>
                </div>
              </div>
            ))}

            {!seasons.length ? (
              <div className="rounded-lg border border-dashed border-white/10 bg-black/20 p-5 text-sm text-zinc-500">
                Сезонов пока нет. Начните первый сезон, чтобы текущий рейтинг считался отдельно от общего архива.
              </div>
            ) : null}
          </div>
        </Card>

        <div className="space-y-4">
          <Card className="rounded-lg border-primary/20 bg-primary/5 p-5">
            <CardHeader>
              <CardTitle>Статусы игроков</CardTitle>
              <CardDescription>Подтверждение и настройка сезонных статусов теперь находятся в отдельном меню.</CardDescription>
            </CardHeader>
            <Link href="/admin/statuses" className="block">
              <Button type="button" variant="secondary" className="w-full rounded-lg">
                <Award className="mr-2 h-4 w-4" />
                Открыть статусы
                {pendingStatusesCount ? <span className="ml-2 rounded-full bg-accent px-2 py-0.5 text-xs font-bold text-black">{pendingStatusesCount}</span> : null}
              </Button>
            </Link>
          </Card>

          <Card className="rounded-lg border-rose-400/20 bg-rose-500/5 p-5">
            <CardHeader>
              <CardTitle>Очистка сезонов</CardTitle>
              <CardDescription>Удалит все сезоны и отвяжет турниры от сезонного архива. Матчи и турниры не удаляются.</CardDescription>
            </CardHeader>
            <form action="/api/admin/seasons" method="post" className="space-y-3">
              <input type="hidden" name="_action" value="clear" />
              <div className="rounded-lg border border-amber-300/20 bg-amber-400/10 p-3 text-sm text-amber-100">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>Для подтверждения введите ОЧИСТИТЬ.</span>
                </div>
              </div>
              <Input name="confirmation" placeholder="ОЧИСТИТЬ" className="rounded-lg" />
              <Button type="submit" variant="outline" className="w-full rounded-lg border-rose-400/25 bg-rose-500/10 text-rose-100 hover:bg-rose-500/20">
                <Archive className="mr-2 h-4 w-4" />
                Очистить все сезоны
              </Button>
            </form>

            {tournamentsWithoutSeason ? (
              <div className="mt-4 rounded-lg border border-white/10 bg-black/20 p-3 text-xs text-zinc-500">
                Турниров без сезона: {tournamentsWithoutSeason}. Они учитываются только в рейтинге за всё время.
              </div>
            ) : null}
          </Card>
        </div>
      </div>
    </div>
  );
}
