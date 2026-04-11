import { MatchStatus, UserRole } from "@prisma/client";
import { AlertTriangle, CalendarDays, CheckCircle2, Trophy } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { matchStatusLabel, matchStatusVariant } from "@/lib/admin-display";
import { requireRole } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { getPlayerDisplayName } from "@/lib/player-name";
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
        include: { submittedBy: true },
        orderBy: { createdAt: "desc" },
      },
      schedules: {
        orderBy: { startsAt: "asc" },
      },
    },
  });

  if (!match) notFound();

  const player1Name = match.player1 ? getPlayerDisplayName(match.player1) : "Игрок 1";
  const player2Name = match.player2 ? getPlayerDisplayName(match.player2) : "Игрок 2";
  const latestSubmission = match.submissions[0];
  const isDisputed = match.status === MatchStatus.DISPUTED;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <div className="text-sm uppercase tracking-[0.24em] text-primary">Управление матчем</div>
          <h1 className="font-display text-3xl font-thin text-white">{match.tournament.title}</h1>
          <p className="text-sm text-zinc-400">
            {player1Name} <span className="text-zinc-600">vs</span> {player2Name}
          </p>
        </div>
        <div className="grid gap-2 sm:flex sm:flex-wrap sm:justify-end">
          <Button asChild variant="outline" className="w-full sm:w-auto">
            <Link href="/admin/matches">Назад к матчам</Link>
          </Button>
          <Button asChild variant="secondary" className="w-full sm:w-auto">
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
            <Trophy className="h-5 w-5 text-primary" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-start justify-between p-5">
            <div>
              <div className="text-sm text-zinc-400">Группа</div>
              <div className="mt-3 text-white">{match.group?.name ?? "Без группы"}</div>
            </div>
            <Trophy className="h-5 w-5 text-primary" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-start justify-between p-5">
            <div>
              <div className="text-sm text-zinc-400">Время</div>
              <div className="mt-3 text-white">{match.scheduledAt ? formatDate(match.scheduledAt) : "Не назначено"}</div>
            </div>
            <CalendarDays className="h-5 w-5 text-primary" />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Карточка матча</CardTitle>
            <CardDescription>Основная информация, текущий счёт и последняя отправка результата.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-center">
                <div className="min-w-0">
                  <div className="truncate font-semibold text-white">{player1Name}</div>
                </div>
                <div className="rounded-full bg-white/5 px-4 py-2 text-sm font-semibold text-zinc-300">
                  {match.player1Score !== null && match.player2Score !== null ? `${match.player1Score} : ${match.player2Score}` : "VS"}
                </div>
                <div className="min-w-0">
                  <div className="truncate font-semibold text-white">{player2Name}</div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Последняя отправка</div>
              <div className="mt-2 text-2xl font-semibold text-white">
                {latestSubmission ? `${latestSubmission.player1Score} : ${latestSubmission.player2Score}` : "Нет отправок"}
              </div>
              {latestSubmission ? (
                <div className="mt-2 text-sm text-zinc-500">
                  {latestSubmission.submittedBy ? getPlayerDisplayName(latestSubmission.submittedBy) : "Игрок"} • {formatDate(latestSubmission.createdAt)}
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card className={isDisputed ? "border-rose-400/20" : undefined}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {isDisputed ? <AlertTriangle className="h-5 w-5 text-rose-300" /> : <CheckCircle2 className="h-5 w-5 text-primary" />}
              Решение результата
            </CardTitle>
            <CardDescription>
              {isDisputed
                ? "Матч в споре. Администратор вводит финальный счёт и подтверждает результат."
                : "Если нужно, администратор может вручную подтвердить финальный счёт матча."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={`/api/admin/matches/${match.id}/review`} method="post" className="space-y-4">
              <input type="hidden" name="action" value="approve" />
              <input type="hidden" name="moderatorComment" value="Администратор вручную подтвердил финальный счёт матча." />

              <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-3">
                <label className="space-y-2">
                  <span className="block truncate text-xs text-zinc-400">{player1Name}</span>
                  <Input name="player1Score" type="number" min={0} max={99} required defaultValue={match.player1Score ?? latestSubmission?.player1Score ?? 0} />
                </label>
                <div className="pb-3 text-sm font-semibold text-zinc-500">:</div>
                <label className="space-y-2">
                  <span className="block truncate text-xs text-zinc-400">{player2Name}</span>
                  <Input name="player2Score" type="number" min={0} max={99} required defaultValue={match.player2Score ?? latestSubmission?.player2Score ?? 0} />
                </label>
              </div>

              <Button className="w-full">
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Подтвердить результат
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
