import { CheckCircle2, ChevronDown, Circle, Flag, ShieldCheck, Sparkles, Trophy } from "lucide-react";
import Image from "next/image";
import { Card } from "@/components/ui/card";
import type { AchievementAccent, AchievementGroupProgress } from "@/lib/achievements";
import { cn } from "@/lib/utils";

const accentClassName: Record<AchievementAccent, { border: string; bg: string; text: string; bar: string; icon: string }> = {
  gold: {
    border: "border-amber-300/25",
    bg: "bg-amber-300/[0.08]",
    text: "text-amber-100",
    bar: "bg-amber-300",
    icon: "text-amber-200",
  },
  green: {
    border: "border-lime-300/25",
    bg: "bg-lime-300/[0.08]",
    text: "text-lime-100",
    bar: "bg-lime-300",
    icon: "text-lime-200",
  },
  blue: {
    border: "border-sky-300/25",
    bg: "bg-sky-300/[0.08]",
    text: "text-sky-100",
    bar: "bg-sky-300",
    icon: "text-sky-200",
  },
  violet: {
    border: "border-violet-300/25",
    bg: "bg-violet-300/[0.08]",
    text: "text-violet-100",
    bar: "bg-violet-300",
    icon: "text-violet-200",
  },
  rose: {
    border: "border-rose-300/25",
    bg: "bg-rose-300/[0.08]",
    text: "text-rose-100",
    bar: "bg-rose-300",
    icon: "text-rose-200",
  },
  zinc: {
    border: "border-white/10",
    bg: "bg-white/[0.045]",
    text: "text-zinc-100",
    bar: "bg-zinc-200",
    icon: "text-zinc-200",
  },
};

function formatNumber(value: number) {
  return new Intl.NumberFormat("ru-RU").format(value);
}

function PlaceholderVisual({ group }: { group: AchievementGroupProgress }) {
  const accent = accentClassName[group.accent];
  const Icon = group.key === "registered" ? Sparkles : group.key === "played" ? Flag : group.key === "clean_sheets" ? ShieldCheck : Trophy;

  return (
    <div className={cn("flex aspect-[5/1] items-center justify-between overflow-hidden rounded-lg border px-3 sm:px-4", accent.border, accent.bg)}>
      <div className="min-w-0">
        <div className={cn("text-[11px] font-semibold uppercase tracking-[0.16em]", accent.icon)}>Достижение</div>
        <div className="mt-1 truncate text-sm font-semibold text-white sm:text-base">{group.title}</div>
      </div>
      <Icon className={cn("h-7 w-7 shrink-0 sm:h-9 sm:w-9", accent.icon)} />
    </div>
  );
}

function AchievementVisual({ group }: { group: AchievementGroupProgress }) {
  if (!group.imagePath) return <PlaceholderVisual group={group} />;

  return (
    <div className="overflow-hidden rounded-lg border border-white/10 bg-black/40">
      <Image
        src={group.imagePath}
        alt={group.currentLevel?.title ?? group.title}
        width={800}
        height={160}
        loading="lazy"
        sizes="(min-width: 1024px) 50vw, 100vw"
        className="h-auto max-h-24 w-full object-contain sm:max-h-32"
      />
    </div>
  );
}

export function PlayerAchievementsPanel({ achievements }: { achievements: AchievementGroupProgress[] }) {
  const unlockedTotal = achievements.reduce((sum, group) => sum + group.unlockedCount, 0);
  const total = achievements.reduce((sum, group) => sum + group.totalCount, 0);

  return (
    <Card className="rounded-lg p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="font-semibold text-white">Достижения</div>
          <div className="mt-1 text-sm text-zinc-500">
            Открыто {unlockedTotal} из {total}
          </div>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs font-semibold text-zinc-200">
          {total ? Math.round((unlockedTotal / total) * 100) : 0}%
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {achievements.map((group) => {
          const accent = accentClassName[group.accent];
          const nextTarget = group.nextLevel?.target ?? group.currentLevel?.target ?? 1;
          const progressPercent = group.nextLevel
            ? Math.min(100, Math.round((group.value / group.nextLevel.target) * 100))
            : 100;

          return (
            <details key={group.key} className={cn("group overflow-hidden rounded-lg border bg-black/20", accent.border)}>
              <summary className="cursor-pointer list-none p-2.5 marker:hidden sm:p-3">
                <AchievementVisual group={group} />
                <div className="mt-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-white sm:text-base">{group.title}</div>
                    <div className="mt-1 text-xs text-zinc-500">
                      {group.metricLabel}: {formatNumber(group.value)}
                      {group.nextLevel ? ` / ${formatNumber(group.nextLevel.target)}` : ""}
                    </div>
                  </div>
                  <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-zinc-500 transition group-open:rotate-180" />
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div className={cn("h-full rounded-full", accent.bar)} style={{ width: `${progressPercent}%` }} />
                </div>
                <div className="mt-2 text-xs text-zinc-500">
                  {group.nextLevel
                    ? `До следующего уровня: ${formatNumber(Math.max(0, nextTarget - group.value))}`
                    : "Все уровни этой категории открыты"}
                </div>
              </summary>

              <div className="grid gap-2 border-t border-white/10 p-2.5 pt-3 sm:p-3">
                {group.levels.map((level) => (
                  <div
                    key={level.key}
                    className={cn(
                      "grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-lg border border-white/10 bg-white/[0.035] px-2.5 py-2",
                      level.unlocked && `${accent.border} ${accent.bg}`,
                    )}
                  >
                    {level.unlocked ? (
                      <CheckCircle2 className={cn("h-4 w-4", accent.icon)} />
                    ) : (
                      <Circle className="h-4 w-4 text-zinc-600" />
                    )}
                    <div className="min-w-0">
                      <div className={cn("truncate text-xs font-medium sm:text-sm", level.unlocked ? accent.text : "text-zinc-300")}>
                        {level.shortTitle}
                      </div>
                      <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/10">
                        <div className={cn("h-full rounded-full", level.unlocked ? accent.bar : "bg-zinc-600")} style={{ width: `${level.progressPercent}%` }} />
                      </div>
                    </div>
                    <div className="text-[11px] font-semibold text-zinc-500 sm:text-xs">
                      {formatNumber(Math.min(level.value, level.target))}/{formatNumber(level.target)}
                    </div>
                  </div>
                ))}
              </div>
            </details>
          );
        })}
      </div>
    </Card>
  );
}
