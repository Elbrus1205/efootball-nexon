import { MatchResultStatus, UserRole } from "@prisma/client";
import { AlertTriangle, CheckCircle2, Eye, XCircle } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { requireRole } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/utils";

export default async function AdminModerationPage() {
  await requireRole([UserRole.ADMIN, UserRole.MODERATOR]);
  const submissions = await db.matchResultSubmission.findMany({
    include: {
      match: {
        include: { tournament: true, player1: true, player2: true },
      },
      submittedBy: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const pending = submissions.filter((item) => item.status === MatchResultStatus.PENDING);
  const disputed = submissions.filter((item) => item.match.status === "DISPUTED");

  const renderCard = (submission: (typeof submissions)[number]) => (
    <Card key={submission.id} className="space-y-4 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-medium text-white">{submission.match.tournament.title}</div>
          <div className="text-sm text-zinc-400">
            {submission.match.player1?.nickname ?? submission.match.player1?.name} vs {submission.match.player2?.nickname ?? submission.match.player2?.name}
          </div>
        </div>
        <Badge variant={submission.match.status === "DISPUTED" ? "danger" : "accent"}>{submission.match.status}</Badge>
      </div>

      <div className="text-sm text-zinc-300">Счёт: {submission.player1Score} : {submission.player2Score}</div>
      <div className="text-sm text-zinc-500">Отправлено: {formatDate(submission.createdAt)}</div>
      {submission.comment ? <div className="rounded-2xl border border-white/10 bg-black/20 p-3 text-sm text-zinc-400">{submission.comment}</div> : null}
      {submission.screenshotUrl ? (
        <a href={submission.screenshotUrl} target="_blank" className="inline-flex items-center gap-2 text-sm text-primary" rel="noreferrer">
          <Eye className="h-4 w-4" />
          Открыть скриншот
        </a>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" asChild>
          <Link href={`/admin/moderation/${submission.matchId}`}>Открыть workspace</Link>
        </Button>
        <form action={`/api/admin/matches/${submission.matchId}/review`} method="post">
          <input type="hidden" name="action" value="approve" />
          <input type="hidden" name="moderatorComment" value="Результат подтверждён" />
          <Button>
            <CheckCircle2 className="mr-2 h-4 w-4" />
            Подтвердить
          </Button>
        </form>
        <form action={`/api/admin/matches/${submission.matchId}/review`} method="post">
          <input type="hidden" name="action" value="reject" />
          <input type="hidden" name="moderatorComment" value="Нужен корректный скриншот или комментарий" />
          <Button variant="outline">
            <XCircle className="mr-2 h-4 w-4" />
            Отклонить
          </Button>
        </form>
        <form action={`/api/admin/matches/${submission.matchId}/review`} method="post">
          <input type="hidden" name="action" value="dispute" />
          <input type="hidden" name="moderatorComment" value="Матч переведён в спор и требует дополнительной проверки." />
          <Button variant="secondary">
            <AlertTriangle className="mr-2 h-4 w-4" />
            В спор
          </Button>
        </form>
      </div>
    </Card>
  );

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="font-display text-3xl font-thin text-white">Модерация результатов и споров</h1>
        <p className="text-zinc-400">Очередь подтверждения, спорные матчи и быстрый переход в отдельный dispute workspace.</p>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="space-y-4">
          <div className="text-sm font-semibold uppercase tracking-[0.24em] text-zinc-500">Ожидают проверки</div>
          {pending.length ? pending.map(renderCard) : <Card className="p-5 text-sm text-zinc-500">Очередь модерации пуста.</Card>}
        </div>

        <div className="space-y-4">
          <div className="text-sm font-semibold uppercase tracking-[0.24em] text-zinc-500">Спорные матчи</div>
          {disputed.length ? disputed.map(renderCard) : <Card className="p-5 text-sm text-zinc-500">Сейчас нет матчей в спорном статусе.</Card>}
        </div>
      </div>
    </div>
  );
}
