import { ClubPlayerLine } from "@/components/tournaments/club-player-line";
import { TournamentMobileStandings } from "@/components/tournaments/tournament-mobile-standings";
import type { LeagueRow, StandingHighlight } from "@/lib/tournament-public-view";
import { cn } from "@/lib/utils";

function rankRange(fromRank: number, toRank: number) {
  return fromRank === toRank ? `${fromRank} место` : `${fromRank}–${toRank} места`;
}

function eliminatedRanges(highlights: StandingHighlight[], totalRows: number) {
  const occupied = new Set<number>();
  highlights.forEach((item) => {
    for (let rank = item.fromRank; rank <= item.toRank; rank += 1) occupied.add(rank);
  });
  const ranges: Array<{ fromRank: number; toRank: number }> = [];
  let start: number | null = null;
  for (let rank = 1; rank <= totalRows; rank += 1) {
    if (!occupied.has(rank)) {
      start ??= rank;
    } else if (start !== null) {
      ranges.push({ fromRank: start, toRank: rank - 1 });
      start = null;
    }
  }
  if (start !== null) ranges.push({ fromRank: start, toRank: totalRows });
  return ranges;
}

export function TournamentStandings({ rows, highlights = [] }: { rows: LeagueRow[]; highlights?: StandingHighlight[] }) {
  const ordered = [...highlights].sort((a, b) => a.fromRank - b.fromRank || a.toRank - b.toRank);
  const eliminated = eliminatedRanges(ordered, rows.length);

  return (
    <div className="min-w-0 space-y-3">
      <TournamentMobileStandings rows={rows} highlights={ordered} />
      <div className="hidden max-h-[36rem] overflow-auto rounded-2xl border border-white/10 md:block">
        <table className="w-full min-w-[720px] text-left text-sm tabular-nums">
          <thead className="sticky top-0 z-10 bg-[#11161c]/95 text-[10px] uppercase tracking-[0.16em] text-zinc-400 backdrop-blur-xl">
            <tr>{["№", "Клуб и игрок", "И", "В", "Н", "П", "+/−", "Очки"].map((label, index) => <th key={label} scope="col" className={cn("border-b border-white/10 px-3 py-3", index > 1 && "text-center")}>{label}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const rank = index + 1;
              const highlight = ordered.find((item) => rank >= item.fromRank && rank <= item.toRank);
              return (
                <tr key={row.id} className={cn("border-t border-white/[0.07] transition-colors hover:bg-white/[0.025]", highlight && "bg-emerald-400/[0.045]")}>
                  <td className="px-3 py-3 text-center"><span className={cn("inline-flex h-7 min-w-7 items-center justify-center rounded-lg border px-1 text-xs font-bold", highlight ? "border-emerald-300/30 bg-emerald-400/10 text-emerald-200" : "border-white/10 bg-black/20 text-zinc-300")}>{rank}</span></td>
                  <td className="min-w-64 px-3 py-3"><ClubPlayerLine clubName={row.clubName} badgePath={row.clubBadgePath} playerId={row.playerId} playerName={row.playerName} compact /></td>
                  {[row.played, row.wins, row.draws, row.losses].map((value, cellIndex) => <td key={cellIndex} className="px-3 py-3 text-center text-zinc-300">{value}</td>)}
                  <td className={cn("px-3 py-3 text-center font-semibold", row.goalDifference > 0 ? "text-emerald-300" : row.goalDifference < 0 ? "text-rose-300" : "text-zinc-300")}>{row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference}</td>
                  <td className="px-3 py-3 text-center text-base font-black text-white">{row.points}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {(ordered.length || eliminated.length) ? (
        <div className="flex flex-wrap gap-2 rounded-2xl border border-white/10 bg-white/[0.025] p-3" aria-label="Легенда турнирной таблицы">
          {ordered.map((item) => <span key={`${item.label}-${item.fromRank}`} className="inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-400/[0.07] px-3 py-1.5 text-xs text-zinc-300"><span className="h-2 w-2 rounded-full bg-emerald-300" /><strong className="text-white">{rankRange(item.fromRank, item.toRank)}</strong> → {item.label}</span>)}
          {eliminated.map((item) => <span key={`out-${item.fromRank}`} className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-xs text-zinc-400"><span className="h-2 w-2 rounded-full bg-zinc-500" /><strong className="text-zinc-200">{rankRange(item.fromRank, item.toRank)}</strong> → Вылет</span>)}
        </div>
      ) : null}
    </div>
  );
}
