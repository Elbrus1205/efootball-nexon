import { UserRole } from "@prisma/client";
import { CalendarDays, Clock3, Trophy } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import { ScheduleCalendar } from "@/components/admin/schedule-calendar";

export default async function AdminSchedulePage() {
  await requireRole([UserRole.ADMIN, UserRole.MODERATOR]);

  const schedules = await db.matchSchedule.findMany({
    include: {
      match: {
        include: {
          tournament: true,
          player1: true,
          player2: true,
        },
      },
    },
    orderBy: { startsAt: "asc" },
    take: 18,
  });

  const grouped = schedules.reduce<Record<string, typeof schedules>>((acc, item) => {
    const key = formatDate(item.startsAt, "d MMMM");
    acc[key] ??= [];
    acc[key].push(item);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-primary" />
              Игровые дни
            </CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold text-white">{Object.keys(grouped).length}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock3 className="h-5 w-5 text-primary" />
              Слоты в календаре
            </CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold text-white">{schedules.length}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-accent" />
              Ближайший матч
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-zinc-400">
            {schedules[0] ? `${schedules[0].match.tournament.title} • ${formatDate(schedules[0].startsAt)}` : "Сетка расписания пока не создана."}
          </CardContent>
        </Card>
      </div>

      {Object.keys(grouped).length ? (
        <ScheduleCalendar groups={Object.fromEntries(Object.entries(grouped).map(([key, value]) => [key, value.map((item) => ({ ...item, startsAt: item.startsAt.toISOString(), endsAt: item.endsAt?.toISOString() ?? null }))]))} />
      ) : (
        <Card className="p-5 text-sm text-zinc-500">После генерации расписания здесь появится календарный board по дням и матчевым слотам.</Card>
      )}
    </div>
  );
}
