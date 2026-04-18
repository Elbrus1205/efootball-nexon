import { BarChart3, Percent, Shield, Swords, Target, Trophy } from "lucide-react";
import type { PlayerCareerStats } from "@/lib/player-stats";

function formatGoalDifference(value: number) {
  if (value > 0) return `+${value}`;
  return String(value);
}

export function PlayerCareerStatsPanel({ stats }: { stats: PlayerCareerStats }) {
  const resultItems = [
    { label: "Победы", value: stats.wins, className: "border-emerald-300/25 bg-emerald-400/10 text-emerald-200" },
    { label: "Ничьи", value: stats.draws, className: "border-sky-300/25 bg-sky-400/10 text-sky-200" },
    { label: "Поражения", value: stats.losses, className: "border-rose-300/25 bg-rose-400/10 text-rose-200" },
  ];

  const statItems = [
    { label: "Матчей", value: stats.played, icon: Swords },
    { label: "Забито", value: stats.goalsFor, icon: Target },
    { label: "Пропущено", value: stats.goalsAgainst, icon: Shield },
    { label: "Разница", value: formatGoalDifference(stats.goalDifference), icon: BarChart3 },
  ];

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">Статистика игрока</div>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">Карьера за всё время</h2>
        </div>
        <div className="inline-flex items-center gap-2 rounded-lg border border-amber-300/25 bg-amber-400/10 px-3 py-2 text-sm font-black text-amber-100">
          <Percent className="h-4 w-4" />
          {stats.winRate}% побед
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="overflow-hidden rounded-[1.75rem] border border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.07),rgba(255,255,255,0.025))] p-4 shadow-[0_20px_60px_rgba(0,0,0,0.2)] sm:p-5">
          <div className="grid gap-3 sm:grid-cols-3">
            {resultItems.map((item) => (
              <div key={item.label} className={`rounded-xl border px-4 py-4 ${item.className}`}>
                <div className="text-xs font-semibold uppercase tracking-[0.18em] opacity-75">{item.label}</div>
                <div className="mt-3 text-3xl font-black leading-none text-white">{item.value}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {statItems.map((item) => (
            <div key={item.label} className="rounded-xl border border-white/10 bg-white/[0.045] px-4 py-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">{item.label}</div>
                  <div className="mt-2 text-2xl font-black text-white">{item.value}</div>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
                  <item.icon className="h-5 w-5" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {!stats.played ? (
        <div className="rounded-xl border border-dashed border-white/10 bg-black/20 px-4 py-3 text-sm text-zinc-500">
          Сыгранные матчи появятся здесь после подтверждения первых результатов.
        </div>
      ) : (
        <div className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-zinc-400">
          <Trophy className="h-4 w-4 text-amber-200" />
          Учитываются подтверждённые матчи без отдельных пенальти-серий.
        </div>
      )}
    </section>
  );
}
