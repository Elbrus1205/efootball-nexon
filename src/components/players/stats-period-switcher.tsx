"use client";

import { CalendarRange, ChevronDown } from "lucide-react";
import { useRouter } from "next/navigation";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn, formatDate } from "@/lib/utils";

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
          className={cn(
            "inline-flex h-9 w-9 items-center justify-center gap-2 rounded-lg border text-xs font-bold text-white transition sm:w-auto sm:max-w-[16rem] sm:px-3",
            "border-primary/25 bg-primary/10 hover:border-primary/45 hover:bg-primary/15",
          )}
        >
          <CalendarRange className="h-4 w-4 shrink-0 text-primary" />
          <span className="hidden min-w-0 truncate sm:inline">{selectedLabel}</span>
          <ChevronDown className="hidden h-3.5 w-3.5 shrink-0 text-zinc-500 sm:block" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="max-h-[320px] w-[min(22rem,calc(100vw-2rem))] overflow-y-auto">
        <DropdownMenuItem
          className={cn("items-start py-2.5", !selectedSeason ? "bg-white/10" : "")}
          onSelect={() => router.push(basePath)}
        >
          <div className="min-w-0">
            <div className="truncate font-semibold text-white">Общая статистика</div>
            <div className="mt-1 text-xs text-zinc-400">Все подтверждённые матчи игрока</div>
          </div>
        </DropdownMenuItem>

        {seasons.map((season) => (
          <DropdownMenuItem
            key={season.id}
            className={cn("items-start py-2.5", selectedSeason?.id === season.id ? "bg-white/10" : "")}
            onSelect={() => router.push(`${basePath}?season=${season.id}`)}
          >
            <div className="min-w-0">
              <div className="truncate font-semibold text-white">{season.name}</div>
              <div className="mt-1 text-xs text-zinc-400">
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
