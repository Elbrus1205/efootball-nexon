import { BarChart3, CircleEqual, ShieldAlert, Target, Trophy } from "lucide-react";
import type { ReactNode } from "react";
import type { PlayerCareerStats } from "@/lib/player-stats";

function formatGoalDifference(value: number) {
  if (value > 0) return `+${value}`;
  return String(value);
}

type PlayerCareerStatsPanelProps = {
  stats: PlayerCareerStats;
  periodLabel?: string;
  periodControl?: ReactNode;
};

export function PlayerCareerStatsPanel({ stats, periodLabel = "За всё время", periodControl }: PlayerCareerStatsPanelProps) {
  const resultItems = [
    { label: "Победы", value: stats.wins, icon: Trophy, className: "profile-stat-card--win" },
    { label: "Ничьи", value: stats.draws, icon: CircleEqual, className: "profile-stat-card--draw" },
    { label: "Поражения", value: stats.losses, icon: ShieldAlert, className: "profile-stat-card--loss" },
  ];

  const statItems = [
    { label: "Забито", value: stats.goalsFor, icon: Target, className: "profile-stat-card--scored" },
    { label: "Пропущено", value: stats.goalsAgainst, icon: ShieldAlert, className: "profile-stat-card--conceded" },
    {
      label: "Разница",
      value: formatGoalDifference(stats.goalDifference),
      icon: BarChart3,
      className: stats.goalDifference > 0 ? "profile-stat-card--positive" : stats.goalDifference < 0 ? "profile-stat-card--negative" : "profile-stat-card--neutral",
    },
  ];

  return (
    <section className="rounded-lg border border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.06),rgba(255,255,255,0.025))] p-4 shadow-[0_18px_45px_rgba(0,0,0,0.22)] sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <div className="min-w-0 text-[10px] font-semibold uppercase tracking-[0.14em] text-primary sm:text-xs sm:tracking-[0.22em]">Статистика игрока</div>
            {periodControl ? <div className="shrink-0">{periodControl}</div> : null}
          </div>
          <div className="mt-1 text-xs font-semibold text-zinc-500">{periodLabel}</div>
          <div className="mt-2 flex items-end gap-2">
            <span className="text-3xl font-black leading-none text-white">{stats.played}</span>
            <span className="pb-1 text-sm font-semibold text-zinc-400">матчей</span>
          </div>
        </div>
        <div className="inline-flex shrink-0 items-center rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-sm font-black text-primary">
          Винрейт {stats.winRate}%
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        {resultItems.map((item) => (
          <div key={item.label} className={`profile-stat-card rounded-lg px-3 py-2.5 ${item.className}`}>
            <div className="flex items-center justify-between gap-1">
              <div className="profile-stat-label truncate text-[10px] font-bold uppercase">{item.label}</div>
              <item.icon className="profile-stat-label h-3.5 w-3.5 shrink-0" />
            </div>
            <div className="mt-1 text-xl font-black leading-none text-white">{item.value}</div>
          </div>
        ))}
      </div>

      <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
        {statItems.map((item) => (
          <div key={item.label} className={`profile-stat-card flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 ${item.className}`}>
            <div>
              <div className="profile-stat-label text-[10px] font-bold uppercase">{item.label}</div>
              <div className="mt-1 text-xl font-black leading-none text-white">{item.value}</div>
            </div>
            <div className="profile-stat-icon flex h-8 w-8 shrink-0 items-center justify-center rounded-lg">
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
