"use client";

import type { MatchStatus } from "@prisma/client";
import { GitBranch, Trophy } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useEffect, useState, type CSSProperties } from "react";
import { getPlayerDisplayName } from "@/lib/player-name";
import { cn } from "@/lib/utils";

type ClubMeta = {
  clubName?: string | null;
  clubBadgePath?: string | null;
};

type BracketUser = {
  id: string;
  name: string | null;
  email?: string | null;
};

type BracketParticipantEntry = {
  userId: string;
  clubName: string | null;
  clubBadgePath: string | null;
};

type BracketMatch = {
  id: string;
  round: number;
  matchNumber: number;
  bracket: string;
  seriesKey: string | null;
  legNumber: number | null;
  isPenaltyTiebreak: boolean;
  isThirdPlaceMatch: boolean;
  player1Id: string | null;
  player2Id: string | null;
  winnerId: string | null;
  player1Score: number | null;
  player2Score: number | null;
  player1PenaltyScore: number | null;
  player2PenaltyScore: number | null;
  status: MatchStatus;
  player1: BracketUser | null;
  player2: BracketUser | null;
  participant1Entry: BracketParticipantEntry | null;
  participant2Entry: BracketParticipantEntry | null;
};

type BracketSeries = {
  key: string;
  round: number;
  matchNumber: number;
  isThirdPlaceMatch: boolean;
  referenceMatch: BracketMatch;
  regularMatches: BracketMatch[];
  penaltyMatch: BracketMatch | null;
};

type BracketSide = {
  playerId?: string | null;
  playerName: string;
  clubName?: string | null;
  badgePath?: string | null;
  score: number | null;
  penaltyText?: string | null;
  isResolved: boolean;
  isWinner: boolean;
  isChampion: boolean;
  isCurrentUser: boolean;
};

const RESOLVED_MATCH_STATUSES: MatchStatus[] = ["CONFIRMED", "FINISHED"];

function roundTitle(round: number, totalRounds: number) {
  const roundsRemaining = totalRounds - round;

  if (roundsRemaining <= 0) return "Финал";
  if (roundsRemaining === 1) return "1/2 финала";
  if (roundsRemaining === 2) return "1/4 финала";
  if (roundsRemaining === 3) return "1/8 финала";

  return `1/${2 ** roundsRemaining} финала`;
}

function seriesLabel(series: BracketSeries) {
  if (series.isThirdPlaceMatch) {
    return "Матч за 3-е место";
  }

  return `Матч #${series.matchNumber}`;
}

function resolveClubMeta(match: BracketMatch, slot: 1 | 2, clubsByUserId: Record<string, ClubMeta>): ClubMeta {
  if (slot === 1) {
    return {
      clubName: match.player1Id
        ? clubsByUserId[match.player1Id]?.clubName ?? match.participant1Entry?.clubName
        : match.participant1Entry?.clubName,
      clubBadgePath: match.player1Id
        ? clubsByUserId[match.player1Id]?.clubBadgePath ?? match.participant1Entry?.clubBadgePath
        : match.participant1Entry?.clubBadgePath,
    };
  }

  return {
    clubName: match.player2Id
      ? clubsByUserId[match.player2Id]?.clubName ?? match.participant2Entry?.clubName
      : match.participant2Entry?.clubName,
    clubBadgePath: match.player2Id
      ? clubsByUserId[match.player2Id]?.clubBadgePath ?? match.participant2Entry?.clubBadgePath
      : match.participant2Entry?.clubBadgePath,
  };
}

function isResolvedMatch(match: BracketMatch) {
  return RESOLVED_MATCH_STATUSES.includes(match.status);
}

function getBracketSideUserId(match: BracketMatch, slot: 1 | 2) {
  return slot === 1 ? match.participant1Entry?.userId ?? match.player1Id : match.participant2Entry?.userId ?? match.player2Id;
}

