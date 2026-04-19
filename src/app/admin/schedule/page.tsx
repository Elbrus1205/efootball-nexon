import { UserRole } from "@prisma/client";
import { CalendarDays, Clock3, Trophy } from "lucide-react";
import { ScheduleCalendar } from "@/components/admin/schedule-calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/utils";

export default async function AdminSchedulePage() {
  await requireRole([UserRole.ADMIN, UserRole.MODERATOR, UserRole.HEAD_JUDGE, UserRole.JUDGE]);

  const schedules = await db.matchSchedule.findMany({
    include: {
      match: {
        include: {
          tournament: true,
          player1: true,
          player2: true,
          stage: {
            include: {
              deadlines: true,
            },
          },
        },
      },
    },
    orderBy: { startsAt: "asc" },
    take: 24,
  });

  const grouped = schedules.reduce<Record<string, typeof schedules>>((acc, item) => {
    const key = item.startsAt.toISOString().slice(0, 10);
    acc[key] ??= [];
    acc[key].push(item);
    return acc;
  }, {});

  const days = Object.entries(grouped).map(([key, value]) => ({
    key,
    label: formatDate(new Date(`${key}T00:00:00`), "d MMMM"),
    items: value
      .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
      .map((item) => {
        const deadline = item.match.stage?.deadlines.find((entry) => entry.round === item.match.round)?.deadlineAt ?? null;

        return {
          id: item.id,
          startsAt: item.startsAt.toISOString(),
          endsAt: item.endsAt?.toISOString() ?? null,
          slotLabel: item.slotLabel,
          timezone: item.timezone,
          match: {
            id: item.match.id,
            round: item.match.round,
            deadlineAt: deadline?.toISOString() ?? null,
            tournament: {
              title: item.match.tournament.title,
            },
            player1: item.match.player1
              ? {
                  nickname: item.match.player1.nickname,
                  name: item.match.player1.name,
                }
              : null,
            player2: item.match.player2
              ? {
                  nickname: item.match.player2.nickname,
                  name: item.match.player2.name,
                }
              : null,
          },
        };
      }),
  }));

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
          <CardContent className="text-3xl font-semibold text-white">{days.length}</CardContent>
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
            {schedules[0] ? `${schedules[0].match.tournament.title} • ${formatDate(schedules[0].startsAt)}` : "Календарь появится после генерации расписания."}
          </CardContent>
        </Card>
      </div>

      {days.length ? <ScheduleCalendar days={days} /> : <Card className="p-5 text-sm text-zinc-500">После генерации расписания здесь появится drag-and-drop board по дням и слотам.</Card>}
    </div>
  );
}
