"use client";

import { Children, type ReactNode, useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export type TournamentGroupOption = {
  id: string;
  title: string;
  participantCount: number;
  capacity: number | null;
  isCurrent: boolean;
};

function currentGroupLabel(title: string) {
  const suffix = title.replace(/^Группа\s+/i, "").trim();
  return suffix && suffix !== title ? `Моя группа · ${suffix}` : "Моя группа";
}

export function TournamentGroupSwitcher({
  options,
  children,
}: {
  options: TournamentGroupOption[];
  children: ReactNode;
}) {
  const initial = options.find((option) => option.isCurrent) ?? options[0];
  const [activeId, setActiveId] = useState(initial?.id ?? "");
  const panels = Children.toArray(children);
  const activeIndex = Math.max(0, options.findIndex((option) => option.id === activeId));
  const activeOption = options[activeIndex] ?? options[0];

  useEffect(() => {
    if (!options.some((option) => option.id === activeId)) {
      setActiveId(initial?.id ?? "");
    }
  }, [activeId, initial?.id, options]);

  if (!options.length) return null;

  return (
    <div className="min-w-0 space-y-4">
      <div
        className="flex max-w-full gap-2 overflow-x-auto pb-1 [scrollbar-width:thin]"
        role="tablist"
        aria-label="Группы турнира"
      >
        {options.map((option) => {
          const selected = option.id === activeOption?.id;
          const label = option.isCurrent ? currentGroupLabel(option.title) : option.title;
          const capacityLabel = option.capacity ?? "—";

          return (
            <button
              key={option.id}
              id={`group-tab-${option.id}`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`group-panel-${option.id}`}
              aria-label={`${label}, ${option.participantCount} из ${capacityLabel} команд`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActiveId(option.id)}
              onKeyDown={(event) => {
                const currentIndex = options.findIndex((item) => item.id === option.id);
                let nextIndex = currentIndex;

                if (event.key === "ArrowRight") nextIndex = (currentIndex + 1) % options.length;
                else if (event.key === "ArrowLeft") nextIndex = (currentIndex - 1 + options.length) % options.length;
                else if (event.key === "Home") nextIndex = 0;
                else if (event.key === "End") nextIndex = options.length - 1;
                else return;

                event.preventDefault();
                const nextId = options[nextIndex].id;
                setActiveId(nextId);
                requestAnimationFrame(() => document.getElementById(`group-tab-${nextId}`)?.focus());
              }}
              className={cn(
                "flex min-h-11 shrink-0 items-center gap-2 rounded-xl border px-3 py-2 text-left transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 motion-reduce:transition-none",
                selected
                  ? "border-primary/45 bg-primary/10 text-white shadow-[inset_0_-2px_0_rgba(33,241,168,0.85)]"
                  : "border-white/10 bg-black/20 text-zinc-300 hover:border-white/20 hover:bg-white/[0.04]",
              )}
            >
              <span className="text-xs font-semibold sm:text-sm">{label}</span>
              <span className={cn("text-[10px] tabular-nums", selected ? "text-primary" : "text-zinc-500")}>
                {option.participantCount}/{capacityLabel}
              </span>
            </button>
          );
        })}
      </div>

      <div
        id={`group-panel-${activeOption.id}`}
        role="tabpanel"
        aria-labelledby={`group-tab-${activeOption.id}`}
        className="animate-in fade-in duration-200 motion-reduce:animate-none"
      >
        {panels[activeIndex] ?? panels[0] ?? null}
      </div>
    </div>
  );
}
