import { notFound } from "next/navigation";
import { StageType, TournamentFormat, TournamentStatus } from "@prisma/client";
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
        include: { user: true, group: true },
        orderBy: { createdAt: "asc" },
      },
      matches: {
        include: { player1: true, player2: true, winner: true, stage: true, group: true, schedules: true },
        orderBy: [{ round: "asc" }, { matchNumber: "asc" }],
      },
      stages: {
        include: {
          groups: {
            include: {
              standings: {
                include: { participant: { include: { user: true } } },
                orderBy: { rank: "asc" },
              },
            },
            orderBy: { orderIndex: "asc" },
          },
          bracket: {
            include: {
              matches: {
                include: { player1: true, player2: true, winner: true },
                orderBy: [{ round: "asc" }, { matchNumber: "asc" }],
              },
            },
          },
        },
        orderBy: { orderIndex: "asc" },
      },
    },
  });

  if (!tournament) notFound();

  const canRegister =
    session?.user &&
    tournament.status === TournamentStatus.REGISTRATION_OPEN &&
    tournament.participants.length < tournament.maxParticipants &&
    !tournament.participants.some((entry) => entry.userId === session.user.id);

  const groupStage = tournament.stages.find((stage) => stage.type === StageType.GROUP_STAGE);
  const playoffStage = tournament.stages.find((stage) => stage.type === StageType.PLAYOFF);
  const leagueStage = tournament.stages.find((stage) => stage.type === StageType.LEAGUE);
  const bracketMatches = playoffStage?.bracket?.matches ?? tournament.matches.filter((match) => !match.groupId);
  const scheduledMatches = tournament.matches
    .filter((match) => match.scheduledAt || match.schedules.length)
    .sort((a, b) => new Date(a.scheduledAt ?? a.schedules[0]?.startsAt ?? 0).getTime() - new Date(b.scheduledAt ?? b.schedules[0]?.startsAt ?? 0).getTime());

  const simpleLeaderboard =
    tournament.format === TournamentFormat.ROUND_ROBIN || tournament.format === TournamentFormat.LEAGUE
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
            {tournament.playoffType ? <Badge variant="neutral">{tournament.playoffType}</Badge> : null}
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

      <Tabs defaultValue="structure">
        <TabsList>
          <TabsTrigger value="structure">Структура турнира</TabsTrigger>
          <TabsTrigger value="matches">Матчи</TabsTrigger>
          <TabsTrigger value="participants">Участники</TabsTrigger>
          <TabsTrigger value="rules">Правила</TabsTrigger>
        </TabsList>

        <TabsContent value="structure" className="space-y-6">
          {groupStage ? (
            <div className="space-y-4">
              <div className="text-sm uppercase tracking-[0.24em] text-zinc-500">Группы</div>
              <div className="grid gap-4 xl:grid-cols-2">
                {groupStage.groups.map((group) => (
                  <Card key={group.id} className="overflow-hidden p-0">
                    <div className="border-b border-white/10 px-5 py-4 font-medium text-white">{group.name}</div>
                    <table className="w-full text-left text-sm">
                      <thead className="bg-white/5 text-zinc-400">
                        <tr>
                          <th className="px-4 py-3">Игрок</th>
                          <th className="px-4 py-3">И</th>
                          <th className="px-4 py-3">О</th>
                          <th className="px-4 py-3">РМ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.standings.length ? (
                          group.standings.map((row) => (
                            <tr key={row.id} className="border-t border-white/10">
                              <td className="px-4 py-3">{row.participant.user.nickname ?? row.participant.user.name}</td>
                              <td className="px-4 py-3">{row.played}</td>
                              <td className="px-4 py-3">{row.points}</td>
                              <td className="px-4 py-3">{row.goalDifference}</td>
                            </tr>
                          ))
                        ) : (
                          <tr className="border-t border-white/10">
                            <td className="px-4 py-3 text-zinc-500" colSpan={4}>
                              Таблица заполнится после матчей группы.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </Card>
                ))}
              </div>
            </div>
          ) : null}

          {leagueStage ? (
            <Card className="overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-white/5 text-zinc-400">
                  <tr>
                    <th className="px-4 py-3">Игрок</th>
                    <th className="px-4 py-3">Очки</th>
                  </tr>
                </thead>
                <tbody>
                  {simpleLeaderboard.map((row) => (
                    <tr key={row.user.id} className="border-t border-white/10">
                      <td className="px-4 py-3">{row.user.nickname ?? row.user.name}</td>
                      <td className="px-4 py-3">{row.points}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          ) : null}

          {playoffStage ? <BracketView matches={bracketMatches} /> : null}
        </TabsContent>

        <TabsContent value="matches">
          <div className="grid gap-4">
            {scheduledMatches.length ? (
              scheduledMatches.map((match) => (
                <Card key={match.id} className="p-5">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <div className="font-medium text-white">
                        {match.player1?.nickname ?? match.player1?.name ?? "TBD"} vs {match.player2?.nickname ?? match.player2?.name ?? "TBD"}
                      </div>
                      <div className="mt-2 text-sm text-zinc-400">
                        {match.group?.name ?? match.stage?.name ?? `Раунд ${match.round}`} •{" "}
                        {formatDate(match.scheduledAt ?? match.schedules[0]?.startsAt ?? match.createdAt)}
                      </div>
                    </div>
                    <Badge variant="neutral">{match.status}</Badge>
                  </div>
                </Card>
              ))
            ) : (
              <Card className="p-6 text-zinc-500">После публикации расписания здесь появится календарь матчей турнира.</Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="participants">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {tournament.participants.map((entry) => (
              <Card key={entry.id} className="p-4">
                <div className="font-medium text-white">{entry.user.nickname ?? entry.user.name}</div>
                <div className="mt-2 text-sm text-zinc-500">UID: {entry.user.efootballUid ?? "Не заполнен"}</div>
                <div className="mt-1 text-sm text-zinc-500">{entry.group?.name ?? "Без группы"}</div>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="rules">
          <Card className="whitespace-pre-wrap p-6 text-zinc-300">{tournament.rules}</Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
