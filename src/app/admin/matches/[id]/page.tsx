import { UserRole } from "@prisma/client";
import { CalendarDays, History, PlayCircle, Trophy, Users } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AuditDiff } from "@/components/admin/audit-diff";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { matchStatusLabel, matchStatusVariant } from "@/lib/admin-display";
import { requireRole } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/utils";

export default async function AdminMatchWorkspacePage({ params }: { params: { id: string } }) {
  await requireRole([UserRole.ADMIN, UserRole.MODERATOR]);

  const match = await db.match.findUnique({
    where: { id: params.id },
    include: {
      tournament: true,
      stage: true,
      group: true,
      player1: true,
      player2: true,
      submissions: {
        orderBy: { createdAt: "desc" },
      },
      schedules: {
        orderBy: { startsAt: "asc" },
      },
    },
  });

  if (!match) notFound();

  const actions = await db.adminAction.findMany({
    where: { entityId: match.id },
    include: { admin: true },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-2">
          <div className="text-sm uppercase tracking-[0.24em] text-primary">Match Workspace</div>
          <h1 className="font-display text-3xl font-thin text-white">{match.tournament.title}</h1>
          <p className="text-sm text-zinc-400">
            {(match.player1?.nickname ?? match.player1?.name ?? "TBD")} vs {(match.player2?.nickname ?? match.player2?.name ?? "TBD")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/admin/matches">Назад к матчам</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href={`/admin/tournaments/${match.tournamentId}`}>Открыть турнир</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardContent className="flex items-start justify-between p-5">
            <div>
              <div className="text-sm text-zinc-400">Статус</div>
              <div className="mt-3">
                <Badge variant={matchStatusVariant[match.status] ?? "neutral"}>{matchStatusLabel[match.status] ?? match.status}</Badge>
              </div>
            </div>
            <Trophy className="h-5 w-5 text-accent" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-start justify-between p-5">
            <div>
              <div className="text-sm text-zinc-400">Стадия</div>
              <div className="mt-3 text-white">{match.stage?.name ?? "Без стадии"}</div>
            </div>
            <Users className="h-5 w-5 text-primary" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-start justify-between p-5">
            <div>
              <div className="text-sm text-zinc-400">Группа</div>
              <div className="mt-3 text-white">{match.group?.name ?? "Без группы"}</div>
            </div>
            <Users className="h-5 w-5 text-primary" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-start justify-between p-5">
            <div>
              <div className="text-sm text-zinc-400">Слот</div>
              <div className="mt-3 text-white">{match.scheduledAt ? formatDate(match.scheduledAt) : "Не назначен"}</div>
            </div>
            <CalendarDays className="h-5 w-5 text-primary" />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <Card>
          <CardHeader>
            <CardTitle>Карточка матча</CardTitle>
            <CardDescription>Текущее состояние пары, счёт, отправки результата и быстрые переходы к связанным разделам.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-lg font-semibold text-white">
              {(match.player1?.nickname ?? match.player1?.name ?? "TBD")} vs {(match.player2?.nickname ?? match.player2?.name ?? "TBD")}
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="text-sm text-zinc-500">Счёт</div>
                <div className="mt-2 text-2xl font-semibold text-white">
                  {match.player1Score ?? "—"} : {match.player2Score ?? "—"}
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="text-sm text-zinc-500">Отправок результата</div>
                <div className="mt-2 text-2xl font-semibold text-white">{match.submissions.length}</div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="secondary">
                <Link href={`/admin/moderation/${match.id}`}>Открыть dispute workspace</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href={`/tournaments/${match.tournamentId}`}>Публичная страница</Link>
              </Button>
              <form action={`/api/admin/matches/${match.id}/review`} method="post">
                <input type="hidden" name="action" value="approve" />
                <input type="hidden" name="moderatorComment" value="Результат подтверждён из match workspace." />
                <Button>
                  <PlayCircle className="mr-2 h-4 w-4" />
                  Подтвердить
                </Button>
              </form>
              <form action={`/api/admin/matches/${match.id}/review`} method="post">
                <input type="hidden" name="action" value="dispute" />
                <input type="hidden" name="moderatorComment" value="Матч переведён в спор из match workspace." />
                <Button variant="outline">В спор</Button>
              </form>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5 text-primary" />
              Audit Timeline
            </CardTitle>
            <CardDescription>История ручных изменений матча с before/after diff.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {actions.length ? (
              actions.map((action) => (
                <div key={action.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-medium text-white">{action.entityType}</div>
                    <Badge variant="neutral">{action.actionType}</Badge>
                  </div>
                  <div className="mt-2 text-sm text-zinc-400">{action.admin.nickname ?? action.admin.name ?? action.admin.email ?? "Администратор"}</div>
                  <div className="mt-1 text-xs uppercase tracking-[0.18em] text-zinc-500">{formatDate(action.createdAt)}</div>
                  <div className="mt-3">
                    <AuditDiff before={action.beforeJson} after={action.afterJson} />
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-white/10 bg-black/10 p-4 text-sm text-zinc-500">По этому матчу audit-записей пока нет.</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
