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

type LeagueRow = {
  id: string;
  name: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalDifference: number;
  points: number;
};

function getDisplayName(name: string | null | undefined, fallback: string) {
  return name?.trim() || fallback;
}

function buildLeagueTable(
  participants: Array<{
    userId: string;
    user: { id: string; nickname: string | null; name: string | null };
  }>,
  matches: Array<{
    player1Id: string | null;
    player2Id: string | null;
    player1Score: number | null;
    player2Score: number | null;
  }>,
) {
  const table = new Map<string, LeagueRow>();

  for (const entry of participants) {
    table.set(entry.userId, {
      id: entry.user.id,
      name: getDisplayName(entry.user.nickname, entry.user.name ?? "Игрок"),
      played: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      goalDifference: 0,
      points: 0,
    });
  }

  for (const match of matches) {
    if (!match.player1Id || !match.player2Id) continue;
    if (match.player1Score === null || match.player2Score === null) continue;

    const player1 = table.get(match.player1Id);
    const player2 = table.get(match.player2Id);
    if (!player1 || !player2) continue;

    player1.played += 1;
    player2.played += 1;
    player1.goalDifference += match.player1Score - match.player2Score;
    player2.goalDifference += match.player2Score - match.player1Score;

    if (match.player1Score > match.player2Score) {
      player1.wins += 1;
      player2.losses += 1;
      player1.points += 3;
    } else if (match.player1Score < match.player2Score) {
      player2.wins += 1;
      player1.losses += 1;
      player2.points += 3;
    } else {
      player1.draws += 1;
      player2.draws += 1;
      player1.points += 1;
      player2.points += 1;
    }
  }

  return Array.from(table.values()).sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
    if (b.wins !== a.wins) return b.wins - a.wins;
    return a.name.localeCompare(b.name, "ru");
  });
}

function rowHighlight(index: number) {
  if (index === 0) return "border-t border-primary/20 bg-primary/10";
  if (index === 1) return "border-t border-emerald-400/10 bg-emerald-400/5";
  if (index === 2) return "border-t border-amber-400/10 bg-amber-400/5";
  return "border-t border-white/10";
}

function rankBadge(index: number) {
  if (index === 0) return "inline-flex h-8 min-w-8 items-center justify-center rounded-full bg-primary/20 px-2 font-semibold text-primary";
  if (index === 1) return "inline-flex h-8 min-w-8 items-center justify-center rounded-full bg-emerald-400/15 px-2 font-semibold text-emerald-300";
  if (index === 2) return "inline-flex h-8 min-w-8 items-center justify-center rounded-full bg-amber-400/15 px-2 font-semibold text-amber-300";
  return "inline-flex h-8 min-w-8 items-center justify-center rounded-full bg-white/5 px-2 font-medium text-zinc-300";
}

function StickyHeader({ children, left = 0 }: { children: React.ReactNode; left?: number }) {
  return (
    <th
      className="sticky top-0 z-20 border-b border-white/10 bg-[linear-gradient(180deg,rgba(18,24,34,0.98),rgba(14,18,26,0.92))] px-4 py-3 text-xs uppercase tracking-[0.18em] text-zinc-300 backdrop-blur-xl"
      style={left ? { left } : undefined}
    >
      {children}
    </th>
  );
}

function StandingsTable({
  rows,
}: {
  rows: Array<{
    id: string;
    rank?: number | null;
    name: string;
    played: number;
    wins: number;
    draws: number;
    losses: number;
    goalDifference: number;
    points: number;
  }>;
}) {
  return (
    <div className="overflow-x-auto rounded-[1.5rem] border-t border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.02),rgba(255,255,255,0.01))]">
      <table className="w-full min-w-[760px] text-left text-sm">
        <thead>
          <tr>
            <StickyHeader left={0}>№</StickyHeader>
            <StickyHeader left={72}>Команда</StickyHeader>
            <StickyHeader>
              <div className="text-center">И</div>
            </StickyHeader>
            <StickyHeader>
              <div className="text-center">В</div>
            </StickyHeader>
            <StickyHeader>
              <div className="text-center">Н</div>
            </StickyHeader>
            <StickyHeader>
              <div className="text-center">П</div>
            </StickyHeader>
            <StickyHeader>
              <div className="text-center">+/-</div>
            </StickyHeader>
            <StickyHeader>
              <div className="text-center">Очки</div>
            </StickyHeader>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.id} className={rowHighlight(index)}>
              <td className="sticky left-0 z-10 px-4 py-3 text-zinc-300" style={{ background: "inherit" }}>
                <span className={rankBadge(index)}>{row.rank ?? index + 1}</span>
              </td>
              <td className="sticky left-[72px] z-10 px-4 py-3 font-medium text-white" style={{ background: "inherit" }}>
                {row.name}
              </td>
              <td className="px-4 py-3 text-center text-zinc-300">{row.played}</td>
              <td className="px-4 py-3 text-center text-zinc-300">{row.wins}</td>
              <td className="px-4 py-3 text-center text-zinc-300">{row.draws}</td>
              <td className="px-4 py-3 text-center text-zinc-300">{row.losses}</td>
              <td
                className={
                  row.goalDifference > 0
                    ? "px-4 py-3 text-center font-medium text-emerald-300"
                    : row.goalDifference < 0
                      ? "px-4 py-3 text-center font-medium text-red-300"
                      : "px-4 py-3 text-center font-medium text-zinc-300"
                }
              >
                {row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference}
              </td>
              <td className="px-4 py-3 text-center font-semibold text-white">{row.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

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

  const leagueMatches = leagueStage
    ? tournament.matches.filter((match) => match.stageId === leagueStage.id)
    : tournament.matches.filter((match) => !match.groupId && !match.bracketId);

  const leagueTable =
    tournament.format === TournamentFormat.ROUND_ROBIN || tournament.format === TournamentFormat.LEAGUE
      ? buildLeagueTable(tournament.participants, leagueMatches)
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
            <span>
              Участники: {tournament.participants.length}/{tournament.maxParticipants}
            </span>
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
              <div className="grid gap-4">
                {groupStage.groups.map((group) => (
                  <Card key={group.id} className="overflow-hidden p-0">
                    <div className="border-b border-white/10 px-5 py-4 font-medium text-white">{group.name}</div>
                    {group.standings.length ? (
                      <StandingsTable
                        rows={group.standings.map((row) => ({
                          id: row.id,
                          rank: row.rank,
                          name: getDisplayName(row.participant.user.nickname, row.participant.user.name ?? "Игрок"),
                          played: row.played,
                          wins: row.wins,
                          draws: row.draws,
                          losses: row.losses,
                          goalDifference: row.goalDifference,
                          points: row.points,
                        }))}
                      />
                    ) : (
                      <div className="px-4 py-4 text-sm text-zinc-500">Таблица заполнится после матчей группы.</div>
                    )}
                  </Card>
                ))}
              </div>
            </div>
          ) : null}

          {leagueStage || tournament.format === TournamentFormat.ROUND_ROBIN ? (
            <Card className="overflow-hidden p-0">
              <div className="border-b border-white/10 px-5 py-4 font-medium text-white">Таблица лиги</div>
              {leagueTable.length ? (
                <StandingsTable rows={leagueTable} />
              ) : (
                <div className="px-4 py-4 text-sm text-zinc-500">Таблица лиги заполнится после первых сыгранных матчей.</div>
              )}
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
                        {match.group?.name ?? match.stage?.name ?? `Раунд ${match.round}`} • {formatDate(match.scheduledAt ?? match.schedules[0]?.startsAt ?? match.createdAt)}
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
