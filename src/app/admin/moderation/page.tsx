import { UserRole } from "@prisma/client";
import { requireRole } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

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

  return (
    <div className="page-shell space-y-6">
      <h1 className="font-display text-3xl font-thin text-white">Модерация результатов</h1>
      <div className="grid gap-4">
        {submissions.map((submission) => (
          <Card key={submission.id} className="space-y-4 p-5">
            <div>
              <div className="font-medium text-white">{submission.match.tournament.title}</div>
              <div className="text-sm text-zinc-400">
                {submission.match.player1?.nickname ?? submission.match.player1?.name} vs {submission.match.player2?.nickname ?? submission.match.player2?.name}
              </div>
            </div>
            <div className="text-sm text-zinc-300">
              Счёт: {submission.player1Score} : {submission.player2Score}
            </div>
            {submission.screenshotUrl ? (
              <a href={submission.screenshotUrl} target="_blank" className="text-sm text-primary" rel="noreferrer">
                Открыть скриншот
              </a>
            ) : null}
            <div className="flex gap-2">
              <form action={`/api/admin/matches/${submission.matchId}/review`} method="post">
                <input type="hidden" name="action" value="approve" />
                <input type="hidden" name="moderatorComment" value="Результат подтверждён" />
                <Button>Подтвердить</Button>
              </form>
              <form action={`/api/admin/matches/${submission.matchId}/review`} method="post">
                <input type="hidden" name="action" value="reject" />
                <input type="hidden" name="moderatorComment" value="Нужен корректный скриншот или комментарий" />
                <Button variant="outline">Отклонить</Button>
              </form>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
