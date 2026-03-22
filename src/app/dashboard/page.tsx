import Link from "next/link";
import { CalendarDays, ChevronRight, Trophy } from "lucide-react";
import { requireAuth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProfileForm } from "@/components/dashboard/profile-form";
import { formatDate } from "@/lib/utils";

export default async function DashboardPage() {
  const session = await requireAuth();
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    include: {
      tournamentEntries: {
        include: { tournament: true },
        orderBy: { createdAt: "desc" },
      },
      playerOneMatches: {
        include: { tournament: true, player2: true },
        where: { status: { in: ["READY", "PENDING"] } },
      },
      playerTwoMatches: {
        include: { tournament: true, player1: true },
        where: { status: { in: ["READY", "PENDING"] } },
      },
    },
  });

  if (!user) return null;

  const upcomingMatches = [...user.playerOneMatches, ...user.playerTwoMatches];

  return (
    <div className="page-shell space-y-8">
      <div className="space-y-3">
        <Badge variant="primary">Личный кабинет игрока</Badge>
        <h1 className="font-display text-3xl font-thin text-white">Профиль игрока {user.nickname || user.name || "eFootball Mobile"}.</h1>
        <p className="max-w-2xl text-zinc-400">
          В кабинете игрока собраны личные данные, ближайшие матчи и список турниров, в которых он участвует.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <ProfileForm
          initialValues={{
            nickname: user.nickname ?? "",
            efootballUid: user.efootballUid ?? "",
            favoriteTeam: user.favoriteTeam ?? "",
            image: user.image ?? "",
          }}
        />

        <Card>
          <CardHeader>
            <CardTitle>Предстоящие матчи</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {upcomingMatches.length ? (
              upcomingMatches.map((match) => {
                const opponent =
                  "player2" in match
                    ? match.player2
                    : "player1" in match
                      ? match.player1
                      : null;

                return (
                  <div key={match.id} className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm">
                    <div className="font-medium text-white">{match.tournament.title}</div>
                    <div className="mt-2 flex items-center gap-2 text-zinc-400">
                      <Trophy className="h-4 w-4 text-accent" />
                      <span>Соперник: {opponent?.nickname ?? opponent?.name ?? "Будет определён позже"}</span>
                    </div>
                    <div className="mt-2 flex items-center gap-2 text-zinc-400">
                      <CalendarDays className="h-4 w-4 text-primary" />
                      <span>{match.scheduledAt ? formatDate(match.scheduledAt) : "Дата и время будут назначены позже"}</span>
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-sm text-zinc-500">На данный момент у игрока нет назначенных матчей.</p>
            )}

            <Link href="/dashboard/matches" className="inline-flex items-center gap-2 text-sm text-primary transition hover:text-white">
              Открыть все матчи
              <ChevronRight className="h-4 w-4" />
            </Link>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Турниры игрока</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          {user.tournamentEntries.length ? (
            user.tournamentEntries.map((entry) => (
              <div key={entry.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="font-medium text-white">{entry.tournament.title}</div>
                <div className="mt-2 text-sm text-zinc-400">Дата старта: {formatDate(entry.tournament.startsAt)}</div>
              </div>
            ))
          ) : (
            <div className="rounded-2xl border border-dashed border-white/10 bg-black/10 p-4 text-sm text-zinc-500">
              Игрок пока не зарегистрирован ни в одном турнире.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
