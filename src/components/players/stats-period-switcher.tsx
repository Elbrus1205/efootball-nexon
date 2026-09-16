"use client";

import { CalendarRange, ChevronDown } from "lucide-react";
import { useRouter } from "next/navigation";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn, formatDate } from "@/lib/utils";
import styles from "./player-profile.module.css";

type StatsPeriodSeason = {
  id: string;
  name: string;
  isActive: boolean;
  startsAt: Date | null;
  endsAt: Date | null;
};

type StatsPeriodSwitcherProps = {
  basePath: string;
  seasons: StatsPeriodSeason[];
  selectedSeasonId?: string | null;
};

export function StatsPeriodSwitcher({
  basePath,
  seasons,
  selectedSeasonId = null,
}: StatsPeriodSwitcherProps) {
  const router = useRouter();
  const selectedSeason = seasons.find((season) => season.id === selectedSeasonId) ?? null;
  const selectedLabel = selectedSeason?.name ?? "Общая";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Выбрать период статистики"
          className={styles.periodButton}
        >
          <CalendarRange size={16} aria-hidden="true" />
          <span>{selectedLabel}</span>
          <ChevronDown size={14} aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        sideOffset={6}
        className="max-h-[260px] w-[min(15.75rem,calc(100vw-2rem))] overflow-y-auto rounded-lg p-1.5 shadow-[0_18px_48px_rgba(0,0,0,0.45)]"
      >
        <DropdownMenuItem
          className={cn("min-h-11 items-start rounded-lg px-3 py-2 focus:bg-white/10", !selectedSeason ? "bg-white/10" : "")}
          onSelect={() => router.push(basePath)}
        >
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-white">Общая статистика</div>
            <div className="mt-0.5 line-clamp-1 text-[11px] text-zinc-400">Все матчи игрока</div>
          </div>
        </DropdownMenuItem>

        {seasons.map((season) => (
          <DropdownMenuItem
            key={season.id}
            className={cn("min-h-11 items-start rounded-lg px-3 py-2 focus:bg-white/10", selectedSeason?.id === season.id ? "bg-white/10" : "")}
            onSelect={() => router.push(`${basePath}?season=${season.id}`)}
          >
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-white">{season.name}</div>
              <div className="mt-0.5 truncate text-[11px] text-zinc-400">
                {season.isActive ? "Активный сезон" : "Архивный сезон"}
                {season.startsAt ? ` • c ${formatDate(season.startsAt, "d MMM yyyy")}` : ""}
                {season.endsAt ? ` по ${formatDate(season.endsAt, "d MMM yyyy")}` : ""}
              </div>
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
