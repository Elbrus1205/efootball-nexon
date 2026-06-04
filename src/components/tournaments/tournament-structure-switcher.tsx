"use client";

import { Children, type ReactNode, useMemo, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export type TournamentStructureOption = {
  id: string;
  title: string;
  caption?: string;
};

export function TournamentStructureSwitcher({
  options,
  children,
}: {
  options: TournamentStructureOption[];
  children: ReactNode;
}) {
  const [activeId, setActiveId] = useState(options[0]?.id ?? "");
  const panels = Children.toArray(children);
  const activeIndex = Math.max(
    0,
    options.findIndex((option) => option.id === activeId),
  );
  const activeOption = options[activeIndex] ?? options[0];
  const activePanel = panels[activeIndex] ?? panels[0] ?? null;
  const activeCaption = useMemo(() => activeOption?.caption?.trim(), [activeOption?.caption]);

  if (options.length <= 1) return <div>{children}</div>;

  return (
    <div className="space-y-4">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center justify-between gap-3 rounded-lg border border-primary/25 bg-[#0A0A0A] px-4 py-3 text-left transition hover:border-primary/45 hover:bg-white/[0.03] sm:w-auto sm:min-w-72"
          >
            <span className="min-w-0">
              <span className="block text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">Структура турнира</span>
              <span className="mt-1 block truncate text-sm font-semibold text-white sm:text-base">{activeOption.title}</span>
              {activeCaption ? <span className="mt-0.5 block truncate text-xs text-zinc-500">{activeCaption}</span> : null}
            </span>
            <ChevronDown className="h-4 w-4 shrink-0 text-primary" />
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="start" className="w-[min(22rem,calc(100vw-2rem))] rounded-lg">
          {options.map((option) => {
            const active = option.id === activeOption.id;

            return (
              <DropdownMenuItem
                key={option.id}
                onSelect={() => setActiveId(option.id)}
                className={cn(
                  "gap-3 rounded-md px-3 py-2.5",
                  active && "border border-primary/25 bg-primary/10 text-primary hover:bg-primary/15",
                )}
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-white/10 bg-black/25">
                  {active ? <Check className="h-3.5 w-3.5" /> : null}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{option.title}</span>
                  {option.caption ? <span className="block truncate text-xs text-zinc-500">{option.caption}</span> : null}
                </span>
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>

      <div>{activePanel}</div>
    </div>
  );
}
