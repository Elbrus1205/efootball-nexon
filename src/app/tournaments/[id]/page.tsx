import { notFound } from "next/navigation";
import { TournamentFormat, TournamentStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { getCurrentSession } from "@/lib/auth/session";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BracketView } from "@/components/tournaments/bracket-view";
import { formatDate } from "@/lib/utils";

export async function generateMetadata({ params }: { params: { id: string } }) {
  const tournament = await db.tournament.findUnique({ where: { id: params.id } });
  return tournament ? { title: tournament.title, description: tournament.description } : { title: "Турнир не найден" };
}

export default async function TournamentDetailsPage({ params }: { params: { id: string } }) {
  const session = await getCurrentSession();
  const tournament = await db.tournament.findUnique({
    where: { id: params.id },
    include: {
      participants: {
        include: { user: true },
        orderBy: { createdAt: "asc" },
      },
      matches: {
        include: { player1: true, player2: true, winner: true },
        orderBy: [{ round: "asc" }, { matchNumber: "asc" }],
      },
    },
  });

  if (!tournament) notFound();

  const canRegister =
    session?.user &&
    tournament.status === TournamentStatus.REGISTRATION_OPEN &&
    tournament.participants.length < tournament.maxParticipants &&
    !tournament.participants.some((entry) => entry.userId === session.user.id);

  const leaderboard =
    tournament.format === TournamentFormat.ROUND_ROBIN
      ? tournament.participants.map((entry) => ({
          user: entry.user,
          points: tournament.matches.filter((match) => match.winnerId === entry.userId).length * 3,
        }))
      : [];

  return (
    <div className="page-shell space-y-8">
      <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <Badge variant="primary">{tournament.status}</Badge>
            <Badge variant="accent">{tournament.format}</Badge>
          </div>
          <h1 className="font-display text-4xl font-thin text-white">{tournament.title}</h1>
          <p className="max-w-3xl text-zinc-400">{tournament.description}</p>
          <div className="flex flex-wrap gap-6 text-sm text-zinc-400">
            <span>Старт: {formatDate(tournament.startsAt)}</span>
            <span>Регистрация до: {formatDate(tournament.registrationEndsAt)}</span>
            <span>Участники: {tournament.participants.length}/{tournament.maxParticipants}</span>
          </div>
        </div>
        {canRegister ? (
          <form action={`/api/tournaments/${tournament.id}/register`} method="post">
            <Button size="lg">Зарегистрироваться</Button>
          </form>
        ) : (
          <Button size="lg" disabled>
            {tournament.participants.length >= tournament.maxParticipants ? "Лимит достигнут" : "Регистрация недоступна"}
          </Button>
        )}
      </div>

      <Tabs defaultValue="bracket">
        <TabsList>
          <TabsTrigger value="bracket">Сетка / Таблица</TabsTrigger>
          <TabsTrigger value="participants">Участники</TabsTrigger>
          <TabsTrigger value="rules">Правила</TabsTrigger>
          <TabsTrigger value="chat">Чат</TabsTrigger>
        </TabsList>
        <TabsContent value="bracket">
          {tournament.format === TournamentFormat.ROUND_ROBIN ? (
            <Card className="overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-white/5 text-zinc-400">
                  <tr>
                    <th className="px-4 py-3">Игрок</th>
                    <th className="px-4 py-3">Очки</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.map((row) => (
                    <tr key={row.user.id} className="border-t border-white/10">
                      <td className="px-4 py-3">{row.user.nickname ?? row.user.name}</td>
                      <td className="px-4 py-3">{row.points}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          ) : (
            <BracketView matches={tournament.matches} />
          )}
        </TabsContent>
        <TabsContent value="participants">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {tournament.participants.map((entry) => (
              <Card key={entry.id} className="p-4">
                <div className="font-medium text-white">{entry.user.nickname ?? entry.user.name}</div>
                <div className="mt-2 text-sm text-zinc-500">UID: {entry.user.efootballUid ?? "Не заполнен"}</div>
              </Card>
            ))}
          </div>
        </TabsContent>
        <TabsContent value="rules">
          <Card className="whitespace-pre-wrap p-6 text-zinc-300">{tournament.rules}</Card>
        </TabsContent>
        <TabsContent value="chat">
          <Card className="p-6 text-zinc-400">
            Чат оставлен как опциональный модуль. Здесь можно подключить комментарии, Pusher chat или внешний сервис.
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
