import Link from "next/link";
import { UserRole } from "@prisma/client";
import { Eye, Layers3, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { playoffTypeLabel, tournamentFormatLabel, tournamentStatusLabel, tournamentStatusVariant } from "@/lib/admin-display";
import { requireRole } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/utils";

export default async function AdminTournamentsPage() {
  await requireRole([UserRole.ADMIN]);
  const tournaments = await db.tournament.findMany({
    include: {
      _count: { select: { participants: true, stages: true, matches: true } },
      season: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <CardTitle>Турниры и форматы</CardTitle>
            <CardDescription>Единый список турниров, стадий и операционных переходов между регистрацией, группами и плей-офф.</CardDescription>
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
        {tournaments.map((tournament) => (
          <Card key={tournament.id} className="p-5">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="font-medium text-white">{tournament.title}</div>
                  <Badge variant={tournamentStatusVariant[tournament.status]}>{tournamentStatusLabel[tournament.status]}</Badge>
                  <Badge variant="neutral">{tournamentFormatLabel[tournament.format]}</Badge>
                  {tournament.playoffType ? <Badge variant="accent">{playoffTypeLabel[tournament.playoffType]}</Badge> : null}
                </div>
                <p className="max-w-3xl text-sm leading-6 text-zinc-400">{tournament.description}</p>
                <div className="flex flex-wrap gap-4 text-sm text-zinc-500">
                  <span>Старт: {formatDate(tournament.startsAt)}</span>
                  <span>Регистрация до: {formatDate(tournament.registrationEndsAt)}</span>
                  <span>Участники: {tournament._count.participants}/{tournament.maxParticipants}</span>
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
                <Button asChild variant="outline">
                  <Link href={`/tournaments/${tournament.id}`}>Публичная страница</Link>
                </Button>
                <form action={`/api/admin/tournaments/${tournament.id}`} method="post">
                  <input type="hidden" name="_method" value="generate-stages" />
                  <Button variant="outline">Сгенерировать стадии</Button>
                </form>
                <form action={`/api/admin/tournaments/${tournament.id}`} method="post">
                  <input type="hidden" name="_method" value="generate-matches" />
                  <Button variant="outline">Сгенерировать матчи</Button>
                </form>
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
              </div>
            </div>
          </Card>
        ))}
      </div>

      {!tournaments.length ? <Card className="p-6 text-sm text-zinc-500">Первый турнир можно собрать через конструктор: формат, стадии, участники и расписание.</Card> : null}
    </div>
  );
}
