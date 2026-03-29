import { ClubSelectionMode, StageType, TournamentFormat, TournamentStatus } from "@prisma/client";
import { notFound } from "next/navigation";
import { BracketView } from "@/components/tournaments/bracket-view";
import { ClubPlayerLine } from "@/components/tournaments/club-player-line";
import { MyMatchCard } from "@/components/tournaments/my-match-card";
import { RegisterTournamentButton } from "@/components/tournaments/register-tournament-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getCurrentSession } from "@/lib/auth/session";
import { getAvailableClubs } from "@/lib/clubs";
import {
  matchStatusLabel,
  matchStatusVariant,
  playoffTypeLabel,
  tournamentFormatLabel,
  tournamentStatusLabel,
  tournamentStatusVariant,
} from "@/lib/admin-display";
import { db } from "@/lib/db";
import { getPlayerDisplayName } from "@/lib/player-name";
import { formatDate } from "@/lib/utils";

type LeagueRow = {
  id: string;
  rank?: number | null;
  clubName: string;
  clubBadgePath?: string | null;
  playerId?: string | null;
  playerName: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalDifference: number;
  points: number;
};

function scheduleStageLabel(match: {
  round: number;
  group?: { name: string } | null;
  stage?: { name: string | null; type?: StageType | null } | null;
}) {
  if (match.group?.name) return match.group.name;

  if (match.stage?.type === StageType.PLAYOFF) return "Плей-офф";
  if (match.stage?.type === StageType.GROUP_STAGE) return "Групповой этап";
  if (match.stage?.type === StageType.LEAGUE) return "Лига";

  if (match.stage?.name?.trim()) return match.stage.name;

  return `Раунд ${match.round}`;
}