function buildSeries(matches: BracketMatch[]) {
  const grouped = new Map<string, BracketMatch[]>();

  for (const match of matches) {
    const key = match.seriesKey ?? match.id;
    const bucket = grouped.get(key) ?? [];
    bucket.push(match);
    grouped.set(key, bucket);
  }

  return Array.from(grouped.entries())
    .map(([key, bucket]) => {
      const ordered = [...bucket].sort((a, b) => {
        if (a.isPenaltyTiebreak !== b.isPenaltyTiebreak) {
          return Number(a.isPenaltyTiebreak) - Number(b.isPenaltyTiebreak);
        }

        if ((a.legNumber ?? 1) !== (b.legNumber ?? 1)) {
          return (a.legNumber ?? 1) - (b.legNumber ?? 1);
        }

        return a.matchNumber - b.matchNumber;
      });

      const regularMatches = ordered.filter((item) => !item.isPenaltyTiebreak);
      const referenceMatch = regularMatches[regularMatches.length - 1] ?? ordered[ordered.length - 1];

      return {
        key,
        round: referenceMatch.round,
        matchNumber: referenceMatch.matchNumber,
        isThirdPlaceMatch: referenceMatch.isThirdPlaceMatch,
        referenceMatch,
        regularMatches,
        penaltyMatch: ordered.find((item) => item.isPenaltyTiebreak) ?? null,
      } satisfies BracketSeries;
    })
    .sort((a, b) => a.matchNumber - b.matchNumber);
}

function getSeriesWinner(series: BracketSeries) {
  if (series.penaltyMatch && isResolvedMatch(series.penaltyMatch) && series.penaltyMatch.winnerId) {
    return series.penaltyMatch.winnerId;
  }

  const thirdMatch = series.regularMatches.find((item) => item.legNumber === 3);
  if (thirdMatch && isResolvedMatch(thirdMatch) && thirdMatch.winnerId) {
    return thirdMatch.winnerId;
  }

  const baseMatches = series.regularMatches.filter((item) => (item.legNumber ?? 1) <= 2);
  const confirmedBaseMatches = baseMatches.filter(isResolvedMatch);
  if (!confirmedBaseMatches.length) {
    return null;
  }

  if (baseMatches.length > 1 && confirmedBaseMatches.length < baseMatches.length) {
    return null;
  }

  const aggregatePlayer1 = confirmedBaseMatches.reduce((sum, item) => sum + (item.player1Score ?? 0), 0);
  const aggregatePlayer2 = confirmedBaseMatches.reduce((sum, item) => sum + (item.player2Score ?? 0), 0);

  if (aggregatePlayer1 === aggregatePlayer2) {
    const decidingMatch = confirmedBaseMatches[confirmedBaseMatches.length - 1];
    if (
      decidingMatch?.winnerId &&
      decidingMatch.player1PenaltyScore !== null &&
      decidingMatch.player2PenaltyScore !== null &&
      decidingMatch.player1PenaltyScore !== decidingMatch.player2PenaltyScore
    ) {
      return decidingMatch.winnerId;
    }

    return null;
  }

  return aggregatePlayer1 > aggregatePlayer2 ? series.referenceMatch.player1Id : series.referenceMatch.player2Id;
}

function getAggregateScore(series: BracketSeries) {
  const confirmedRegularMatches = series.regularMatches.filter(isResolvedMatch);

  if (!confirmedRegularMatches.length) {
    return { player1: null, player2: null };
  }

  return {
    player1: confirmedRegularMatches.reduce((sum, item) => sum + (item.player1Score ?? 0), 0),
    player2: confirmedRegularMatches.reduce((sum, item) => sum + (item.player2Score ?? 0), 0),
  };
}

