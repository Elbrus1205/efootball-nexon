import { Match, MatchStatus, TournamentRegistration, User } from "@prisma/client";
import { GitBranch } from "lucide-react";
import Link from "next/link";
import type { CSSProperties } from "react";
import { getPlayerDisplayName } from "@/lib/player-name";

type ClubMeta = {
  clubName?: string | null;
  clubBadgePath?: string | null;
};

type BracketMatch = Match & {
  player1: User | null;
  player2: User | null;
  winner: User | null;
  participant1Entry: TournamentRegistration | null;
  participant2Entry: TournamentRegistration | null;
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
  isWinner: boolean;
};

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
  return match.status === MatchStatus.CONFIRMED || match.status === MatchStatus.FINISHED;
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

  const confirmedBaseMatches = series.regularMatches.filter((item) => (item.legNumber ?? 1) <= 2 && isResolvedMatch(item));
  if (!confirmedBaseMatches.length) {
    return null;
  }

  const aggregatePlayer1 = confirmedBaseMatches.reduce((sum, item) => sum + (item.player1Score ?? 0), 0);
  const aggregatePlayer2 = confirmedBaseMatches.reduce((sum, item) => sum + (item.player2Score ?? 0), 0);

  if (aggregatePlayer1 === aggregatePlayer2) {
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
    return null;
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
  return (
    <div className="grid min-h-12 grid-cols-[34px_minmax(0,1fr)_42px] items-center gap-2 px-3 py-2 text-zinc-200">
      <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-lg border border-white/15 bg-black/30">
        {side.badgePath ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={side.badgePath} alt={side.clubName ?? side.playerName} className="h-full w-full object-contain p-1" />
        ) : (
          <span className="text-[10px] uppercase text-zinc-500">FC</span>
        )}
      </div>

      <div className="min-w-0">
        <div className="truncate text-sm font-semibold leading-tight text-white">{side.clubName ?? "Клуб не назначен"}</div>
        {side.playerId ? (
          <Link
            href={`/players/${side.playerId}`}
            className="mt-0.5 block truncate text-[11px] font-medium leading-tight text-zinc-400 underline-offset-4 transition hover:text-primary hover:underline"
          >
            {side.playerName}
          </Link>
        ) : (
          <div className="mt-0.5 truncate text-[11px] font-medium leading-tight text-zinc-500">{side.playerName}</div>
        )}
      </div>

      <div className="flex items-baseline justify-end gap-1 text-right">
        <span className="text-lg font-black leading-none text-white">{side.score ?? "-"}</span>
        {side.penaltyText ? <span className="text-xs font-black leading-none text-amber-300">({side.penaltyText})</span> : null}
      </div>
    </div>
  );
}

function BracketMatchBox({
  series,
  clubsByUserId,
}: {
  series: BracketSeries;
  clubsByUserId: Record<string, ClubMeta>;
}) {
  const match = series.referenceMatch;
  const playerOneClub = resolveClubMeta(match, 1, clubsByUserId);
  const playerTwoClub = resolveClubMeta(match, 2, clubsByUserId);
  const aggregateScore = getAggregateScore(series);
  const penaltyScores = getPenaltyScores(series);
  const seriesWinnerId = getSeriesWinner(series);

  const sides: [BracketSide, BracketSide] = [
    {
      playerId: match.player1?.id,
      playerName: match.player1 ? getPlayerDisplayName(match.player1) : "Игрок не назначен",
      clubName: playerOneClub.clubName,
      badgePath: playerOneClub.clubBadgePath,
      score: aggregateScore.player1,
      penaltyText: penaltyScores ? String(penaltyScores.player1) : null,
      isWinner: Boolean(seriesWinnerId && seriesWinnerId === match.player1Id),
    },
    {
      playerId: match.player2?.id,
      playerName: match.player2 ? getPlayerDisplayName(match.player2) : "Игрок не назначен",
      clubName: playerTwoClub.clubName,
      badgePath: playerTwoClub.clubBadgePath,
      score: aggregateScore.player2,
      penaltyText: penaltyScores ? String(penaltyScores.player2) : null,
      isWinner: Boolean(seriesWinnerId && seriesWinnerId === match.player2Id),
    },
  ];

  return (
    <div
      data-match-label={seriesLabel(series)}
      className="flex h-full flex-col justify-center overflow-hidden rounded-xl border border-emerald-200/70 bg-emerald-950/60 shadow-[0_0_28px_rgba(16,185,129,0.14)] backdrop-blur"
    >
      <BracketTeamRow side={sides[0]} />
      <div className="h-px bg-emerald-200/35" />
      <BracketTeamRow side={sides[1]} />
    </div>
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
}: {
  matches: BracketMatch[];
  clubsByUserId?: Record<string, ClubMeta>;
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
  const firstRoundSize = Math.max(orderedRounds[0]?.[1].length ?? 1, 1);
  const columnWidth = 280;
  const columnGap = 88;
  const titleHeight = 56;
  const slotHeight = 150;
  const matchHeight = 122;
  const boardWidth = orderedRounds.length * columnWidth + Math.max(orderedRounds.length - 1, 0) * columnGap;
  const boardHeight = Math.max(firstRoundSize * slotHeight, 260);
  const totalBoardHeight = titleHeight + boardHeight;

  const getCenterY = (roundIndex: number, matchIndex: number) => {
    const step = slotHeight * 2 ** roundIndex;
    const offset = (slotHeight * (2 ** roundIndex - 1)) / 2;
    return titleHeight + slotHeight / 2 + matchIndex * step + offset;
  };

  const getColumnX = (roundIndex: number) => roundIndex * (columnWidth + columnGap);

  return (
    <div className="overflow-hidden rounded-[2rem] border border-emerald-400/20 bg-[radial-gradient(circle_at_50%_45%,rgba(34,197,94,0.22),transparent_22%),radial-gradient(circle_at_18%_10%,rgba(16,185,129,0.2),transparent_26%),linear-gradient(135deg,#03180f_0%,#052817_48%,#02110b_100%)] shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
      <div className="relative overflow-hidden px-5 pb-2 pt-7 text-center sm:px-8 sm:pt-9">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(0deg,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:46px_46px] opacity-20" />
        <div className="relative mx-auto inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-black/25 px-4 py-2 text-xs uppercase tracking-[0.28em] text-emerald-100/80">
          <GitBranch className="h-4 w-4 text-emerald-300" />
          Плей-офф
        </div>
      </div>
      <div className="overflow-x-auto px-3 pb-6 pt-4 sm:px-7 sm:pb-8 sm:pt-5">
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
                    <BracketMatchBox series={series} clubsByUserId={clubsByUserId} />
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
                  <BracketMatchBox series={series} clubsByUserId={clubsByUserId} />
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