function buildLeagueTable(
  participants: Array<{
    userId: string;
    clubName: string | null;
    clubBadgePath: string | null;
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
    const playerName = getPlayerDisplayName(entry.user);
    table.set(entry.userId, {
      id: entry.user.id,
      playerId: entry.user.id,
      playerName,
      clubName: entry.clubName?.trim() || playerName,
      clubBadgePath: entry.clubBadgePath,
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
    return a.clubName.localeCompare(b.clubName, "ru");
  });
}

function rowHighlight(index: number) {
  if (index === 0) return "border-t border-primary/20 bg-primary/10";
  if (index === 1) return "border-t border-emerald-400/10 bg-emerald-400/5";
  if (index === 2) return "border-t border-amber-400/10 bg-amber-400/5";
  return "border-t border-white/10";
}

function rankBadge(index: number) {
  if (index === 0) return "inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary/20 px-1 text-[10px] font-semibold text-primary";
  if (index === 1) return "inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-400/15 px-1 text-[10px] font-semibold text-emerald-300";
  if (index === 2) return "inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-400/15 px-1 text-[10px] font-semibold text-amber-300";
  return "inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-white/5 px-1 text-[10px] font-medium text-zinc-300";
}

function getSubmissionState({
  matchStatus,
  latestSubmission,
}: {
  matchStatus: string;
  latestSubmission?: {
    status: string;
    moderatorComment: string | null;
  };
}) {
  if (matchStatus === "DISPUTED") return { label: "Матч в споре", tone: "danger" as const };
  if (matchStatus === "CONFIRMED") return { label: "Счёт подтверждён", tone: "success" as const };
  if (!latestSubmission) return { label: "Ожидается результат", tone: "waiting" as const };
  if (latestSubmission.status === "PENDING") return { label: "Результат отправлен", tone: "success" as const };
  if (latestSubmission.status === "REJECTED" && latestSubmission.moderatorComment === "AUTO_MISMATCH") {
    return { label: "Введите счёт заново", tone: "retry" as const };
  }
  if (latestSubmission.status === "DISPUTED") return { label: "Матч в споре", tone: "danger" as const };
  return { label: "Ожидается результат", tone: "waiting" as const };
}

function StickyHeader({ children }: { children: React.ReactNode }) {
  return (
    <th className="sticky top-0 z-20 border-b border-white/10 bg-[linear-gradient(180deg,rgba(18,24,34,0.98),rgba(14,18,26,0.92))] px-4 py-3 text-xs uppercase tracking-[0.18em] text-zinc-300 backdrop-blur-xl">
      {children}
    </th>
  );
}

function StandingsTable({ rows }: { rows: LeagueRow[] }) {
  return (
    <div className="overflow-x-auto rounded-[1.5rem] border-t border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.02),rgba(255,255,255,0.01))] [&_td:nth-child(1)]:w-5 [&_td:nth-child(1)]:px-0 [&_td:nth-child(1)]:text-center [&_td:nth-child(2)]:w-[1%] [&_td:nth-child(2)]:whitespace-nowrap [&_td:nth-child(2)]:pl-2 [&_td:nth-child(2)]:pr-[15px] [&_td:nth-child(n+3)]:w-7 [&_td:nth-child(n+3)]:px-1 [&_th:nth-child(1)]:w-5 [&_th:nth-child(1)]:px-0 [&_th:nth-child(2)]:w-[1%] [&_th:nth-child(2)]:whitespace-nowrap [&_th:nth-child(2)]:pl-2 [&_th:nth-child(2)]:pr-[15px] [&_th:nth-child(n+3)]:w-7 [&_th:nth-child(n+3)]:px-1">
      <table className="w-max min-w-[560px] table-auto text-left text-sm">
        <thead>
          <tr>
            <StickyHeader>
              <div className="flex justify-center">№</div>
            </StickyHeader>
            <StickyHeader>Команда</StickyHeader>
            <StickyHeader>
              <div className="text-center">Очки</div>
            </StickyHeader>
            <StickyHeader>
              <div className="text-center">Очки</div>
            </StickyHeader>
            <StickyHeader>
              <div className="text-center">Очки</div>
            </StickyHeader>
            <StickyHeader>
              <div className="text-center">Очки</div>
            </StickyHeader>
            <StickyHeader>
              <div className="text-center">Очки</div>
            </StickyHeader>
            <StickyHeader>
              <div className="text-center">Очки</div>
            </StickyHeader>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.id} className={rowHighlight(index)}>
              <td className="w-5 px-0 py-3 text-zinc-300">
                <span className={rankBadge(index)}>{row.rank ?? index + 1}</span>
              </td>
              <td className="px-3 py-3">
                <ClubPlayerLine
                  clubName={row.clubName}
                  badgePath={row.clubBadgePath}
                  playerId={row.playerId}
                  playerName={row.playerName}
                  compact
                />
              </td>
              <td className="px-1 py-3 text-center text-zinc-300">{row.played}</td>
              <td className="px-1 py-3 text-center text-zinc-300">{row.wins}</td>
              <td className="px-1 py-3 text-center text-zinc-300">{row.draws}</td>
              <td className="px-1 py-3 text-center text-zinc-300">{row.losses}</td>
              <td className={row.goalDifference > 0 ? "Матч переведён в спор. Теперь результат выставляет администрация." : "Оба игрока должны ввести один и тот же счёт. Если результаты не совпадут три раза, матч уйдёт в спор."
                    }>
                {row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference}
              </td>
              <td className="px-1 py-3 text-center font-semibold text-white">{row.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export async function generateMetadata({ params }: { params: { id: string } }) {
  const tournament = await db.tournament.findUnique({ where: { id: params.id } });
  return tournament ? { title: tournament.title, description: tournament.description } : { title: "Счёт ещё не подтверждён"
                    };
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
        include: {
          player1: true,
          player2: true,
          winner: true,
          stage: true,
          group: true,
          schedules: true,
          submissions: { orderBy: { createdAt: "desc" } },
        },
        orderBy: [{ round: "asc" }, { matchNumber: "asc" }],
      },
      stages: {
        include: {
          groups: {
            include: {
              standings: {
                include: {
                  participant: {
                    include: { user: true },
                  },
                },
                orderBy: { rank: "asc" },
              },
            },
            orderBy: { orderIndex: "asc" },
          },
          bracket: {
            include: {
              matches: {
                include: {
                  player1: true,
                  player2: true,
                  winner: true,
                  participant1Entry: true,
                  participant2Entry: true,
                },
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
    !!session?.user &&
    tournament.status === TournamentStatus.REGISTRATION_OPEN &&
    tournament.participants.length < tournament.maxParticipants &&
    !tournament.participants.some((entry) => entry.userId === session.user.id);

  const groupStage = tournament.stages.find((stage) => stage.type === StageType.GROUP_STAGE);
  const playoffStage = tournament.stages.find((stage) => stage.type === StageType.PLAYOFF);
  const leagueStage = tournament.stages.find((stage) => stage.type === StageType.LEAGUE);
  const bracketMatches = playoffStage?.bracket?.matches ?? [];

  const scheduledMatches = tournament.matches
    .filter((match) => match.scheduledAt || match.schedules.length)
    .sort(
      (a, b) =>
        new Date(a.scheduledAt ?? a.schedules[0]?.startsAt ?? 0).getTime() -
        new Date(b.scheduledAt ?? b.schedules[0]?.startsAt ?? 0).getTime(),
    );

  const myMatches = session?.user
    ? scheduledMatches.filter((match) => match.player1Id === session.user.id || match.player2Id === session.user.id)
    : [];

  const leagueMatches = leagueStage
    ? tournament.matches.filter((match) => match.stageId === leagueStage.id)
    : tournament.matches.filter((match) => !match.groupId && !match.bracketId);

  const leagueTable =
    tournament.format === TournamentFormat.ROUND_ROBIN || tournament.format === TournamentFormat.LEAGUE
      ? buildLeagueTable(tournament.participants, leagueMatches)
      : [];

  const availableClubs = await getAvailableClubs();
  const takenClubSlugs = tournament.participants.map((entry) => entry.clubSlug).filter(Boolean) as string[];
  const participantClubMap = Object.fromEntries(
    tournament.participants.map((entry) => [
      entry.userId,
      {
        clubName: entry.clubName,
        clubBadgePath: entry.clubBadgePath,
      },
    ]),
  );

  return (
    <div className="page-shell space-y-8">
      <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <Badge variant={tournamentStatusVariant[tournament.status]}>{tournamentStatusLabel[tournament.status]}</Badge>
            <Badge variant="accent">{tournamentFormatLabel[tournament.format] ?? tournament.format}</Badge>
            {tournament.playoffType ? <Badge variant="neutral">{playoffTypeLabel[tournament.playoffType] ?? tournament.playoffType}</Badge> : null}
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
          <RegisterTournamentButton
            tournamentId={tournament.id}
            clubSelectionMode={tournament.clubSelectionMode ?? ClubSelectionMode.ADMIN_RANDOM}
            clubs={availableClubs}
            takenClubSlugs={takenClubSlugs}
          />
        ) : tournament.status === TournamentStatus.REGISTRATION_OPEN ? (
          <Button size="lg" disabled>
            {tournament.participants.length >= tournament.maxParticipants ? "Матч переведён в спор. Теперь результат выставляет администрация." : "Оба игрока должны ввести один и тот же счёт. Если результаты не совпадут три раза, матч уйдёт в спор."
                    }
          </Button>
        ) : null}
      </div>

      <Tabs defaultValue="structure">
        <div className="max-w-full overflow-x-auto px-1 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <TabsList className="inline-flex min-w-max flex-nowrap">
            <TabsTrigger className="shrink-0 whitespace-nowrap" value="structure">Структура турнира</TabsTrigger>
            <TabsTrigger className="shrink-0 whitespace-nowrap" value="matches">Расписание</TabsTrigger>
            <TabsTrigger className="shrink-0 whitespace-nowrap" value="my-matches">Мои матчи</TabsTrigger>
            <TabsTrigger className="shrink-0 whitespace-nowrap" value="participants">Участники</TabsTrigger>
            <TabsTrigger className="shrink-0 whitespace-nowrap" value="rules">Правила</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="structure" className="space-y-6">
          {groupStage ? (
            <div className="space-y-4">
              <div className="text-sm uppercase tracking-[0.24em] text-zinc-500">Группы</div>
              <div className="grid gap-4">
                {groupStage.groups.map((group) => (
                  <Card key={group.id} className="mx-auto w-fit max-w-full overflow-hidden p-0">
                    <div className="border-b border-white/10 px-5 py-4 font-medium text-white">Таблица лиги</div>
                    {group.standings.length ? (
                      <StandingsTable
                        rows={group.standings.map((row) => ({
                          id: row.id,
                          rank: row.rank,
                          clubName: row.participant.clubName?.trim() || getPlayerDisplayName(row.participant.user),
                          clubBadgePath: row.participant.clubBadgePath,
                          playerId: row.participant.user.id,
                          playerName: getPlayerDisplayName(row.participant.user),
                          played: row.played,
                          wins: row.wins,
                          draws: row.draws,
                          losses: row.losses,
                          goalDifference: row.goalDifference,
                          points: row.points,
                        }))}
                      />
                    ) : (
                      <div className="px-4 py-4 text-sm text-zinc-500">Таблица лиги заполнится после первых сыгранных матчей.</div>
                    )}
                  </Card>
                ))}
              </div>
            </div>
          ) : null}

          {leagueStage || tournament.format === TournamentFormat.ROUND_ROBIN ? (
            <Card className="mx-auto w-fit max-w-full overflow-hidden p-0">
              <div className="border-b border-white/10 px-5 py-4 font-medium text-white">Таблица лиги</div>
              {leagueTable.length ? (
                <StandingsTable rows={leagueTable} />
              ) : (
                <div className="px-4 py-4 text-sm text-zinc-500">Таблица лиги заполнится после первых сыгранных матчей.</div>
              )}
            </Card>
          ) : null}

          {playoffStage ? <BracketView matches={bracketMatches} clubsByUserId={participantClubMap} /> : null}
        </TabsContent>

        <TabsContent value="matches">
          <div className="grid gap-4">
            {scheduledMatches.length ? (
              scheduledMatches.map((match) => (
                <Card key={match.id} className="p-5">
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col items-center gap-2 text-center">
                      <div className="text-sm text-zinc-400">
                        {scheduleStageLabel(match)} • {formatDate(match.scheduledAt ?? match.schedules[0]?.startsAt ?? match.createdAt)}
                      </div>
                    </div>

                    <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-3 sm:p-5">
                      <div className="mx-auto grid max-w-[760px] grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 sm:grid-cols-[minmax(180px,220px)_auto_minmax(180px,220px)] sm:gap-4">
                        <div className="min-w-0 justify-self-end">
                          <ClubPlayerLine
                            playerId={match.player1?.id}
                            playerName={match.player1 ? getPlayerDisplayName(match.player1) : "Игрок 1"}
                            clubName={match.player1Id ? participantClubMap[match.player1Id]?.clubName : null}
                            badgePath={match.player1Id ? participantClubMap[match.player1Id]?.clubBadgePath : null}
                            align="center"
                            compact
                            reverse
                          />
                        </div>
                        <div className="flex shrink-0 items-center justify-center self-center">
                          <div className="flex min-w-[56px] items-center justify-center text-center text-xs font-semibold tracking-[0.24em] text-zinc-300 sm:min-w-[72px] sm:text-sm">
                            {match.player1Score !== null && match.player2Score !== null ? `${match.player1Score} - ${match.player2Score}` : "VS"}
                          </div>
                        </div>
                        <div className="min-w-0 justify-self-start">
                          <ClubPlayerLine
                            playerId={match.player2?.id}
                            playerName={match.player2 ? getPlayerDisplayName(match.player2) : "Игрок 2"}
                            clubName={match.player2Id ? participantClubMap[match.player2Id]?.clubName : null}
                            badgePath={match.player2Id ? participantClubMap[match.player2Id]?.clubBadgePath : null}
                            align="center"
                            compact
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              ))
            ) : (
              <Card className="p-6 text-zinc-500">После публикации расписания здесь появится календарь всех матчей турнира.</Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="my-matches">
          <div className="grid gap-4">
            {!session?.user ? (
              <Card className="p-6 text-zinc-500">Здесь появятся матчи текущего участника после публикации расписания.</Card>
            ) : myMatches.length ? (
              myMatches.map((match) => {
                const player1LatestSubmission = match.submissions.find((submission) => submission.submittedById === match.player1Id);
                const player2LatestSubmission = match.submissions.find((submission) => submission.submittedById === match.player2Id);

                return (
                  <MyMatchCard
                    key={match.id}
                    id={match.id}
                    title="Личный матч"
                    meta={`${scheduleStageLabel(match)} • ${formatDate(match.scheduledAt ?? match.schedules[0]?.startsAt ?? match.createdAt)}`}
                    statusLabel={matchStatusLabel[match.status] ?? match.status}
                    statusVariant={matchStatusVariant[match.status] ?? "neutral"}
                    scoreText={
                      match.player1Score !== null && match.player2Score !== null
                        ? `Подтверждённый счёт: ${match.player1Score} : ${match.player2Score}`
                        : "Счёт ещё не подтверждён"
                    }
                    confirmedPlayer1Score={match.player1Score}
                    confirmedPlayer2Score={match.player2Score}
                    canSubmit={match.status !== "CONFIRMED" && match.status !== "DISPUTED"}
                    waitingForOpponent={match.submissions.some((submission) => submission.submittedById === session.user.id && submission.status === "PENDING")}
                    attemptsLeft={Math.max(
                      0,
                      3 -
                        Math.floor(
                          match.submissions.filter(
                            (submission) => submission.status === "REJECTED" && submission.moderatorComment === "AUTO_MISMATCH",
                          ).length / 2,
                        ),
                    )}
                    helperText={
                      match.status === "DISPUTED"
                        ? "Матч переведён в спор. Теперь результат выставляет администрация." : "Оба игрока должны ввести один и тот же счёт. Если результаты не совпадут три раза, матч уйдёт в спор."
                    }
                    player1Id={match.player1?.id}
                    player2Id={match.player2?.id}
                    player1Name={match.player1 ? getPlayerDisplayName(match.player1) : "Игрок 1"}
                    player2Name={match.player2 ? getPlayerDisplayName(match.player2) : "Игрок 2"}
                    player1ClubName={match.player1Id ? participantClubMap[match.player1Id]?.clubName : null}
                    player2ClubName={match.player2Id ? participantClubMap[match.player2Id]?.clubName : null}
                    player1ClubBadgePath={match.player1Id ? participantClubMap[match.player1Id]?.clubBadgePath : null}
                    player2ClubBadgePath={match.player2Id ? participantClubMap[match.player2Id]?.clubBadgePath : null}
                    player1SubmissionState={getSubmissionState({
                      matchStatus: match.status,
                      latestSubmission: player1LatestSubmission
                        ? {
                            status: player1LatestSubmission.status,
                            moderatorComment: player1LatestSubmission.moderatorComment,
                          }
                        : undefined,
                    })}
                    player2SubmissionState={getSubmissionState({
                      matchStatus: match.status,
                      latestSubmission: player2LatestSubmission
                        ? {
                            status: player2LatestSubmission.status,
                            moderatorComment: player2LatestSubmission.moderatorComment,
                          }
                        : undefined,
                    })}
                    disputeHref="/contacts"
                    isDisputed={match.status === "DISPUTED"}
                  />
                );
              })
            ) : (
              <Card className="p-6 text-zinc-500">Здесь появятся матчи текущего участника после публикации расписания.</Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="participants">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {tournament.participants.map((entry) => (
              <Card key={entry.id} className="p-4">
                <ClubPlayerLine
                  playerId={entry.user.id}
                  playerName={getPlayerDisplayName(entry.user)}
                  clubName={entry.clubName}
                  badgePath={entry.clubBadgePath}
                />
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


