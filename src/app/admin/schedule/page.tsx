import { UserRole } from "@prisma/client";
import { CalendarDays, Clock3, Trophy } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";

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
    take: 12,
  });

  const grouped = schedules.reduce<Record<string, typeof schedules>>((acc, item) => {
    const key = formatDate(item.startsAt, "d MMMM");
    acc[key] ??= [];
    acc[key].push(item);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Расписание матчей</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-zinc-400">Календарный блок для ближайших игровых дней, турнирных слотов и мобильного контроля времени матчей.</p>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        {Object.keys(grouped).length ? (
          Object.entries(grouped).map(([day, items]) => (
            <Card key={day}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CalendarDays className="h-5 w-5 text-primary" />
                  {day}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {items.map((schedule) => (
                  <div key={schedule.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <div className="font-medium text-white">{schedule.match.tournament.title}</div>
                    <div className="mt-2 text-sm text-zinc-300">
                      {(schedule.match.player1?.nickname ?? schedule.match.player1?.name ?? "TBD")} vs{" "}
                      {(schedule.match.player2?.nickname ?? schedule.match.player2?.name ?? "TBD")}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-4 text-sm text-zinc-500">
                      <span className="inline-flex items-center gap-2">
                        <Clock3 className="h-4 w-4 text-primary" />
                        {formatDate(schedule.startsAt)}
                      </span>
                      <span className="inline-flex items-center gap-2">
                        <Trophy className="h-4 w-4 text-accent" />
                        {schedule.slotLabel ?? "Стандартный слот"}
                      </span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))
        ) : (
          <Card className="p-5 text-sm text-zinc-500">После генерации расписания здесь появится календарь матчей по дням.</Card>
        )}
      </div>
    </div>
  );
}
