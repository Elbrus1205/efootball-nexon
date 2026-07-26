"use client";

import { Check, Circle, Clock3, LockKeyhole } from "lucide-react";
import { Children, type ReactNode, useEffect, useState } from "react";
import type { TournamentStagePresentationState } from "@/lib/tournament-public-view";
import { cn } from "@/lib/utils";

export type TournamentStageOption = {
  id: string;
  title: string;
  caption: string;
  state: TournamentStagePresentationState;
};

const stateMeta = {
  completed: { label: "Завершён", icon: Check },
  active: { label: "Сейчас", icon: Circle },
  upcoming: { label: "Скоро", icon: Clock3 },
  locked: { label: "Закрыт", icon: LockKeyhole },
} satisfies Record<TournamentStagePresentationState, { label: string; icon: typeof Check }>;

export function TournamentStageSwitcher({ options, children }: { options: TournamentStageOption[]; children: ReactNode }) {
  const initial = options.find((option) => option.state === "active") ?? options.find((option) => option.state !== "locked") ?? options[0];
  const [activeId, setActiveId] = useState(initial?.id ?? "");
  const panels = Children.toArray(children);
  const activeIndex = Math.max(0, options.findIndex((option) => option.id === activeId));
  const activeOption = options[activeIndex] ?? options[0];

  useEffect(() => {
    if (!options.some((option) => option.id === activeId && option.state !== "locked")) {
      setActiveId(initial?.id ?? "");
    }
  }, [activeId, initial?.id, options]);

  if (!options.length) return null;

  return (
    <div className="space-y-5">
      <section aria-labelledby="stage-navigation-title" className="rounded-2xl border border-white/10 bg-white/[0.025] p-3 sm:p-4">
        <div className="flex items-end justify-between gap-4 px-1 pb-3">
          <div>
            <div id="stage-navigation-title" className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500">Этапы турнира</div>
            <div className="mt-1 text-sm font-semibold text-white">{activeOption?.title}</div>
          </div>
          <div className="hidden text-xs text-zinc-500 sm:block">{options.length} этапа</div>
        </div>
        <div className="px-1">
          <div className="grid grid-cols-2 gap-2" role="list" aria-label="Этапы турнира">
            {options.map((option, index) => {
              const meta = stateMeta[option.state];
              const Icon = meta.icon;
              const selected = option.id === activeOption?.id;
              const locked = option.state === "locked";
              return (
                <button
                  key={option.id}
                  type="button"
                  disabled={locked}
                  aria-pressed={selected}
                  onClick={() => setActiveId(option.id)}
                  className={cn(
                    "flex min-h-[62px] min-w-0 items-center gap-2 rounded-xl border px-2.5 py-2 text-left transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 motion-reduce:transition-none",
                    selected && "border-primary/45 bg-primary/10 shadow-[inset_0_-2px_0_rgba(33,241,168,0.85)]",
                    !selected && !locked && "border-white/10 bg-black/20 hover:border-white/20 hover:bg-white/[0.04]",
                    locked && "cursor-not-allowed border-white/5 bg-black/10 opacity-45",
                  )}
                >
                  <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border", selected ? "border-primary/40 bg-primary/15 text-primary" : "border-white/10 bg-white/[0.03] text-zinc-400")}>
                    <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-semibold leading-5 text-white">{index + 1}. {option.title}</span>
                    <span className="mt-0.5 block truncate text-[11px] leading-4 text-zinc-400">{meta.label} · {option.caption}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </section>
      <div key={activeOption?.id} className="animate-in fade-in slide-in-from-bottom-1 duration-200 motion-reduce:animate-none">
        {panels[activeIndex] ?? panels[0] ?? null}
      </div>
    </div>
  );
}
