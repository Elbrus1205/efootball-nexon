import Link from "next/link";
import { MatchStatus, ParticipantStatus, StageType, TournamentApplicationStatus, UserRole } from "@prisma/client";
import { notFound } from "next/navigation";
import { Activity, CalendarClock, ClipboardCheck, Dices, GitBranch, History, Pencil, Swords, Trash2, Trophy, Users } from "lucide-react";
import { RandomScoresButton } from "@/components/admin/random-scores-button";
import { TournamentImageExporterLazy, type ExportGroup, type ExportScheduleRound } from "@/components/admin/tournament-image-exporter-lazy";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  playoffTypeLabel,
  tournamentStatusLabel,
  tournamentStatusVariant,
} from "@/lib/admin-display";
import { getAdminTournamentAccessWhere } from "@/lib/admin-tournament-access";
import { requireAnyPermission } from "@/lib/auth/session";
import { getAvailableClubs } from "@/lib/clubs";
import { db } from "@/lib/db";
import { getPlayerDisplayName } from "@/lib/player-name";

function stageRoundUnit(stage?: { type: StageType } | null) {
  return stage?.type === StageType.PLAYOFF ? "Раунд" : "Тур";
}

function isBrokenClubName(value: string | null | undefined) {
  const name = value?.trim();
  if (!name) return true;

  const questionMarks = name.match(/\?/g)?.length ?? 0;
  return questionMarks >= 3 || questionMarks / name.length > 0.4;
}

function resolveClubName(
  entry: {
    clubSlug?: string | null;
    clubName?: string | null;
  },
  clubsBySlug: Map<string, { name: string }>,
  fallback: string,
) {
  if (entry.clubSlug) {
    const club = clubsBySlug.get(entry.clubSlug);
    if (club && isBrokenClubName(entry.clubName)) {
      return club.name;
    }
  }

  return entry.clubName?.trim() && !isBrokenClubName(entry.clubName) ? entry.clubName.trim() : fallback;
}

function resolveClubBadgePath(
  entry: {
    clubSlug?: string | null;
    clubBadgePath?: string | null;
  },
  clubsBySlug: Map<string, { imagePath: string }>,
) {
  if (entry.clubBadgePath?.trim()) return entry.clubBadgePath;
  return entry.clubSlug ? clubsBySlug.get(entry.clubSlug)?.imagePath ?? null : null;
}

function buildExportRows(
  participants: Array<{
    userId: string;
    clubSlug: string | null;
    clubName: string | null;
    clubBadgePath: string | null;
    user: { id: string; name: string | null };
  }>,
  matches: Array<{
    status: MatchStatus;
    player1Id: string | null;
    player2Id: string | null;
    player1Score: number | null;
    player2Score: number | null;
  }>,
  clubsBySlug: Map<string, { name: string; imagePath: string }>,
  scoring: { pointsForWin?: number | null; pointsForDraw?: number | null; pointsForLoss?: number | null },
): ExportGroup["rows"] {
  const table = new Map<string, ExportGroup["rows"][number]>();
  const pointsForWin = scoring.pointsForWin ?? 3;
  const pointsForDraw = scoring.pointsForDraw ?? 1;
  const pointsForLoss = scoring.pointsForLoss ?? 0;

  for (const entry of participants) {
    const playerName = getPlayerDisplayName(entry.user);
    table.set(entry.userId, {
      rank: 0,
      clubName: resolveClubName(entry, clubsBySlug, playerName),
      clubBadgePath: resolveClubBadgePath(entry, clubsBySlug),
      playerName,
      played: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      goalDifference: 0,
      points: 0,
    });
  }

  for (const match of matches) {
    if (match.status !== MatchStatus.CONFIRMED && match.status !== MatchStatus.FINISHED) continue;
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
      player1.points += pointsForWin;
      player2.points += pointsForLoss;
    } else if (match.player1Score < match.player2Score) {
      player2.wins += 1;
      player1.losses += 1;
      player2.points += pointsForWin;
      player1.points += pointsForLoss;
    } else {
      player1.draws += 1;
      player2.draws += 1;
      player1.points += pointsForDraw;
      player2.points += pointsForDraw;
    }
  }

  return Array.from(table.values())
    .sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
      if (b.wins !== a.wins) return b.wins - a.wins;
      return a.clubName.localeCompare(b.clubName, "ru");
    })
    .map((row, index) => ({ ...row, rank: index + 1 }));
}

