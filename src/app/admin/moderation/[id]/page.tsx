import { MatchResultStatus, UserRole } from "@prisma/client";
import { AlertTriangle, CheckCircle2, Eye, FileClock, History, XCircle } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { requireRole } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/utils";

export default async function AdminModerationWorkspacePage({ params }: { params: { id: string } }) {
  await requireRole([UserRole.ADMIN, UserRole.MODERATOR]);

  const match = await db.match.findUnique({
    where: { id: params.id },
    include: {
      tournament: true,
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

  const actions = await db.adminAction.findMany({
    where: {
      OR: [
        { entityId: match.id },
        { tournamentId: match.tournamentId, entityType: "MATCH_REVIEW" },
      ],
    },
    include: {
      admin: true,
    },
    orderBy: { createdAt: "desc" },
    take: 12,
  });

  const latestSubmission = match.submissions[0];
  const pendingCount = match.submissions.filter((submission) => submission.status === MatchResultStatus.PENDING).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-2">
          <div className="text-sm uppercase tracking-[0.24em] text-primary">Dispute Workspace</div>
          <h1 className="font-display text-3xl font-thin text-white">Матч под модерацией</h1>
          <p className="max-w-3xl text-sm text-zinc-400">
            Единое рабочее пространство для проверки доказательств, просмотра истории отправок и принятия решения по матчу.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/admin/moderation">Назад к очереди</Link>
        </Button>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>{match.tournament.title}</CardTitle>
            <CardDescription>
              {(match.player1?.nickname ?? match.player1?.name ?? "TBD")} vs {(match.player2?.nickname ?? match.player2?.name ?? "TBD")}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-zinc-500">Статус матча</div>
              <div className="mt-2">
                <Badge variant={match.status === "DISPUTED" ? "danger" : "accent"}>{match.status}</Badge>
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-zinc-500">Отправок результата</div>
              <div className="mt-2 text-2xl font-semibold text-white">{match.submissions.length}</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-zinc-500">Ожидают решения</div>
              <div className="mt-2 text-2xl font-semibold text-white">{pendingCount}</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Ближайший слот</CardTitle>
            <CardDescription>Планирование и текущие привязки матча.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-zinc-400">
            {match.schedules.length ? (
              match.schedules.map((schedule) => (
                <div key={schedule.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div>{formatDate(schedule.startsAt)}</div>
                  <div className="mt-1 text-zinc-500">{schedule.slotLabel ?? "Без подписи слота"}</div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-white/10 bg-black/10 p-4">Матч ещё не привязан к слоту расписания.</div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <Card>
          <CardHeader>
            <CardTitle>Таймлайн отправок</CardTitle>
            <CardDescription>Комментарии игроков, скриншоты и история пересмотра результата.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {match.submissions.length ? (
              match.submissions.map((submission) => (
                <div key={submission.id} className="rounded-[1.75rem] border border-white/10 bg-black/20 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="font-medium text-white">{submission.submittedBy.nickname ?? submission.submittedBy.name ?? "Игрок"}</div>
                      <div className="mt-1 text-sm text-zinc-500">{formatDate(submission.createdAt)}</div>
                    </div>
                    <Badge variant={submission.status === MatchResultStatus.PENDING ? "accent" : submission.status === MatchResultStatus.REJECTED ? "danger" : "success"}>
                      {submission.status}
                    </Badge>
                  </div>

                  <div className="mt-4 grid gap-4 lg:grid-cols-[auto_1fr]">
                    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-lg font-semibold text-white">
                      {submission.player1Score} : {submission.player2Score}
                    </div>
                    <div className="space-y-3">
                      {submission.comment ? <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-zinc-300">{submission.comment}</div> : null}
                      {submission.moderatorComment ? (
                        <div className="rounded-2xl border border-primary/20 bg-primary/10 p-4 text-sm text-zinc-200">
                          Решение модератора: {submission.moderatorComment}
                        </div>
                      ) : null}
                      {submission.screenshotUrl ? (
                        <a href={submission.screenshotUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm text-primary">
                          <Eye className="h-4 w-4" />
                          Открыть скриншот
                        </a>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-white/10 bg-black/10 p-5 text-sm text-zinc-500">По этому матчу пока нет отправленных результатов.</div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Решение модератора</CardTitle>
              <CardDescription>Подтверждение, отклонение или перевод матча в спорный сценарий.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <form action={`/api/admin/matches/${match.id}/review`} method="post" className="space-y-3">
                <input type="hidden" name="action" value="approve" />
                <Textarea name="moderatorComment" placeholder="Комментарий модератора для подтверждения результата" defaultValue="Результат подтверждён после проверки отправки." />
                <Button className="w-full">
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Подтвердить результат
                </Button>
              </form>

              <form action={`/api/admin/matches/${match.id}/review`} method="post" className="space-y-3">
                <input type="hidden" name="action" value="reject" />
                <Textarea name="moderatorComment" placeholder="Причина отклонения результата" defaultValue="Нужен корректный скриншот или уточнение по счёту." />
                <Button variant="outline" className="w-full">
                  <XCircle className="mr-2 h-4 w-4" />
                  Отклонить результат
                </Button>
              </form>

              <form action={`/api/admin/matches/${match.id}/review`} method="post" className="space-y-3">
                <input type="hidden" name="action" value="dispute" />
                <Textarea name="moderatorComment" placeholder="Причина перевода в спор" defaultValue="Матч требует дополнительной проверки и решения модератора." />
                <Button variant="secondary" className="w-full">
                  <AlertTriangle className="mr-2 h-4 w-4" />
                  Перевести в спор
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5 text-primary" />
                Audit Timeline
              </CardTitle>
              <CardDescription>Все действия администраторов по этому матчу и ближайшим решениям модерации.</CardDescription>
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
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-white/10 bg-black/10 p-4 text-sm text-zinc-500">Для этого матча ещё нет записей в audit panel.</div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Что видно в workspace</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-zinc-400">
              <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-black/20 p-4">
                <FileClock className="mt-0.5 h-4 w-4 text-primary" />
                <div>История всех отправок результата и комментариев игроков.</div>
              </div>
              <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-black/20 p-4">
                <Eye className="mt-0.5 h-4 w-4 text-primary" />
                <div>Быстрый доступ к скриншотам и текущему расписанию матча.</div>
              </div>
              <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-black/20 p-4">
                <AlertTriangle className="mt-0.5 h-4 w-4 text-accent" />
                <div>Единая точка решения по спорным матчам без возврата в общий список.</div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {latestSubmission ? (
        <Card>
          <CardHeader>
            <CardTitle>Последняя активность</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-zinc-400">
            Последняя отправка пришла {formatDate(latestSubmission.createdAt)} от {latestSubmission.submittedBy.nickname ?? latestSubmission.submittedBy.name ?? "игрока"}.
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
