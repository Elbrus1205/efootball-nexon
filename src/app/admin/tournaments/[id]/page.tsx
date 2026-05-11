import Link from "next/link";
import { MatchStatus, StageType } from "@prisma/client";
import { notFound } from "next/navigation";
import { Activity, CalendarClock, Dices, GitBranch, History, Pencil, Swords, Trash2, Trophy, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  playoffTypeLabel,
  tournamentStatusLabel,
  tournamentStatusVariant,
} from "@/lib/admin-display";
import { requireAnyPermission } from "@/lib/auth/session";
import { db } from "@/lib/db";

function stageRoundUnit(stage?: { type: StageType } | null) {
  return stage?.type === StageType.PLAYOFF ? "Р Р°СѓРЅРґ" : "РўСѓСЂ";
}

export default async function AdminTournamentWorkspacePage({ params }: { params: { id: string } }) {
  await requireAnyPermission(["tournaments.createEdit", "tournaments.manageParticipants", "tournaments.manageStructure", "ownTournaments.moderateMatches", "allTournaments.moderateMatches"]);

  const tournament = await db.tournament.findUnique({
    where: { id: params.id },
    include: {
      participants: {
        include: { user: true, group: true },
        orderBy: [{ seed: "asc" }, { createdAt: "asc" }],
      },
      matches: {
        include: {
          player1: true,
          player2: true,
          stage: true,
          group: true,
        },
        orderBy: [{ round: "asc" }, { matchNumber: "asc" }],
      },
      stages: {
        include: {
          groups: true,
          bracket: true,
        },
        orderBy: { orderIndex: "asc" },
      },
    },
  });

  if (!tournament) notFound();

  const groupStage = tournament.stages.find((stage) => stage.type === StageType.GROUP_STAGE);
  const playoffStage = tournament.stages.find((stage) => stage.type === StageType.PLAYOFF);
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
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Workspace С‚СѓСЂРЅРёСЂР°</div>
              <h1 className="mt-2 break-words font-display text-2xl font-thin leading-tight text-white sm:text-3xl">
                {tournament.title}
              </h1>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Link href={`/admin/tournaments/${tournament.id}/edit`} className={actionButtonClass}>
              <Pencil className="h-4 w-4" />
              Р РµРґР°РєС‚РёСЂРѕРІР°С‚СЊ
            </Link>
            <Link href={`/admin/tournaments/${tournament.id}/participants`} className={actionButtonClass}>
              <Users className="h-4 w-4" />
              РЈС‡Р°СЃС‚РЅРёРєРё
            </Link>
            <Link href={`/admin/tournaments/${tournament.id}/stages`} className={actionButtonClass}>
              <GitBranch className="h-4 w-4" />
              Р­С‚Р°РїС‹
            </Link>
            <Link href={`/admin/tournaments/${tournament.id}/bracket`} className={actionButtonClass}>
              <Trophy className="h-4 w-4" />
              РЎРµС‚РєР°
            </Link>
            <Link href={`/admin/tournaments/${tournament.id}/matches`} className={actionButtonClass}>
              <Swords className="h-4 w-4" />
              РњР°С‚С‡Рё
            </Link>
            <Link href={`/admin/tournaments/${tournament.id}/deadlines`} className={actionButtonClass}>
              <CalendarClock className="h-4 w-4" />
              Р”РµРґР»Р°Р№РЅС‹
            </Link>
            <Link href={`/admin/tournaments/${tournament.id}/history`} className={actionButtonClass}>
              <History className="h-4 w-4" />
              РСЃС‚РѕСЂРёСЏ
            </Link>
            <form action={`/api/admin/tournaments/${tournament.id}`} method="post" className="contents">
              <input type="hidden" name="_method" value="delete" />
              <button
                type="submit"
                className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg border border-red-400/20 bg-red-500/10 px-3 text-[13px] font-medium text-red-200 transition hover:bg-red-500/20 hover:text-red-100 sm:text-sm"
              >
                <Trash2 className="h-4 w-4" />
                РЈРґР°Р»РёС‚СЊ
              </button>
            </form>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.72fr)] lg:items-stretch">
        <Card className="h-full overflow-hidden rounded-lg p-0">
          <CardHeader className="mb-0 p-4 pb-2 sm:p-5 sm:pb-2">
            <CardTitle className="flex items-center gap-2">
              <Dices className="h-5 w-5 text-amber-200" />
              РЎР»СѓС‡Р°Р№РЅС‹Рµ СЃС‡РµС‚Р°
            </CardTitle>
            <CardDescription>Р‘С‹СЃС‚СЂРѕ РІС‹СЃС‚Р°РІРёС‚СЊ СЂРµР·СѓР»СЊС‚Р°С‚С‹ РґР»СЏ С‚РµРєСѓС‰РµРіРѕ С‚СѓСЂР° РёР»Рё СЂР°СѓРЅРґР° Р±РµР· РѕС‚РєСЂС‹С‚РёСЏ СЂСѓС‡РЅРѕРіРѕ СЂРµРґР°РєС‚РѕСЂР°.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-0 p-4 pt-2 sm:p-5 sm:pt-3">
            <div className="rounded-lg border border-amber-300/20 bg-amber-300/[0.08] p-3 sm:p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-200/80">РўРµРєСѓС‰РёР№ Р·Р°РїСѓСЃРє</div>
                  <div className="mt-1 text-sm font-medium text-amber-50">
                    {randomScoreTargetCount
                      ? `${randomScoreStage?.name ?? "РўРµРєСѓС‰РёР№ СЌС‚Р°Рї"} вЂў ${stageRoundUnit(randomScoreStage)} ${randomScoreRound}: ${randomScoreTargetCount} РјР°С‚С‡РµР№ Р±РµР· СЂРµР·СѓР»СЊС‚Р°С‚Р°`
                      : randomScoreRepairCount
                        ? "РџСЂРѕРІРµСЂРёС‚ РїСЂРѕРґРІРёР¶РµРЅРёРµ СѓР¶Рµ РїРѕРґС‚РІРµСЂР¶РґРµРЅРЅС‹С… РјР°С‚С‡РµР№ РїР»РµР№-РѕС„С„."
                        : "РќРµС‚ РјР°С‚С‡РµР№ Р±РµР· СЂРµР·СѓР»СЊС‚Р°С‚Р° СЃ РґРІСѓРјСЏ РЅР°Р·РЅР°С‡РµРЅРЅС‹РјРё РёРіСЂРѕРєР°РјРё."}
                  </div>
                </div>
                <form action={`/api/admin/tournaments/${tournament.id}/matches/random-scores`} method="post">
                  <Button
                    type="submit"
                    disabled={!canRunRandomScores}
                    variant="outline"
                    className="h-10 w-full rounded-lg border-amber-300/30 bg-amber-300/10 px-4 text-amber-100 hover:bg-amber-300/15 sm:w-auto"
                  >
                    <Dices className="mr-2 h-4 w-4" />
                    Р’С‹СЃС‚Р°РІРёС‚СЊ СЂР°РЅРґРѕРј
                  </Button>
                </form>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="h-full">
          <Card className="h-full overflow-hidden rounded-lg p-0">
            <CardHeader className="mb-0 p-4 pb-2 sm:p-5 sm:pb-2">
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-primary" />
                РЎРІСЏР·РєР° СЃС‚Р°РґРёР№
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 p-4 pt-2 sm:p-5 sm:pt-3">
              <div className="grid gap-2 text-sm">
                <div className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.035] px-3 py-2">
                  <span className="text-zinc-500">Р“СЂСѓРїРїС‹</span>
                  <span className="font-medium text-zinc-200">{groupStage ? `${groupStage.groups.length} РіСЂСѓРїРї` : "РЅРµ РЅР°СЃС‚СЂРѕРµРЅС‹"}</span>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.035] px-3 py-2">
                  <span className="text-zinc-500">РџР»РµР№-РѕС„С„</span>
                  <span className="font-medium text-zinc-200">{playoffStage ? "РіРѕС‚РѕРІ Рє Р·Р°РїРѕР»РЅРµРЅРёСЋ" : "РЅРµ СЃРѕР·РґР°РЅ"}</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button asChild variant="secondary" className="rounded-lg">
                  <Link href={`/admin/tournaments/${tournament.id}/standings`}>РўР°Р±Р»РёС†С‹ РіСЂСѓРїРї</Link>
                </Button>
                <Button asChild variant="outline" className="rounded-lg">
                  <Link href={`/admin/tournaments/${tournament.id}/bracket`}>РџРѕСЃРµРІ РІ РїР»РµР№-РѕС„С„</Link>
                </Button>
              </div>
            </CardContent>
          </Card>

        </div>
      </div>
    </div>
  );
}
