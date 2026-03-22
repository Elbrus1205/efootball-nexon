import Link from "next/link";
import { MatchStatus, UserRole } from "@prisma/client";
import { CalendarDays, Trophy } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";

const statusVariant: Record<MatchStatus, "primary" | "accent" | "neutral" | "success" | "danger"> = {
  PENDING: "neutral",
  READY: "primary",
  RESULT_SUBMITTED: "accent",
  CONFIRMED: "success",
  REJECTED: "danger",
  FORFEIT: "danger",
  SCHEDULED: "primary",
  LIVE: "accent",
  DISPUTED: "danger",
  FINISHED: "success",
};

export default async function AdminMatchesPage() {
  await requireRole([UserRole.ADMIN, UserRole.MODERATOR]);

  const matches = await db.match.findMany({
    include: {
      tournament: true,
      stage: true,
      group: true,
      player1: true,
      player2: true,
    },
    orderBy: [{ scheduledAt: "asc" }, { createdAt: "desc" }],
    take: 20,
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Все матчи турниров</CardTitle>
          <CardDescription>Единый операционный список по стадиям, группам, статусам и ближайшим слотам.</CardDescription>
        </CardHeader>
      </Card>

      <div className="grid gap-4">
        {matches.length ? (
          matches.map((match) => (
            <Card key={match.id} className="p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="font-medium text-white">{match.tournament.title}</div>
                    <Badge variant={statusVariant[match.status]}>{match.status}</Badge>
                    {match.stage ? <Badge>{match.stage.name}</Badge> : null}
                    {match.group ? <Badge variant="neutral">{match.group.name}</Badge> : null}
                  </div>
                  <div className="text-sm text-zinc-300">
                    {(match.player1?.nickname ?? match.player1?.name ?? "TBD")} vs {(match.player2?.nickname ?? match.player2?.name ?? "TBD")}
                  </div>
                  <div className="flex flex-wrap gap-4 text-sm text-zinc-500">
                    <span className="inline-flex items-center gap-2">
                      <CalendarDays className="h-4 w-4 text-primary" />
                      {match.scheduledAt ? formatDate(match.scheduledAt) : "Дата не назначена"}
                    </span>
                    <span className="inline-flex items-center gap-2">
                      <Trophy className="h-4 w-4 text-accent" />
                      Раунд {match.round} • Матч {match.matchNumber}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Link
                    href={`/tournaments/${match.tournamentId}`}
                    className="inline-flex min-h-11 items-center rounded-xl border border-white/10 px-4 text-sm text-zinc-300 transition hover:bg-white/5 hover:text-white"
                  >
                    Страница турнира
                  </Link>
                  <button className="inline-flex min-h-11 items-center rounded-xl bg-primary px-4 text-sm text-white">
                    Изменить матч
                  </button>
                  <button className="inline-flex min-h-11 items-center rounded-xl border border-white/10 px-4 text-sm text-zinc-300">
                    Поставить результат
                  </button>
                </div>
              </div>
            </Card>
          ))
        ) : (
          <Card className="p-5 text-sm text-zinc-500">После генерации стадий и календаря здесь появится полный реестр матчей.</Card>
        )}
      </div>
    </div>
  );
}
