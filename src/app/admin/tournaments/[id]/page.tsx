import Link from "next/link";
import { StageType, UserRole } from "@prisma/client";
import { notFound } from "next/navigation";
import { Activity, CalendarDays, GitBranch, History, ShieldCheck, Swords, Users } from "lucide-react";
import { AuditDiff } from "@/components/admin/audit-diff";
import { MatchManager } from "@/components/admin/match-manager";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { adminActionLabel, adminEntityLabel, playoffTypeLabel, tournamentFormatLabel, tournamentStatusLabel, tournamentStatusVariant } from "@/lib/admin-display";
import { requireRole } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/utils";

export default async function AdminTournamentWorkspacePage({ params }: { params: { id: string } }) {
  await requireRole([UserRole.ADMIN, UserRole.MODERATOR]);

  const tournament = await db.tournament.findUnique({
    where: { id: params.id },
    include: {
      participants: {
        include: { user: true, group: true },
        orderBy: [{ seed: "asc" }, { createdAt: "asc" }],
      },
      matches: {
        include: {
          player1: true,
          player2: true,
          stage: true,
          group: true,
        },
        orderBy: [{ round: "asc" }, { matchNumber: "asc" }],
      },
      stages: {
        include: { groups: true, bracket: true },
        orderBy: { orderIndex: "asc" },
      },
      actions: {
        include: { admin: true },
        orderBy: { createdAt: "desc" },
        take: 8,
      },
    },
  });

  if (!tournament) notFound();

  const groupStage = tournament.stages.find((stage) => stage.type === StageType.GROUP_STAGE);
  const playoffStage = tournament.stages.find((stage) => stage.type === StageType.PLAYOFF);
  const nextScheduledMatch = tournament.matches.find((match) => match.scheduledAt);

  const stats = [
    { label: "Участники", value: tournament.participants.length, icon: Users },
    { label: "Матчи", value: tournament.matches.length, icon: Swords },
    { label: "Этапы", value: tournament.stages.length, icon: GitBranch },
    { label: "Ближайший слот", value: nextScheduledMatch?.scheduledAt ? formatDate(nextScheduledMatch.scheduledAt) : "—", icon: CalendarDays },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={tournamentStatusVariant[tournament.status]}>{tournamentStatusLabel[tournament.status]}</Badge>
              <Badge variant="accent">{tournamentFormatLabel[tournament.format] ?? tournament.format}</Badge>
              {tournament.playoffType ? <Badge variant="neutral">{playoffTypeLabel[tournament.playoffType]}</Badge> : null}
            </div>
            <CardTitle className="mt-3 text-3xl">{tournament.title}</CardTitle>
            <CardDescription>{tournament.description}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button asChild>
              <Link href={`/admin/tournaments/${tournament.id}/edit`}>Редактировать турнир</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href={`/admin/tournaments/${tournament.id}/participants`}>Участники</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={`/admin/tournaments/${tournament.id}/stages`}>Этапы</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={`/admin/tournaments/${tournament.id}/bracket`}>Сетка</Link>
            </Button>
          </CardContent>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2">
          {stats.map((item) => (
            <Card key={item.label}>
              <CardContent className="flex items-start justify-between p-5">
                <div>
                  <div className="text-sm text-zinc-400">{item.label}</div>
                  <div className="mt-2 text-2xl font-semibold text-white">{item.value}</div>
                </div>
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <item.icon className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>Ручной редактор матчей</CardTitle>
            <CardDescription>Live search, фильтры и drag-and-drop карточек внутри каждого раунда прямо в workspace турнира.</CardDescription>
          </CardHeader>
          <CardContent>
            <MatchManager
              tournamentId={tournament.id}
              matches={tournament.matches.map((match) => ({
                ...match,
                scheduledAt: match.scheduledAt?.toISOString() ?? null,
              }))}
              participants={tournament.participants}
            />
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-primary" />
                Связка стадий
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-zinc-400">
              <div>Группы: {groupStage ? `${groupStage.groups.length} групп` : "не настроены"}</div>
              <div>Плей-офф: {playoffStage ? "готов к заполнению" : "не создан"}</div>
              <div className="flex flex-wrap gap-2">
                <Button asChild variant="secondary">
                  <Link href={`/admin/tournaments/${tournament.id}/standings`}>Таблицы групп</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href={`/admin/tournaments/${tournament.id}/bracket`}>Посев в плей-офф</Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5 text-primary" />
                История действий
              </CardTitle>
              <CardDescription>Последние admin actions с before/after diff по ключевым изменениям турнира.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {tournament.actions.length ? (
                tournament.actions.map((action) => (
                  <div key={action.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-medium text-white">{adminEntityLabel(action.entityType)}</div>
                      <Badge variant="neutral">{adminActionLabel[action.actionType] ?? action.actionType}</Badge>
                    </div>
                    <div className="mt-2 text-sm text-zinc-400">{action.admin.nickname ?? action.admin.name ?? action.admin.email ?? "Администратор"}</div>
                    <div className="mt-2 text-sm text-zinc-500">{formatDate(action.createdAt)}</div>
                    <div className="mt-3">
                      <AuditDiff before={action.beforeJson} after={action.afterJson} />
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-white/10 bg-black/10 p-4 text-sm text-zinc-500">История действий появится после первых изменений по турниру.</div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-primary" />
                Быстрые переходы
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2">
              <Button asChild variant="outline">
                <Link href={`/admin/tournaments/${tournament.id}/participants`}>Участники и группы</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href={`/admin/tournaments/${tournament.id}/stages`}>Редактор стадий</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href={`/admin/tournaments/${tournament.id}/standings`}>Standings manager</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