function getPenaltyScores(series: BracketSeries) {
  if (!series.penaltyMatch || !isResolvedMatch(series.penaltyMatch)) {
    const decidingMatch = [...series.regularMatches]
      .filter(isResolvedMatch)
      .sort((a, b) => (a.legNumber ?? 1) - (b.legNumber ?? 1) || a.matchNumber - b.matchNumber)
      .at(-1);

    if (
      !decidingMatch ||
      decidingMatch.player1PenaltyScore === null ||
      decidingMatch.player2PenaltyScore === null ||
      decidingMatch.player1PenaltyScore === decidingMatch.player2PenaltyScore
    ) {
      return null;
    }

    return {
      player1: decidingMatch.player1PenaltyScore,
      player2: decidingMatch.player2PenaltyScore,
    };
  }

  if (series.penaltyMatch.player1Score === null || series.penaltyMatch.player2Score === null) {
    return null;
  }

  return {
    player1: series.penaltyMatch.player1Score,
    player2: series.penaltyMatch.player2Score,
  };
}

function BracketTeamRow({ side }: { side: BracketSide }) {
  const isLoser = side.isResolved && !side.isWinner;
  const hasPenalty = Boolean(side.penaltyText);

  return (
    <div
      className={cn(
        "relative grid min-h-10 grid-cols-[30px_minmax(0,1fr)_68px] items-center gap-2 px-2.5 py-1.5 text-zinc-200 transition",
        hasPenalty && "min-h-11",
        side.isChampion &&
          "min-h-11 overflow-hidden bg-[linear-gradient(100deg,rgba(250,204,21,0.26),rgba(245,158,11,0.16),rgba(255,255,255,0.05))] shadow-[inset_0_0_34px_rgba(250,204,21,0.24)]",
        side.isCurrentUser && !side.isChampion && "bg-primary/10 ring-1 ring-inset ring-primary/35",
        side.isWinner && !side.isChampion && "bg-emerald-400/10",
        isLoser && "bg-zinc-950/55 opacity-55 grayscale",
      )}
    >
      {side.isChampion ? (
        <div className="pointer-events-none absolute left-12 right-14 top-0 h-6 overflow-visible" aria-hidden="true">
          {[0, 1, 2].map((index) => (
            <Trophy
              key={index}
              className="champion-cup absolute top-1 h-4 w-4 text-amber-300 drop-shadow-[0_0_8px_rgba(250,204,21,0.85)]"
              style={{ left: `${10 + index * 33}%`, animationDelay: `${index * 0.24}s` }}
            />
          ))}
        </div>
      ) : null}

      <div
        className={cn(
          "relative z-10 flex h-7 w-7 items-center justify-center overflow-hidden rounded-lg border border-white/15 bg-black/30",
          side.isChampion && "border-amber-200/70 bg-amber-400/15 shadow-[0_0_18px_rgba(250,204,21,0.35)]",
          side.isWinner && !side.isChampion && "border-emerald-200/45 bg-emerald-400/10",
          isLoser && "border-zinc-600/40 bg-zinc-900/70",
        )}
      >
        {side.badgePath ? (
          <Image src={side.badgePath} alt={side.clubName ?? side.playerName} width={40} height={40} className="h-full w-full object-contain p-1" />
        ) : (
          <span className={cn("text-[10px] uppercase text-zinc-500", side.isChampion && "text-amber-100", isLoser && "text-zinc-600")}>FC</span>
        )}
      </div>

      <div className="relative z-10 min-w-0">
        <div
          className={cn(
            "truncate text-[13px] font-semibold leading-tight text-white",
            side.isChampion && "text-amber-100 drop-shadow-[0_0_10px_rgba(250,204,21,0.55)]",
            isLoser && "text-zinc-500",
          )}
        >
          {side.clubName ?? "Клуб не назначен"}
        </div>
        {side.playerId ? (
          <Link
            href={`/players/${side.playerId}`}
            className={cn(
              "mt-0.5 block truncate text-[10px] font-medium leading-tight text-zinc-400 underline-offset-4 transition hover:text-primary hover:underline",
              side.isChampion && "font-black text-amber-200 hover:text-amber-100",
              isLoser && "text-zinc-600 hover:text-zinc-400",
            )}
          >
            {side.playerName}
          </Link>
        ) : (
          <div
            className={cn(
              "mt-0.5 truncate text-[10px] font-medium leading-tight text-zinc-500",
              side.isChampion && "font-black text-amber-200",
              isLoser && "text-zinc-600",
            )}
          >
            {side.playerName}
          </div>
        )}
      </div>

      <div className="relative z-10 flex min-w-0 flex-col items-end justify-center gap-0.5 text-right">
        <span
          className={cn(
            "text-base font-black leading-none text-white",
            side.isChampion && "text-amber-100 drop-shadow-[0_0_10px_rgba(250,204,21,0.7)]",
            isLoser && "text-zinc-500",
          )}
        >
          {side.score ?? "-"}
        </span>
        {side.penaltyText ? (
          <span
            className={cn(
              "inline-flex max-w-full items-center rounded-full border border-amber-300/35 bg-amber-300/10 px-1.5 py-[1px] text-[9px] font-black uppercase leading-none tracking-[0.12em] text-amber-200 shadow-[0_0_12px_rgba(251,191,36,0.12)]",
              side.isChampion && "border-amber-100/55 bg-amber-200/15 text-amber-100",
              isLoser && "border-zinc-700/50 bg-zinc-900/60 text-zinc-500 shadow-none",
            )}
          >
            пен {side.penaltyText}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function BracketMatchBox({
  series,
  clubsByUserId,
  isFinal = false,
  currentUserId,
}: {
  series: BracketSeries;
  clubsByUserId: Record<string, ClubMeta>;
  isFinal?: boolean;
  currentUserId?: string | null;
}) {
  const match = series.referenceMatch;
  const playerOneClub = resolveClubMeta(match, 1, clubsByUserId);
  const playerTwoClub = resolveClubMeta(match, 2, clubsByUserId);
  const aggregateScore = getAggregateScore(series);
  const penaltyScores = getPenaltyScores(series);
  const seriesWinnerId = getSeriesWinner(series);
  const isSeriesResolved = Boolean(seriesWinnerId);
  const sideOneUserId = getBracketSideUserId(match, 1);
  const sideTwoUserId = getBracketSideUserId(match, 2);
  const isCurrentUserMatch = Boolean(currentUserId && (sideOneUserId === currentUserId || sideTwoUserId === currentUserId));

  const sides: [BracketSide, BracketSide] = [
    {
      playerId: match.player1?.id,
      playerName: match.player1 ? getPlayerDisplayName(match.player1) : "Игрок не назначен",
      clubName: playerOneClub.clubName,
      badgePath: playerOneClub.clubBadgePath,
      score: aggregateScore.player1,
      penaltyText: penaltyScores ? String(penaltyScores.player1) : null,
      isResolved: isSeriesResolved,
      isWinner: Boolean(seriesWinnerId && seriesWinnerId === match.player1Id),
      isChampion: Boolean(isFinal && seriesWinnerId && seriesWinnerId === match.player1Id),
      isCurrentUser: Boolean(currentUserId && sideOneUserId === currentUserId),
    },
    {
      playerId: match.player2?.id,
      playerName: match.player2 ? getPlayerDisplayName(match.player2) : "Игрок не назначен",
      clubName: playerTwoClub.clubName,
      badgePath: playerTwoClub.clubBadgePath,
      score: aggregateScore.player2,
      penaltyText: penaltyScores ? String(penaltyScores.player2) : null,
      isResolved: isSeriesResolved,
      isWinner: Boolean(seriesWinnerId && seriesWinnerId === match.player2Id),
      isChampion: Boolean(isFinal && seriesWinnerId && seriesWinnerId === match.player2Id),
      isCurrentUser: Boolean(currentUserId && sideTwoUserId === currentUserId),
    },
  ];

  return (
    <div
      data-match-label={seriesLabel(series)}
      className={cn(
        "flex h-full flex-col justify-center overflow-hidden rounded-xl border border-emerald-200/70 bg-emerald-950/60 shadow-[0_0_28px_rgba(16,185,129,0.14)] backdrop-blur",
        isCurrentUserMatch && "border-primary/80 shadow-[0_0_34px_rgba(218,183,106,0.28)]",
      )}
    >
      <BracketTeamRow side={sides[0]} />
      <div className="h-px bg-emerald-200/35" />
      <BracketTeamRow side={sides[1]} />
    </div>
  );
}

function MatchCountBadge({ count }: { count: number }) {
  const label = count === 1 ? "матч" : count > 1 && count < 5 ? "матча" : "матчей";

  return (
    <span className="inline-flex shrink-0 items-center rounded-full border border-emerald-300/20 bg-emerald-300/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-100">
      {count} {label}
    </span>
  );
}

function MobileRoundMatch({
  series,
  clubsByUserId,
  isFinal = false,
  currentUserId,
}: {
  series: BracketSeries;
  clubsByUserId: Record<string, ClubMeta>;
  isFinal?: boolean;
  currentUserId?: string | null;
}) {
  return (
    <article className="overflow-hidden rounded-2xl border border-white/10 bg-black/20 shadow-[0_14px_34px_rgba(0,0,0,0.24)]">
      <div className="flex min-h-9 items-center justify-between gap-3 border-b border-white/10 px-3 py-2">
        <div className="min-w-0 truncate text-xs font-black uppercase tracking-[0.16em] text-zinc-300">{seriesLabel(series)}</div>
      </div>
      <div className="h-[92px]">
        <BracketMatchBox series={series} clubsByUserId={clubsByUserId} isFinal={isFinal} currentUserId={currentUserId} />
      </div>
    </article>
  );
}

function BracketConnector({
  startX,
  startY,
  endX,
  endY,
}: {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}) {
  const middleX = startX + (endX - startX) / 2;
  const path = `M ${startX} ${startY} H ${middleX} V ${endY} H ${endX}`;

  return <path d={path} fill="none" stroke="rgba(187,247,208,0.72)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />;
}

export function BracketView({
  matches,
  clubsByUserId = {},
  currentUserId,
}: {
  matches: BracketMatch[];
  clubsByUserId?: Record<string, ClubMeta>;
  currentUserId?: string | null;
}) {
  const seriesList = buildSeries(matches);
  const thirdPlaceSeries = seriesList.filter((series) => series.isThirdPlaceMatch);
  const mainSeriesList = seriesList.filter((series) => !series.isThirdPlaceMatch);
  const rounds = mainSeriesList.reduce<Map<number, BracketSeries[]>>((map, series) => {
    const bucket = map.get(series.round) ?? [];
    bucket.push(series);
    map.set(series.round, bucket);
    return map;
  }, new Map());

  const orderedRounds = Array.from(rounds.entries()).sort((a, b) => a[0] - b[0]);
  const totalRounds = orderedRounds.length;
  const [activeRound, setActiveRound] = useState(orderedRounds[0]?.[0] ?? 0);
  const activeRoundEntry = orderedRounds.find(([round]) => round === activeRound) ?? orderedRounds[0];
  const activeRoundIndex = Math.max(
    orderedRounds.findIndex(([round]) => round === activeRoundEntry?.[0]),
    0,
  );
  const activeRoundSeries = activeRoundEntry?.[1] ?? [];
  const shouldShowThirdPlaceOnMobile = activeRoundIndex === orderedRounds.length - 1 && thirdPlaceSeries.length > 0;
  const firstRoundSize = Math.max(orderedRounds[0]?.[1].length ?? 1, 1);
  const columnWidth = 280;
  const columnGap = 88;
  const titleHeight = 56;
  const slotHeight = 132;
  const matchHeight = 92;
  const boardWidth = orderedRounds.length * columnWidth + Math.max(orderedRounds.length - 1, 0) * columnGap;
  const boardHeight = Math.max(firstRoundSize * slotHeight, 260);
  const totalBoardHeight = titleHeight + boardHeight;

  const getCenterY = (roundIndex: number, matchIndex: number) => {
    const step = slotHeight * 2 ** roundIndex;
    const offset = (slotHeight * (2 ** roundIndex - 1)) / 2;
    return titleHeight + slotHeight / 2 + matchIndex * step + offset;
  };

  const getColumnX = (roundIndex: number) => roundIndex * (columnWidth + columnGap);

  useEffect(() => {
    if (!orderedRounds.length) return;
    if (!orderedRounds.some(([round]) => round === activeRound)) {
      setActiveRound(orderedRounds[0][0]);
    }
  }, [activeRound, orderedRounds]);

  return (
    <div className="overflow-hidden rounded-[2rem] border border-emerald-400/20 bg-[radial-gradient(circle_at_50%_45%,rgba(34,197,94,0.22),transparent_22%),radial-gradient(circle_at_18%_10%,rgba(16,185,129,0.2),transparent_26%),linear-gradient(135deg,#03180f_0%,#052817_48%,#02110b_100%)] shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
      <div className="relative overflow-hidden px-5 pb-2 pt-7 text-center sm:px-8 sm:pt-9">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(0deg,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:46px_46px] opacity-20" />
        <div className="relative mx-auto inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-black/25 px-4 py-2 text-xs uppercase tracking-[0.28em] text-emerald-100/80">
          <GitBranch className="h-4 w-4 text-emerald-300" />
          Плей-офф
        </div>
      </div>

      <div className="px-3 pb-5 pt-3 md:hidden">
        {orderedRounds.length ? (
          <div className="space-y-4">
            <div className="-mx-3 overflow-x-auto px-3 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <div className="flex min-w-max gap-2">
                {orderedRounds.map(([round, roundSeries]) => {
                  const active = round === activeRoundEntry?.[0];

                  return (
                    <button
                      key={round}
                      type="button"
                      onClick={() => setActiveRound(round)}
                      className={cn(
                        "inline-flex h-10 shrink-0 items-center gap-2 rounded-full border px-3 text-xs font-black uppercase tracking-[0.12em] transition",
                        active
                          ? "border-emerald-200/50 bg-emerald-300/16 text-white shadow-[0_0_24px_rgba(16,185,129,0.16)]"
                          : "border-white/10 bg-black/25 text-zinc-400 hover:border-emerald-300/25 hover:text-zinc-100",
                      )}
                    >
                      {roundTitle(round, totalRounds)}
                      <span className={cn("rounded-full px-1.5 py-0.5 text-[10px]", active ? "bg-white/15 text-emerald-50" : "bg-white/8 text-zinc-500")}>
                        {roundSeries.length}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-base font-black text-white">{roundTitle(activeRoundEntry?.[0] ?? 1, totalRounds)}</div>
                  <div className="mt-0.5 text-xs text-zinc-400">Матчи выбранной стадии</div>
                </div>
                <MatchCountBadge count={activeRoundSeries.length + (shouldShowThirdPlaceOnMobile ? thirdPlaceSeries.length : 0)} />
              </div>

              <div className="grid gap-3">
                {activeRoundSeries.map((series) => (
                  <MobileRoundMatch
                    key={series.key}
                    series={series}
                    clubsByUserId={clubsByUserId}
                    isFinal={activeRoundIndex === orderedRounds.length - 1}
                    currentUserId={currentUserId}
                  />
                ))}

                {shouldShowThirdPlaceOnMobile ? (
                  <div className="space-y-3 border-t border-white/10 pt-3">
                    <div className="text-xs font-black uppercase tracking-[0.16em] text-amber-100">Матч за 3-е место</div>
                    {thirdPlaceSeries.map((series) => (
                      <MobileRoundMatch key={series.key} series={series} clubsByUserId={clubsByUserId} currentUserId={currentUserId} />
                    ))}
                  </div>
                ) : null}

                {!activeRoundSeries.length && !shouldShowThirdPlaceOnMobile ? (
                  <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] p-5 text-center text-sm text-zinc-500">
                    Матчи этой стадии пока не сформированы.
                  </div>
                ) : null}
              </div>
            </div>

            <div className="rounded-2xl border border-emerald-300/15 bg-emerald-300/8 px-3 py-2 text-xs leading-5 text-emerald-50/80">
              Полная турнирная сетка доступна на версии для планшетов и ПК.
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-5 text-center text-sm text-zinc-500">
            Сетка появится после формирования матчей.
          </div>
        )}
      </div>

      <div className="hidden overflow-x-auto px-3 pb-6 pt-4 sm:px-7 sm:pb-8 sm:pt-5 md:block">
        <div
          className="relative min-w-max [height:calc(var(--bracket-height)*0.78)] [width:calc(var(--bracket-width)*0.78)] sm:[height:var(--bracket-height)] sm:[width:var(--bracket-width)]"
          style={{ "--bracket-width": `${boardWidth}px`, "--bracket-height": `${totalBoardHeight}px` } as CSSProperties}
        >
          <div className="absolute left-0 top-0 origin-top-left scale-[0.78] sm:scale-100" style={{ width: boardWidth, height: totalBoardHeight }}>
            <svg
              className="pointer-events-none absolute inset-0 z-0 overflow-visible"
              width={boardWidth}
              height={totalBoardHeight}
              viewBox={`0 0 ${boardWidth} ${totalBoardHeight}`}
              aria-hidden="true"
            >
            <defs>
              <filter id="bracketLineGlow" x="-30%" y="-30%" width="160%" height="160%">
                <feGaussianBlur stdDeviation="2.5" result="coloredBlur" />
                <feMerge>
                  <feMergeNode in="coloredBlur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            <g filter="url(#bracketLineGlow)">
              {orderedRounds.slice(0, -1).flatMap(([, roundSeries], roundIndex) =>
                roundSeries.map((series, matchIndex) => {
                  const targetIndex = Math.floor(matchIndex / 2);
                  const startX = getColumnX(roundIndex) + columnWidth;
                  const startY = getCenterY(roundIndex, matchIndex);
                  const endX = getColumnX(roundIndex + 1);
                  const endY = getCenterY(roundIndex + 1, targetIndex);

                  return (
                    <BracketConnector
                      key={`${series.key}-connector`}
                      startX={startX}
                      startY={startY}
                      endX={endX}
                      endY={endY}
                    />
                  );
                }),
              )}
            </g>
            </svg>

            {orderedRounds.map(([round, roundSeries], roundIndex) => (
              <div
                key={round}
                className="absolute top-0 z-10"
                style={{
                  left: getColumnX(roundIndex),
                  width: columnWidth,
                }}
              >
                <div className="h-12 text-center text-lg font-black text-white">{roundTitle(round, totalRounds)}</div>

                {roundSeries.map((series, matchIndex) => (
                  <div
                    key={series.key}
                    className="absolute left-0 w-full -translate-y-1/2"
                    style={{
                      top: getCenterY(roundIndex, matchIndex),
                      height: matchHeight,
                    }}
                  >
                    <BracketMatchBox series={series} clubsByUserId={clubsByUserId} isFinal={roundIndex === orderedRounds.length - 1} currentUserId={currentUserId} />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        {thirdPlaceSeries.length ? (
          <div
            className="mt-6 min-w-max [height:calc(var(--third-place-height)*0.78)] [width:calc(var(--third-place-width)*0.78)] sm:mt-8 sm:[height:var(--third-place-height)] sm:[width:var(--third-place-width)]"
            style={{ "--third-place-width": `${columnWidth}px`, "--third-place-height": `${thirdPlaceSeries.length * matchHeight + Math.max(thirdPlaceSeries.length - 1, 0) * 16}px` } as CSSProperties}
          >
            <div className="grid origin-top-left scale-[0.78] gap-4 sm:scale-100" style={{ width: columnWidth }}>
              {thirdPlaceSeries.map((series) => (
                <div key={series.key} style={{ height: matchHeight }}>
                  <BracketMatchBox series={series} clubsByUserId={clubsByUserId} currentUserId={currentUserId} />
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
