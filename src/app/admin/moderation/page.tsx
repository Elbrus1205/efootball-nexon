import { MatchStatus, UserRole } from "@prisma/client";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { matchStatusLabel, matchStatusVariant } from "@/lib/admin-display";
import { requireRole } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { getPlayerDisplayName } from "@/lib/player-name";
import { formatDate } from "@/lib/utils";

export default async function AdminModerationPage() {
  await requireRole([UserRole.ADMIN, UserRole.MODERATOR]);

  const disputedMatches = await db.match.findMany({
    where: { status: MatchStatus.DISPUTED },
    include: {
      tournament: true,
      player1: true,
      player2: true,
      submissions: {
        include: { submittedBy: true },
        orderBy: { createdAt: "desc" },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <div className="inline-flex items-center gap-2 rounded-full border border-rose-400/20 bg-rose-400/10 px-4 py-2 text-sm font-medium text-rose-200">
          <AlertTriangle className="h-4 w-4" />
          Спорные матчи
        </div>
        <h1 className="font-display text-3xl font-thin text-white">Модерация</h1>
        <p className="max-w-3xl text-zinc-400">
          Здесь показываются матчи, где игроки несколько раз отправили разные результаты. Матч перешёл в спор, поэтому администратор вводит финальный счёт и подтверждает результат.
        </p>
      </div>

      <div className="grid gap-5">
        {disputedMatches.length ? (
          disputedMatches.map((match) => {
            const player1Name = match.player1 ? getPlayerDisplayName(match.player1) : "Игрок 1";
            const player2Name = match.player2 ? getPlayerDisplayName(match.player2) : "Игрок 2";
            const latestSubmission = match.submissions[0];

            return (
              <Card key={match.id} className="space-y-5 p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-2">
                    <div className="text-sm text-zinc-500">{match.tournament.title}</div>
                    <div className="text-xl font-semibold text-white">
                      {player1Name} <span className="text-zinc-500">vs</span> {player2Name}
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs text-zinc-500">
                      <span>Матч в споре</span>
                      <span>•</span>
                      <span>Нужно вмешательство администратора</span>
                    </div>
                  </div>

                  <Badge variant={matchStatusVariant[match.status] ?? "danger"}>
                    {matchStatusLabel[match.status] ?? "Спор"}
                  </Badge>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Последний отправленный счёт</div>
                    <div className="mt-2 text-2xl font-semibold text-white">
                      {latestSubmission ? `${latestSubmission.player1Score} : ${latestSubmission.player2Score}` : "Нет отправок"}
                    </div>
                    {latestSubmission ? (
                      <div className="mt-2 text-sm text-zinc-500">
                        {latestSubmission.submittedBy ? getPlayerDisplayName(latestSubmission.submittedBy) : "Игрок"} • {formatDate(latestSubmission.createdAt)}
                      </div>
                    ) : null}
                  </div>

                  <form action={`/api/admin/matches/${match.id}/review`} method="post" className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
                    <input type="hidden" name="action" value="approve" />
                    <input type="hidden" name="moderatorComment" value="Администратор вручную подтвердил финальный счёт спорного матча." />

                    <div className="text-xs uppercase tracking-[0.18em] text-primary">Решение администратора</div>
                    <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-end gap-3">
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

                    <Button className="mt-4 w-full">
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Подтвердить результат
                    </Button>
                  </form>
                </div>
              </Card>
            );
          })
        ) : (
          <Card className="p-6 text-sm text-zinc-500">Сейчас нет матчей, где требуется вмешательство администратора.</Card>
        )}
      </div>
    </div>
  );
}
