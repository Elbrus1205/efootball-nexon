import { UserRole } from "@prisma/client";
import { Blocks, CalendarDays, GitBranch, Settings2, Users } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TournamentBuilderForm } from "@/components/admin/tournament-builder-form";

const steps = [
  {
    icon: Blocks,
    title: "1. Базовая информация",
    description: "Название, статус, даты, лимит участников, правила, обложка и общая подача турнира.",
  },
  {
    icon: GitBranch,
    title: "2. Формат и структура",
    description: "Лига, группы, плей-офф или комбинированный формат с автоматикой и ручным контролем.",
  },
  {
    icon: Users,
    title: "3. Участники и посев",
    description: "Подтверждение участия, ручной и автоматический посев, распределение по группам.",
  },
  {
    icon: CalendarDays,
    title: "4. Матчи и календарь",
    description: "Автогенерация матчей, расписание туров и логика переходов между этапами.",
  },
  {
    icon: Settings2,
    title: "5. Публикация и автоматизация",
    description: "Автопереходы, матчи, расписание, контроль плей-офф и запуск турнира.",
  },
];

export default async function AdminTournamentBuilderPage({
  searchParams,
}: {
  searchParams?: { error?: string };
}) {
  await requireRole([UserRole.ADMIN]);

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

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {steps.map((step) => (
          <Card key={step.title}>
            <CardHeader>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <step.icon className="h-5 w-5" />
              </div>
              <CardTitle className="mt-3">{step.title}</CardTitle>
              <CardDescription>{step.description}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>

      <TournamentBuilderForm action="/api/admin/tournaments" submitLabel="Создать турнир" secondaryLabel="Сохранить как черновик" />
    </div>
  );
}
