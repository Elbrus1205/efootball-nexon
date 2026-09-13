export type StandingColorStyle = {
  rowClass: string;
  badgeClass: string;
  rankClass: string;
  dotClass: string;
};

// The order is intentional: first three zones are always Champions League,
// Europa League and Conference League. The remaining five colors are used for
// additional qualification paths in the order they are configured.
export const standingZoneColors = [
  {
    rowClass: "border-t border-blue-400/30 bg-blue-500/[0.09]",
    badgeClass: "inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-400/20 px-1 text-[10px] font-semibold text-blue-100",
    rankClass: "border-blue-400/35 bg-blue-400/15 text-blue-100",
    dotClass: "bg-blue-400",
  },
  {
    rowClass: "border-t border-amber-300/30 bg-amber-400/[0.10]",
    badgeClass: "inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-300/20 px-1 text-[10px] font-semibold text-amber-100",
    rankClass: "border-amber-300/40 bg-amber-300/15 text-amber-100",
    dotClass: "bg-amber-300",
  },
  {
    rowClass: "border-t border-emerald-400/30 bg-emerald-500/[0.09]",
    badgeClass: "inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-400/20 px-1 text-[10px] font-semibold text-emerald-100",
    rankClass: "border-emerald-400/35 bg-emerald-400/15 text-emerald-100",
    dotClass: "bg-emerald-400",
  },
  {
    rowClass: "border-t border-violet-400/30 bg-violet-500/[0.09]",
    badgeClass: "inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-violet-400/20 px-1 text-[10px] font-semibold text-violet-100",
    rankClass: "border-violet-400/35 bg-violet-400/15 text-violet-100",
    dotClass: "bg-violet-400",
  },
  {
    rowClass: "border-t border-cyan-400/30 bg-cyan-500/[0.09]",
    badgeClass: "inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-cyan-400/20 px-1 text-[10px] font-semibold text-cyan-100",
    rankClass: "border-cyan-400/35 bg-cyan-400/15 text-cyan-100",
    dotClass: "bg-cyan-400",
  },
  {
    rowClass: "border-t border-orange-400/30 bg-orange-500/[0.09]",
    badgeClass: "inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-orange-400/20 px-1 text-[10px] font-semibold text-orange-100",
    rankClass: "border-orange-400/35 bg-orange-400/15 text-orange-100",
    dotClass: "bg-orange-400",
  },
  {
    rowClass: "border-t border-fuchsia-400/30 bg-fuchsia-500/[0.09]",
    badgeClass: "inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-fuchsia-400/20 px-1 text-[10px] font-semibold text-fuchsia-100",
    rankClass: "border-fuchsia-400/35 bg-fuchsia-400/15 text-fuchsia-100",
    dotClass: "bg-fuchsia-400",
  },
  {
    rowClass: "border-t border-indigo-400/30 bg-indigo-500/[0.09]",
    badgeClass: "inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-indigo-400/20 px-1 text-[10px] font-semibold text-indigo-100",
    rankClass: "border-indigo-400/35 bg-indigo-400/15 text-indigo-100",
    dotClass: "bg-indigo-400",
  },
] as const satisfies readonly StandingColorStyle[];

export const relegationStyle = {
  rowClass: "border-t border-red-400/35 bg-red-500/[0.11]",
  badgeClass: "inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500/20 px-1 text-[10px] font-semibold text-red-100",
  rankClass: "border-red-400/45 bg-red-500/20 text-red-100",
  dotClass: "bg-red-400",
} as const satisfies StandingColorStyle;

export function getStandingZoneStyle(index: number) {
  const normalizedIndex = Number.isFinite(index) ? Math.trunc(index) : 0;
  const colorIndex = ((normalizedIndex % standingZoneColors.length) + standingZoneColors.length) % standingZoneColors.length;
  return standingZoneColors[colorIndex];
}

export function isStandingEliminatedRank(
  rank: number,
  highlights: readonly { fromRank: number; toRank: number }[],
) {
  return highlights.length > 0 && !highlights.some((highlight) => rank >= highlight.fromRank && rank <= highlight.toRank);
}