function exportRoundTitle(match: {
  round: number;
  stage?: { name: string; type: StageType } | null;
}) {
  if (match.stage?.type === StageType.PLAYOFF) {
    return `${match.stage.name} · ${stageRoundUnit(match.stage)} ${match.round}`;
  }

  return `${match.round} тур`;
}

export default async function AdminTournamentWorkspacePage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await requireAnyPermission(["tournaments.createEdit", "tournaments.manageParticipants", "tournaments.manageStructure", "ownTournaments.moderateMatches", "allTournaments.moderateMatches"]);
  const canDeleteTournament = session.user.role !== UserRole.TRAINEE;

  const [tournament, availableClubs] = await Promise.all([
    db.tournament.findFirst({
      where: { id: params.id, ...getAdminTournamentAccessWhere(session) },
      select: {
        id: true,
        title: true,
        status: true,
        playoffType: true,
        registrationApplications: {
          where: { status: TournamentApplicationStatus.PENDING },
          select: { id: true },
        },
        participants: {
          select: {
            id: true,
            userId: true,
            clubSlug: true,
            clubName: true,
            clubBadgePath: true,
            user: { select: { id: true, name: true, email: true } },
          },
          orderBy: [{ seed: "asc" }, { createdAt: "asc" }],
        },
        matches: {
          select: {
            id: true,
            stageId: true,
            groupId: true,
            bracketId: true,
            round: true,
            matchNumber: true,
            status: true,
            player1Id: true,
            player2Id: true,
            participant1EntryId: true,
            participant2EntryId: true,
            winnerId: true,
            player1Score: true,
            player2Score: true,
            player1: { select: { id: true, name: true, email: true } },
            player2: { select: { id: true, name: true, email: true } },
            participant1Entry: {
              select: {
                id: true,
                userId: true,
                clubSlug: true,
                clubName: true,
                clubBadgePath: true,
                user: { select: { id: true, name: true, email: true } },
              },
            },
            participant2Entry: {
              select: {
                id: true,
                userId: true,
                clubSlug: true,
                clubName: true,
                clubBadgePath: true,
                user: { select: { id: true, name: true, email: true } },
              },
            },
            stage: { select: { id: true, name: true, type: true, status: true, orderIndex: true } },
            group: { select: { id: true, name: true, orderIndex: true } },
          },
          orderBy: [{ round: "asc" }, { matchNumber: "asc" }],
        },
        stages: {
          select: {
            id: true,
            name: true,
            type: true,
            status: true,
            orderIndex: true,
            pointsForWin: true,
            pointsForDraw: true,
            pointsForLoss: true,
            groups: {
              select: {
                id: true,
                name: true,
                orderIndex: true,
                members: {
                  where: { status: ParticipantStatus.CONFIRMED },
                  select: {
                    id: true,
                    userId: true,
                    clubSlug: true,
                    clubName: true,
                    clubBadgePath: true,
                    user: { select: { id: true, name: true, email: true } },
                  },
                  orderBy: [{ seed: "asc" }, { createdAt: "asc" }],
                },
              },
              orderBy: { orderIndex: "asc" },
            },
            bracket: { select: { id: true } },
          },
          orderBy: { orderIndex: "asc" },
        },
      },
    }),
    getAvailableClubs(),
  ]);

  if (!tournament) notFound();

  const groupStage = tournament.stages.find((stage) => stage.type === StageType.GROUP_STAGE);
  const playoffStage = tournament.stages.find((stage) => stage.type === StageType.PLAYOFF);
  const clubsBySlug = new Map(availableClubs.map((club) => [club.slug, club]));
  const participantClubMap = new Map(
    tournament.participants.map((entry) => {
      const playerName = getPlayerDisplayName(entry.user);

      return [
        entry.userId,
        {
          clubName: resolveClubName(entry, clubsBySlug, playerName),
          clubBadgePath: resolveClubBadgePath(entry, clubsBySlug),
          playerName,
        },
      ];
    }),
  );
  const resolveExportSide = (match: (typeof tournament.matches)[number], side: 1 | 2) => {
    const player = side === 1 ? match.player1 : match.player2;
    const entry = side === 1 ? match.participant1Entry : match.participant2Entry;
    const playerId = (side === 1 ? match.player1Id : match.player2Id) ?? entry?.userId ?? null;
    const playerName = player
      ? getPlayerDisplayName(player)
      : entry?.user
        ? getPlayerDisplayName(entry.user)
        : side === 1
          ? "Игрок 1"
          : "Игрок 2";
    const mappedClub = playerId ? participantClubMap.get(playerId) : null;

    return {
      playerName,
      clubName: mappedClub?.clubName ?? (entry ? resolveClubName(entry, clubsBySlug, playerName) : playerName),
      clubBadgePath: mappedClub?.clubBadgePath ?? (entry ? resolveClubBadgePath(entry, clubsBySlug) : null),
    };
  };

  const exportGroups: ExportGroup[] =
    groupStage?.groups.map((group) => ({
      id: group.id,
      name: group.name,
      rows: buildExportRows(
        group.members,
        tournament.matches.filter((match) => match.groupId === group.id),
        clubsBySlug,
        groupStage,
      ),
    })) ?? [];

  const exportRoundMap = new Map<string, ExportScheduleRound>();
  for (const match of [...tournament.matches].sort(
    (a, b) =>
      (a.stage?.orderIndex ?? 999) - (b.stage?.orderIndex ?? 999) ||
      a.round - b.round ||
      (a.group?.orderIndex ?? 0) - (b.group?.orderIndex ?? 0) ||
      a.matchNumber - b.matchNumber,
  )) {
    const key = [match.stageId ?? "stage", match.round].join(":");
    const round = exportRoundMap.get(key) ?? {
      key,
      title: exportRoundTitle(match),
      matches: [],
    };
    const player1 = resolveExportSide(match, 1);
    const player2 = resolveExportSide(match, 2);

    round.matches.push({
      id: match.id,
      groupName: match.group?.name ?? null,
      matchNumber: match.matchNumber,
      player1ClubName: player1.clubName,
      player1ClubBadgePath: player1.clubBadgePath,
      player1Name: player1.playerName,
      player2ClubName: player2.clubName,
      player2ClubBadgePath: player2.clubBadgePath,
      player2Name: player2.playerName,
      scoreLabel: match.player1Score !== null && match.player2Score !== null ? `${match.player1Score} - ${match.player2Score}` : "VS",
    });
    exportRoundMap.set(key, round);
  }
  const exportRounds = Array.from(exportRoundMap.values()).filter((round) => round.matches.length > 0);
  const randomScoreStatuses = new Set<MatchStatus>([
    MatchStatus.PENDING,
    MatchStatus.READY,
    MatchStatus.SCHEDULED,
    MatchStatus.LIVE,
    MatchStatus.REJECTED,
    MatchStatus.RESULT_SUBMITTED,
    MatchStatus.DISPUTED,
  ]);
  const randomScoreMatches = tournament.matches.filter(
    (match) =>
      match.player1Id &&
      match.player2Id &&
      match.participant1EntryId &&
      match.participant2EntryId &&
      randomScoreStatuses.has(match.status) &&
      (match.player1Score === null || match.player2Score === null),
  );
  const randomScoreStage =
    tournament.stages.find((stage) => stage.status === "ACTIVE" && randomScoreMatches.some((match) => match.stageId === stage.id)) ??
    tournament.stages.find((stage) => randomScoreMatches.some((match) => match.stageId === stage.id));
  const randomScoreStageMatches = randomScoreStage ? randomScoreMatches.filter((match) => match.stageId === randomScoreStage.id) : randomScoreMatches;
  const randomScoreRound = randomScoreStageMatches.length ? Math.min(...randomScoreStageMatches.map((match) => match.round)) : null;
  const randomScoreTargetCount = randomScoreRound === null ? 0 : randomScoreStageMatches.filter((match) => match.round === randomScoreRound).length;
  const randomScoreRepairCount = tournament.matches.filter((match) => match.bracketId && match.winnerId && match.status === MatchStatus.CONFIRMED).length;
  const canRunRandomScores = randomScoreTargetCount > 0 || randomScoreRepairCount > 0;

  const actionButtonClass =
    "inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 text-[13px] font-medium text-zinc-100 transition hover:border-primary/35 hover:bg-primary/10 hover:text-white sm:text-sm";

  return (
    <div className="space-y-5">
      <Card className="overflow-hidden rounded-lg border-primary/15 bg-white/[0.045] p-0 shadow-[0_22px_80px_rgba(0,0,0,0.22)]">
        <CardContent className="grid gap-5 space-y-0 p-4 sm:p-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(360px,1.1fr)] lg:items-center">
          <div className="min-w-0 space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={tournamentStatusVariant[tournament.status]}>{tournamentStatusLabel[tournament.status]}</Badge>
              {tournament.playoffType ? <Badge variant="neutral">{playoffTypeLabel[tournament.playoffType]}</Badge> : null}
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Workspace турнира</div>
              <h1 className="mt-2 break-words font-display text-2xl font-thin leading-tight text-white sm:text-3xl">
                {tournament.title}
              </h1>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Link href={`/admin/tournaments/${tournament.id}/edit`} className={actionButtonClass}>
              <Pencil className="h-4 w-4" />
              Редактировать
            </Link>
            <Link href={`/admin/tournaments/${tournament.id}/participants`} className={actionButtonClass}>
              <Users className="h-4 w-4" />
              Участники
            </Link>
            <Link href={`/admin/tournaments/${tournament.id}/applications`} className={actionButtonClass}>
              <ClipboardCheck className="h-4 w-4" />
              Заявки на участие{tournament.registrationApplications.length ? ` · ${tournament.registrationApplications.length}` : ""}
            </Link>
            <Link href={`/admin/tournaments/${tournament.id}/stages`} className={actionButtonClass}>
              <GitBranch className="h-4 w-4" />
              Этапы
            </Link>
            <Link href={`/admin/tournaments/${tournament.id}/bracket`} className={actionButtonClass}>
              <Trophy className="h-4 w-4" />
              Сетка
            </Link>
            <Link href={`/admin/tournaments/${tournament.id}/matches`} className={actionButtonClass}>
              <Swords className="h-4 w-4" />
              Матчи
            </Link>
            <Link href={`/admin/tournaments/${tournament.id}/deadlines`} className={actionButtonClass}>
              <CalendarClock className="h-4 w-4" />
              Дедлайны
            </Link>
            <Link href={`/admin/tournaments/${tournament.id}/history`} className={actionButtonClass}>
              <History className="h-4 w-4" />
              История
            </Link>
            {canDeleteTournament ? (
            <form action={`/api/admin/tournaments/${tournament.id}`} method="post" className="contents">
              <input type="hidden" name="_method" value="delete" />
              <button
                type="submit"
                className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg border border-red-400/20 bg-red-500/10 px-3 text-[13px] font-medium text-red-200 transition hover:bg-red-500/20 hover:text-red-100 sm:text-sm"
              >
                <Trash2 className="h-4 w-4" />
                Удалить
              </button>
            </form>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <TournamentImageExporterLazy tournamentTitle={tournament.title} groups={exportGroups} rounds={exportRounds} />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.72fr)] lg:items-stretch">
        <Card className="h-full overflow-hidden rounded-lg p-0">
          <CardHeader className="mb-0 p-4 pb-2 sm:p-5 sm:pb-2">
            <CardTitle className="flex items-center gap-2">
              <Dices className="h-5 w-5 text-amber-200" />
              Случайные счета
            </CardTitle>
            <CardDescription>Быстро выставить результаты для текущего тура или раунда без открытия ручного редактора.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-0 p-4 pt-2 sm:p-5 sm:pt-3">
            <div className="rounded-lg border border-amber-300/20 bg-amber-300/[0.08] p-3 sm:p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-200/80">Текущий запуск</div>
                  <div className="mt-1 text-sm font-medium text-amber-50">
                    {randomScoreTargetCount
                      ? `${randomScoreStage?.name ?? "Текущий этап"} • ${stageRoundUnit(randomScoreStage)} ${randomScoreRound}: ${randomScoreTargetCount} матчей без результата`
                      : randomScoreRepairCount
                        ? "Проверит продвижение уже подтвержденных матчей плей-офф."
                        : "Нет матчей без результата с двумя назначенными игроками."}
                  </div>
                </div>
                <RandomScoresButton tournamentId={tournament.id} disabled={!canRunRandomScores} />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="h-full">
          <Card className="h-full overflow-hidden rounded-lg p-0">
            <CardHeader className="mb-0 p-4 pb-2 sm:p-5 sm:pb-2">
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-primary" />
                Связка стадий
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 p-4 pt-2 sm:p-5 sm:pt-3">
              <div className="grid gap-2 text-sm">
                <div className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.035] px-3 py-2">
                  <span className="text-zinc-500">Группы</span>
                  <span className="font-medium text-zinc-200">{groupStage ? `${groupStage.groups.length} групп` : "не настроены"}</span>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.035] px-3 py-2">
                  <span className="text-zinc-500">Плей-офф</span>
                  <span className="font-medium text-zinc-200">{playoffStage ? "готов к заполнению" : "не создан"}</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button asChild variant="secondary" className="rounded-lg">
                  <Link href={`/admin/tournaments/${tournament.id}/standings`}>Таблицы групп</Link>
                </Button>
                <Button asChild variant="outline" className="rounded-lg">
                  <Link href={`/admin/tournaments/${tournament.id}/bracket`}>Посев в плей-офф</Link>
                </Button>
              </div>
            </CardContent>
          </Card>

        </div>
      </div>
    </div>
  );
}
