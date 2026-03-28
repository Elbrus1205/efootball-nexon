import { Match, TournamentRegistration, User } from "@prisma/client";
import { GitBranch, Trophy } from "lucide-react";
import { ClubPlayerLine } from "@/components/tournaments/club-player-line";
import { Card } from "@/components/ui/card";
import { matchStatusLabel, matchStatusVariant } from "@/lib/admin-display";
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

function roundTitle(round: number) {
  if (round === 1) return "1/8 финала";
  if (round === 2) return "1/4 финала";
  if (round === 3) return "1/2 финала";
  if (round === 4) return "Финал";
  return `Раунд ${round}`;
}

function statusClasses(status: BracketMatch["status"]) {
  const variant = matchStatusVariant[status] ?? "neutral";
  if (variant === "success") return "border-emerald-400/20 bg-emerald-400/10 text-emerald-200";
  if (variant === "danger") return "border-red-400/20 bg-red-400/10 text-red-200";
  if (variant === "accent") return "border-cyan-400/20 bg-cyan-400/10 text-cyan-200";
  if (variant === "primary") return "border-primary/20 bg-primary/10 text-primary";
  return "border-white/10 bg-white/5 text-zinc-300";
}

function bracketLabel(match: BracketMatch) {
  if (match.bracket === "lower") {
    return `Lower bracket • Матч #${match.matchNumber}`;
  }

  if (match.loserNextMatchId || match.loserNextMatchSlot) {
    return `Upper bracket • Матч #${match.matchNumber}`;
  }

  return `Матч #${match.matchNumber}`;
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

export function BracketView({
  matches,
  clubsByUserId = {},
}: {
  matches: BracketMatch[];
  clubsByUserId?: Record<string, ClubMeta>;
}) {
  const rounds = matches.reduce<Map<number, BracketMatch[]>>((map, match) => {
    const bucket = map.get(match.round) ?? [];
    bucket.push(match);
    map.set(match.round, bucket);
    return map;
  }, new Map());

  const orderedRounds = Array.from(rounds.entries()).sort((a, b) => a[0] - b[0]);

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
          {orderedRounds.map(([round, roundMatches]) => (
            <div key={round} className="w-[320px] shrink-0 space-y-4">
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-medium text-white">
                {roundTitle(round)}
              </div>

              {roundMatches.map((match) => {
                const playerOneClub = resolveClubMeta(match, 1, clubsByUserId);
                const playerTwoClub = resolveClubMeta(match, 2, clubsByUserId);

                return (
                  <Card key={match.id} className="space-y-4 border-white/10 bg-black/20 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                        {bracketLabel(match)}
                      </div>
                      <div className={cn("rounded-full border px-3 py-1 text-xs", statusClasses(match.status))}>
                        {matchStatusLabel[match.status] ?? match.status}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div
                        className={cn(
                          "rounded-2xl border p-3",
                          match.winnerId === match.player1Id
                            ? "border-emerald-400/20 bg-emerald-400/5"
                            : "border-white/10 bg-white/[0.03]",
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <ClubPlayerLine
                            playerId={match.player1?.id}
                            playerName={match.player1?.nickname ?? match.player1?.name ?? "Игрок не назначен"}
                            clubName={playerOneClub.clubName}
                            badgePath={playerOneClub.clubBadgePath}
                          />
                          <div className="text-lg font-semibold text-white">{match.player1Score ?? "-"}</div>
                        </div>
                      </div>

                      <div
                        className={cn(
                          "rounded-2xl border p-3",
                          match.winnerId === match.player2Id
                            ? "border-emerald-400/20 bg-emerald-400/5"
                            : "border-white/10 bg-white/[0.03]",
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <ClubPlayerLine
                            playerId={match.player2?.id}
                            playerName={match.player2?.nickname ?? match.player2?.name ?? "Игрок не назначен"}
                            clubName={playerTwoClub.clubName}
                            badgePath={playerTwoClub.clubBadgePath}
                          />
                          <div className="text-lg font-semibold text-white">{match.player2Score ?? "-"}</div>
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
