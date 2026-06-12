import Link from "next/link";
import { TournamentStatus } from "@prisma/client";
import { Activity, CalendarRange, FileText, Megaphone, ShieldCheck, Trophy, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAnyPermission } from "@/lib/auth/session";
import { db } from "@/lib/db";

export default async function AdminPage() {
  await requireAnyPermission(["admin.matchesOnly", "matches.reviewResults", "tournaments.createEdit", "users.view", "content.manage", "broadcasts.manage", "profileStatuses.manage", "schedule.manage"]);

  const [totalTournaments, activeTournaments, completedTournaments, totalParticipants, activeSeason] = await db.$transaction([
    db.tournament.count(),
    db.tournament.count({ where: { status: { in: [TournamentStatus.REGISTRATION_OPEN, TournamentStatus.IN_PROGRESS] } } }),
    db.tournament.count({ where: { status: TournamentStatus.COMPLETED } }),
    db.tournamentRegistration.count({ where: { status: "CONFIRMED" } }),
    db.season.findFirst({ where: { isActive: true }, orderBy: [{ startsAt: "desc" }, { createdAt: "desc" }] }),
  ]);

  const stats = [
    { label: "Всего турниров", value: totalTournaments, icon: Trophy },
    { label: "Активные турниры", value: activeTournaments, icon: Activity },
    { label: "Завершённые", value: completedTournaments, icon: ShieldCheck },
    { label: "Участники", value: totalParticipants, icon: Users },
  ];

  const shortcuts = [
    { href: "/admin/tournaments", label: "Редактор турниров", variant: "default" as const, icon: Trophy },
    { href: "/admin/seasons", label: "Сезоны", variant: "secondary" as const, icon: CalendarRange },
    { href: "/admin/regulations", label: "Регламент", variant: "outline" as const, icon: FileText },
    { href: "/admin/broadcasts", label: "Рассылки", variant: "outline" as const, icon: Megaphone },
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

      <Card>
        <CardHeader>
          <CardTitle>Быстрые действия</CardTitle>
          <CardDescription>
            Ключевые сценарии ежедневной работы по турнирам. Активный сезон: {activeSeason?.name ?? "не выбран"}.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 space-y-0 sm:grid-cols-4 lg:flex lg:flex-wrap">
          {shortcuts.map((item) => (
            <Button key={item.href} asChild variant={item.variant} className="h-11 w-full rounded-xl px-4 lg:w-auto">
              <Link href={item.href} className="gap-2">
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            </Button>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
