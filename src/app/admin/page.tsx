import Link from "next/link";
import { TournamentStatus, UserRole } from "@prisma/client";
import { Activity, ShieldCheck, Swords, Trophy, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/auth/session";
import { db } from "@/lib/db";

export default async function AdminPage() {
  await requireRole([UserRole.ADMIN, UserRole.MODERATOR, UserRole.HEAD_JUDGE, UserRole.JUDGE]);

  const [totalTournaments, activeTournaments, completedTournaments, totalParticipants] = await db.$transaction([
    db.tournament.count(),
    db.tournament.count({ where: { status: { in: [TournamentStatus.REGISTRATION_OPEN, TournamentStatus.IN_PROGRESS] } } }),
    db.tournament.count({ where: { status: TournamentStatus.COMPLETED } }),
    db.tournamentRegistration.count({ where: { status: "CONFIRMED" } }),
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

      <Card>
        <CardHeader>
          <CardTitle>Быстрые действия</CardTitle>
          <CardDescription>Ключевые сценарии ежедневной работы по турнирам.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
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
  );
}
