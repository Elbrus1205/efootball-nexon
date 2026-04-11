import Link from "next/link";
import { UserRole } from "@prisma/client";
import { CalendarDays, ExternalLink, Settings2, Trophy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { matchStatusLabel, matchStatusVariant } from "@/lib/admin-display";
import { requireRole } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { getPlayerDisplayName } from "@/lib/player-name";
import { formatDate } from "@/lib/utils";

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
          <CardTitle>Матчи турниров</CardTitle>
          <CardDescription>Единый список матчей. Для любого матча открывается одна понятная страница управления.</CardDescription>
        </CardHeader>
      </Card>

      <div className="grid gap-4">
        {matches.length ? (
          matches.map((match) => {
            const player1Name = match.player1 ? getPlayerDisplayName(match.player1) : "Игрок 1";
            const player2Name = match.player2 ? getPlayerDisplayName(match.player2) : "Игрок 2";

            return (
              <Card key={match.id} className="p-4 sm:p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="truncate font-medium text-white">{match.tournament.title}</div>
                      <Badge variant={matchStatusVariant[match.status] ?? "neutral"}>{matchStatusLabel[match.status] ?? match.status}</Badge>
                      {match.stage ? <Badge>{match.stage.name}</Badge> : null}
                      {match.group ? <Badge variant="neutral">{match.group.name}</Badge> : null}
                    </div>
                    <div className="text-sm text-zinc-300">
                      {player1Name} <span className="text-zinc-500">vs</span> {player2Name}
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

                  <div className="grid gap-2 sm:flex sm:flex-wrap sm:justify-end">
                    <Button asChild className="w-full sm:w-auto">
                      <Link href={`/admin/matches/${match.id}`}>
                        <Settings2 className="mr-2 h-4 w-4" />
                        Управление матчем
                      </Link>
                    </Button>
                    <Button asChild variant="outline" className="w-full sm:w-auto">
                      <Link href={`/tournaments/${match.tournamentId}`}>
                        <ExternalLink className="mr-2 h-4 w-4" />
                        Страница турнира
                      </Link>
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })
        ) : (
          <Card className="p-5 text-sm text-zinc-500">После генерации стадий и расписания здесь появится полный список матчей.</Card>
        )}
      </div>
    </div>
  );
}
