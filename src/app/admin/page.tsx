import Link from "next/link";
import { AdminActionType, TournamentStatus, UserRole } from "@prisma/client";
import { Activity, CalendarDays, ShieldCheck, Swords, Trophy, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { adminActionLabel, matchStatusLabel, matchStatusVariant } from "@/lib/admin-display";
import { requireRole } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/utils";

export default async function AdminPage() {
  await requireRole([UserRole.ADMIN, UserRole.MODERATOR, UserRole.HEAD_JUDGE, UserRole.JUDGE]);

  const now = new Date();
  const [totalTournaments, activeTournaments, completedTournaments, totalParticipants, upcomingMatches, recentActions] = await db.$transaction([
    db.tournament.count(),
    db.tournament.count({ where: { status: { in: [TournamentStatus.REGISTRATION_OPEN, TournamentStatus.IN_PROGRESS] } } }),
    db.tournament.count({ where: { status: TournamentStatus.COMPLETED } }),
    db.tournamentRegistration.count({ where: { status: "CONFIRMED" } }),
    db.match.findMany({
      where: { scheduledAt: { gte: now } },
      include: {
        tournament: true,
        player1: true,
        player2: true,
      },
      orderBy: { scheduledAt: "asc" },
      take: 5,
    }),
    db.adminAction.findMany({
      include: { admin: true, tournament: true },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
  ]);

  const stats = [
    { label: "Всего турниров", value: totalTournaments, icon: Trophy },
    { label: "Активные турниры", value: activeTournaments, icon: Activity },
    { label: "Завершённые", value: completedTournaments, icon: ShieldCheck },
    { label: "Подтверждённые участники", value: totalParticipants, icon: Users },
  ];

  const shortcuts = [
    { href: "/admin/tournaments", label: "Редактор турниров", variant: "default" as const },
    { href: "/admin", label: "Панель", variant: "secondary" as const },
    { href: "/admin/regulations", label: "Регламент", variant: "outline" as const },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {stats.map((item) => (
          <Card key={item.label} className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-sm text-zinc-400">{item.label}</div>
                <div className="mt-3 text-3xl font-semibold tracking-tight text-white">{item.value}</div>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <item.icon className="h-5 w-5" />
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>Ближайшие матчи</CardTitle>
            <CardDescription>Операционный список ближайших слотов и статусов матчей.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {upcomingMatches.length ? (
              upcomingMatches.map((match) => (
                <div key={match.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-medium text-white">{match.tournament.title}</div>
                      <div className="mt-1 text-sm text-zinc-400">
                        {(match.player1?.nickname ?? match.player1?.name ?? "TBD")} vs {(match.player2?.nickname ?? match.player2?.name ?? "TBD")}
                      </div>
                    </div>
                    <Badge variant={matchStatusVariant[match.status] ?? "neutral"}>{matchStatusLabel[match.status] ?? match.status}</Badge>
                  </div>
                  <div className="mt-3 flex items-center gap-2 text-sm text-zinc-400">
                    <CalendarDays className="h-4 w-4 text-primary" />
                    {match.scheduledAt ? formatDate(match.scheduledAt) : "Дата не назначена"}
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-white/10 bg-black/10 p-4 text-sm text-zinc-500">Ближайшие матчи появятся после генерации расписания.</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Быстрые действия</CardTitle>
            <CardDescription>Ключевые сценарии ежедневной работы по турнирам.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {shortcuts.map((item) => (
              <Button key={item.href} asChild variant={item.variant} className="w-full justify-between">
                <Link href={item.href}>
                  {item.label}
                  <Swords className="h-4 w-4" />
                </Link>
              </Button>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Последние действия</CardTitle>
          <CardDescription>Изменения структуры, статусов и турнирных операций.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          {recentActions.length ? (
            recentActions.map((action) => (
              <div key={action.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="font-medium text-white">{action.tournament?.title ?? action.entityType}</div>
                  <Badge variant={action.actionType === AdminActionType.APPROVE ? "success" : "neutral"}>{adminActionLabel[action.actionType]}</Badge>
                </div>
                <div className="mt-2 text-sm text-zinc-400">{action.admin.nickname ?? action.admin.name ?? action.admin.email ?? "Администратор"}</div>
                <div className="mt-2 text-sm text-zinc-500">{formatDate(action.createdAt)}</div>
              </div>
            ))
          ) : (
            <div className="rounded-2xl border border-dashed border-white/10 bg-black/10 p-4 text-sm text-zinc-500">Лента действий начнёт заполняться после операций с турнирами и матчами.</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
