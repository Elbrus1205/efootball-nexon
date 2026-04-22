"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarRange, ChevronDown } from "lucide-react";
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

function statsPeriodClass(active: boolean) {
  return cn(
    "inline-flex min-h-10 items-center rounded-lg border px-3 py-2 text-sm font-semibold transition",
    active
      ? "border-primary/35 bg-primary/15 text-white shadow-[0_0_22px_rgba(59,130,246,0.14)]"
      : "border-white/10 bg-white/[0.04] text-zinc-400 hover:border-primary/25 hover:text-white",
  );
}

export function StatsPeriodSwitcher({
  basePath,
  seasons,
  selectedSeasonId = null,
}: StatsPeriodSwitcherProps) {
  const router = useRouter();
  const selectedSeason = seasons.find((season) => season.id === selectedSeasonId) ?? null;

  return (
    <div className="mt-4 flex flex-wrap gap-2">
      <Link href={basePath} className={statsPeriodClass(!selectedSeason)}>
        Общая статистика
      </Link>

      {seasons.length ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={cn(
                statsPeriodClass(Boolean(selectedSeason)),
                "max-w-full justify-between gap-3 sm:min-w-[260px]",
              )}
            >
              <span className="inline-flex min-w-0 items-center gap-2">
                <CalendarRange className="h-4 w-4 shrink-0" />
                <span className="min-w-0 truncate">{selectedSeason?.name ?? "Выбрать сезон"}</span>
              </span>
              <ChevronDown className="h-4 w-4 shrink-0 opacity-70" />
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="start" className="max-h-[320px] w-[min(22rem,calc(100vw-2rem))] overflow-y-auto">
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
      ) : null}
    </div>
  );
}
