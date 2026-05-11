import { UserRole } from "@prisma/client";
import { requireRole } from "@/lib/auth/session";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TournamentBuilderForm } from "@/components/admin/tournament-builder-form";

export default async function AdminTournamentBuilderPage({
  searchParams,
}: {
  searchParams?: { error?: string };
}) {
  await requireRole([UserRole.FOUNDER]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="primary">Конструктор турнира</Badge>
            <Badge variant="neutral">Только для администратора</Badge>
          </div>
          <CardTitle>Создание нового турнира</CardTitle>
          <CardDescription>Пошаговая форма для лиги, групп, плей-офф и комбинированных сценариев.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4 text-sm leading-6 text-zinc-300">
            Турнир собирается в одном месте: формат, структура, участники, клубы, матчи, расписание и автоматизация.
          </div>
        </CardContent>
      </Card>

      {searchParams?.error ? (
        <Card className="border-danger/30 bg-danger/10">
          <CardContent className="p-5 text-sm text-red-100">{searchParams.error}</CardContent>
        </Card>
      ) : null}

      <TournamentBuilderForm action="/api/admin/tournaments" submitLabel="Создать турнир" secondaryLabel="Сохранить как черновик" />
    </div>
  );
}
