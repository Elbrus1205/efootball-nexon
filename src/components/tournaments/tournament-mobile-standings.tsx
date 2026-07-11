import { ChevronDown, Trophy } from "lucide-react";
import { ClubPlayerLine } from "@/components/tournaments/club-player-line";
import type { LeagueRow, StandingHighlight } from "@/lib/tournament-public-view";
import { cn } from "@/lib/utils";

function goalDifference(value: number) {
  return value > 0 ? `+${value}` : String(value);
}

export function TournamentMobileStandings({ rows, highlights }: { rows: LeagueRow[]; highlights: StandingHighlight[] }) {
  return (
    <ol className="grid gap-2 md:hidden" aria-label="Турнирная таблица">
      {rows.map((row, index) => {
        const rank = index + 1;
        const highlight = highlights.find((item) => rank >= item.fromRank && rank <= item.toRank);
        return (
          <li key={row.id}>
            <details className="group overflow-hidden rounded-2xl border border-white/10 bg-white/[0.025] open:border-primary/25 open:bg-white/[0.04]">
              <summary className="flex min-h-20 cursor-pointer list-none items-center gap-3 p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/70 [&::-webkit-details-marker]:hidden">
                <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border text-sm font-bold tabular-nums", highlight ? "border-primary/30 bg-primary/10 text-primary" : "border-white/10 bg-black/20 text-zinc-300")}>
                  {rank}
                </span>
                <div className="min-w-0 flex-1">
                  <ClubPlayerLine clubName={row.clubName} badgePath={row.clubBadgePath} playerId={row.playerId} playerName={row.playerName} compact />
                  {highlight ? <div className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-emerald-200"><Trophy className="h-3 w-3" />{highlight.label}</div> : null}
                </div>
                <div className="shrink-0 text-right tabular-nums">
                  <div className="text-lg font-black text-white">{row.points}</div>
                  <div className={cn("text-xs font-semibold", row.goalDifference > 0 ? "text-emerald-300" : row.goalDifference < 0 ? "text-rose-300" : "text-zinc-400")}>± {goalDifference(row.goalDifference)}</div>
                </div>
                <ChevronDown className="h-4 w-4 shrink-0 text-zinc-500 transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none" aria-hidden="true" />
              </summary>
              <div className="grid grid-cols-4 border-t border-white/10 bg-black/20 px-3 py-3 text-center tabular-nums">
                {[["Игры", row.played], ["Победы", row.wins], ["Ничьи", row.draws], ["Поражения", row.losses]].map(([label, value]) => (
                  <div key={label}>
                    <div className="text-sm font-bold text-white">{value}</div>
                    <div className="mt-0.5 text-[10px] uppercase tracking-wide text-zinc-500">{label}</div>
                  </div>
                ))}
              </div>
            </details>
          </li>
        );
      })}
    </ol>
  );
}
