import { Match, MatchStatus, TournamentRegistration, User } from "@prisma/client";
import { GitBranch, Trophy } from "lucide-react";
import { ClubPlayerLine } from "@/components/tournaments/club-player-line";
import { Card } from "@/components/ui/card";
import { getPlayerDisplayName } from "@/lib/player-name";
import { cn } from "@/lib/utils";

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

function getPenaltyText(series: BracketSeries) {
  if (!series.penaltyMatch || !isResolvedMatch(series.penaltyMatch)) {
    return null;
  }

  if (series.penaltyMatch.player1Score === null || series.penaltyMatch.player2Score === null) {
    return null;
  }

  return `пен. ${series.penaltyMatch.player1Score}:${series.penaltyMatch.player2Score}`;
}

export function BracketView({
  matches,
  clubsByUserId = {},
}: {
  matches: BracketMatch[];
  clubsByUserId?: Record<string, ClubMeta>;
}) {
  const seriesList = buildSeries(matches);
  const rounds = seriesList.reduce<Map<number, BracketSeries[]>>((map, series) => {
    const bucket = map.get(series.round) ?? [];
    bucket.push(series);
    map.set(series.round, bucket);
    return map;
  }, new Map());

  const orderedRounds = Array.from(rounds.entries()).sort((a, b) => a[0] - b[0]);
  const totalRounds = orderedRounds.length;

  return (
    <div className="overflow-hidden rounded-[2rem] border border-primary/15 bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.14),transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-black/20 px-5 py-4 backdrop-blur-xl">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.24em] text-primary">
            <GitBranch className="h-4 w-4" />
            Плей-офф
          </div>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/20 bg-amber-400/10 px-4 py-2 text-sm text-amber-200">
          <Trophy className="h-4 w-4" />
          Финальная часть
        </div>
      </div>

      <div className="overflow-x-auto px-4 py-5">
        <div className="flex min-w-max gap-5">
          {orderedRounds.map(([round, roundSeries]) => (
            <div key={round} className="w-[320px] shrink-0 space-y-4">
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-medium text-white">
                {roundTitle(round, totalRounds)}
              </div>

              {roundSeries.map((series) => {
                const match = series.referenceMatch;
                const playerOneClub = resolveClubMeta(match, 1, clubsByUserId);
                const playerTwoClub = resolveClubMeta(match, 2, clubsByUserId);
                const aggregateScore = getAggregateScore(series);
                const penaltyText = getPenaltyText(series);
                const seriesWinnerId = getSeriesWinner(series);

                return (
                  <Card key={series.key} className="space-y-4 border-white/10 bg-black/20 p-4">
                    <div className="text-xs uppercase tracking-[0.2em] text-zinc-500">{seriesLabel(series)}</div>

                    <div className="space-y-3">
                      <div
                        className={cn(
                          "rounded-2xl border p-3",
                          seriesWinnerId && seriesWinnerId === match.player1Id
                            ? "border-emerald-400/20 bg-emerald-400/5"
                            : "border-white/10 bg-white/[0.03]",
                        )}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <ClubPlayerLine
                            playerId={match.player1?.id}
                            playerName={match.player1 ? getPlayerDisplayName(match.player1) : "Игрок не назначен"}
                            clubName={playerOneClub.clubName}
                            badgePath={playerOneClub.clubBadgePath}
                          />
                          <div className="text-lg font-semibold text-white">{aggregateScore.player1 ?? "-"}</div>
                        </div>
                      </div>

                      <div
                        className={cn(
                          "rounded-2xl border p-3",
                          seriesWinnerId && seriesWinnerId === match.player2Id
                            ? "border-emerald-400/20 bg-emerald-400/5"
                            : "border-white/10 bg-white/[0.03]",
                        )}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <ClubPlayerLine
                            playerId={match.player2?.id}
                            playerName={match.player2 ? getPlayerDisplayName(match.player2) : "Игрок не назначен"}
                            clubName={playerTwoClub.clubName}
                            badgePath={playerTwoClub.clubBadgePath}
                          />
                          <div className="flex items-center gap-2 text-right">
                            {penaltyText ? <span className="text-xs font-medium text-amber-300">{penaltyText}</span> : null}
                            <span className="text-lg font-semibold text-white">{aggregateScore.player2 ?? "-"}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
