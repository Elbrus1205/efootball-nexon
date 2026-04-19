import Link from "next/link";
import { UserRole } from "@prisma/client";
import { ArrowLeft, History } from "lucide-react";
import { notFound } from "next/navigation";
import { AuditDiff } from "@/components/admin/audit-diff";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { adminActionLabel, adminEntityLabel } from "@/lib/admin-display";
import { requireRole } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/utils";

export default async function AdminTournamentHistoryPage({ params }: { params: { id: string } }) {
  await requireRole([UserRole.ADMIN, UserRole.MODERATOR, UserRole.HEAD_JUDGE, UserRole.JUDGE]);

  const tournament = await db.tournament.findUnique({
    where: { id: params.id },
    include: {
      actions: {
        include: { admin: true },
        orderBy: { createdAt: "desc" },
        take: 80,
      },
    },
  });

  if (!tournament) notFound();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <Card className="flex-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5 text-primary" />
              История действий
            </CardTitle>
            <CardDescription>{tournament.title}: последние изменения, действия админов и diff ключевых данных.</CardDescription>
          </CardHeader>
        </Card>

        <Button asChild variant="outline" className="w-full lg:w-auto">
          <Link href={`/admin/tournaments/${tournament.id}`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Назад к турниру
          </Link>
        </Button>
      </div>

      {tournament.actions.length ? (
        <div className="grid gap-4 xl:grid-cols-2">
          {tournament.actions.map((action) => (
            <Card key={action.id} className="p-0">
              <CardContent className="space-y-3 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="font-medium text-white">{adminEntityLabel(action.entityType)}</div>
                  <Badge variant="neutral">{adminActionLabel[action.actionType] ?? action.actionType}</Badge>
                </div>
                <div className="text-sm text-zinc-400">{action.admin.nickname ?? action.admin.name ?? action.admin.email ?? "Администратор"}</div>
                <div className="text-sm text-zinc-500">{formatDate(action.createdAt)}</div>
                <AuditDiff before={action.beforeJson} after={action.afterJson} />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="p-5 text-sm text-zinc-500">История действий появится после первых изменений по турниру.</Card>
      )}
    </div>
  );
}
