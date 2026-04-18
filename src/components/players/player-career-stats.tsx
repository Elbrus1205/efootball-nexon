import { BarChart3, Percent, Shield, Target, Trophy } from "lucide-react";
import type { PlayerCareerStats } from "@/lib/player-stats";

function formatGoalDifference(value: number) {
  if (value > 0) return `+${value}`;
  return String(value);
}

export function PlayerCareerStatsPanel({ stats }: { stats: PlayerCareerStats }) {
  const resultItems = [
    { label: "Победы", value: stats.wins, className: "border-emerald-300/25 bg-emerald-400/10 text-emerald-100" },
    { label: "Ничьи", value: stats.draws, className: "border-sky-300/25 bg-sky-400/10 text-sky-100" },
    { label: "Поражения", value: stats.losses, className: "border-rose-300/25 bg-rose-400/10 text-rose-100" },
  ];

  const statItems = [
    { label: "Забито", value: stats.goalsFor, icon: Target },
    { label: "Пропущено", value: stats.goalsAgainst, icon: Shield },
    { label: "Разница", value: formatGoalDifference(stats.goalDifference), icon: BarChart3 },
  ];

  return (
    <section className="rounded-lg border border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.06),rgba(255,255,255,0.025))] p-4 shadow-[0_18px_45px_rgba(0,0,0,0.22)] sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">Статистика игрока</div>
          <div className="mt-2 flex items-end gap-2">
            <span className="text-3xl font-black leading-none text-white">{stats.played}</span>
            <span className="pb-1 text-sm font-semibold text-zinc-400">матчей</span>
          </div>
        </div>
        <div className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-amber-300/25 bg-amber-400/10 px-3 py-2 text-sm font-black text-amber-100">
          <Percent className="h-4 w-4" />
          {stats.winRate}%
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        {resultItems.map((item) => (
          <div key={item.label} className={`rounded-lg border px-3 py-2.5 ${item.className}`}>
            <div className="text-[10px] font-bold uppercase text-current/70">{item.label}</div>
            <div className="mt-1 text-xl font-black leading-none text-white">{item.value}</div>
          </div>
        ))}
      </div>

      <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
        {statItems.map((item) => (
          <div key={item.label} className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-black/20 px-3 py-2.5">
            <div>
              <div className="text-[10px] font-bold uppercase text-zinc-500">{item.label}</div>
              <div className="mt-1 text-xl font-black leading-none text-white">{item.value}</div>
            </div>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
              <item.icon className="h-4 w-4" />
            </div>
          </div>
        ))}
      </div>

      {!stats.played ? (
        <div className="mt-3 rounded-lg border border-dashed border-white/10 bg-black/20 px-3 py-2 text-xs font-medium text-zinc-500">
          Статистика появится после подтверждения первых результатов.
        </div>
      ) : (
        <div className="mt-3 flex items-center gap-2 text-xs font-medium text-zinc-500">
          <Trophy className="h-4 w-4 text-amber-200" />
          Учитываются подтверждённые матчи без отдельных пенальти-серий.
        </div>
      )}
    </section>
  );
}
