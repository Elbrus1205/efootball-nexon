"use client";

import { useDeferredValue, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Search, SearchX, X } from "lucide-react";
import type { FaqBlock } from "@/lib/faq/content";
import { matchesFaqQuery } from "@/lib/faq/content";
import { FaqBlocks } from "@/components/faq/faq-blocks";
import { cn } from "@/lib/utils";

export type FaqSearchEntry = {
  id: string;
  title: string;
  category: string;
  blocks: FaqBlock[];
  searchText: string;
  /** Optional extra node rendered after the blocks (e.g. profile-status badges). */
  extra?: ReactNode;
};

const ALL_CATEGORIES = "__all__";

export function FaqSearch({ entries }: { entries: FaqSearchEntry[] }) {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>(ALL_CATEGORIES);
  const deferredQuery = useDeferredValue(query);

  const categories = useMemo(() => {
    const ordered: string[] = [];
    for (const entry of entries) {
      if (!ordered.includes(entry.category)) ordered.push(entry.category);
    }
    return ordered;
  }, [entries]);

  const filtered = useMemo(() => {
    return entries.filter((entry) => {
      if (activeCategory !== ALL_CATEGORIES && entry.category !== activeCategory) return false;
      return matchesFaqQuery(entry.searchText, deferredQuery);
    });
  }, [entries, activeCategory, deferredQuery]);

  const grouped = useMemo(() => {
    const map = new Map<string, FaqSearchEntry[]>();
    for (const entry of filtered) {
      const list = map.get(entry.category) ?? [];
      list.push(entry);
      map.set(entry.category, list);
    }
    return [...map.entries()];
  }, [filtered]);

  const hasQuery = deferredQuery.trim().length > 0;

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-500" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Поиск по вопросам и ответам..."
            aria-label="Поиск по FAQ"
            className="h-14 w-full rounded-2xl border border-white/10 bg-black/30 pl-12 pr-12 text-base text-white outline-none transition duration-200 placeholder:text-zinc-500 hover:border-white/20 focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Очистить поиск"
              className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-zinc-400 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>

        {categories.length > 1 ? (
          <div className="flex flex-wrap gap-2">
            <CategoryChip active={activeCategory === ALL_CATEGORIES} onClick={() => setActiveCategory(ALL_CATEGORIES)}>
              Все
            </CategoryChip>
            {categories.map((category) => (
              <CategoryChip key={category} active={activeCategory === category} onClick={() => setActiveCategory(category)}>
                {category}
              </CategoryChip>
            ))}
          </div>
        ) : null}

        {hasQuery ? (
          <p className="text-xs text-zinc-500" aria-live="polite">
            {filtered.length ? `Найдено: ${filtered.length}` : "Ничего не найдено"}
          </p>
        ) : null}
      </div>

      {grouped.length ? (
        <div className="grid gap-6">
          {grouped.map(([category, categoryEntries]) => (
            <section key={category} className="space-y-3">
              <h2 className="text-lg font-semibold text-white">{category}</h2>
              <div className="grid gap-3">
                {categoryEntries.map((entry) => (
                  <details
                    key={entry.id}
                    open={hasQuery}
                    className="group rounded-3xl border border-white/10 bg-white/[0.04] p-5 transition open:border-primary/25 open:bg-white/[0.06]"
                  >
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-base font-semibold text-white">
                      <span>{entry.title}</span>
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-black/20 text-lg leading-none text-primary transition group-open:rotate-45">
                        +
                      </span>
                    </summary>
                    <div className="mt-4">
                      <FaqBlocks blocks={entry.blocks} />
                      {entry.extra}
                    </div>
                  </details>
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-white/15 bg-black/20 px-6 py-12 text-center">
          <SearchX className="h-8 w-8 text-zinc-600" />
          <p className="text-sm text-zinc-400">
            По запросу ничего не найдено. Попробуйте другие слова или{" "}
            <button type="button" onClick={() => setQuery("")} className="text-primary underline-offset-2 hover:underline">
              сбросьте поиск
            </button>
            .
          </p>
        </div>
      )}
    </div>
  );
}

function CategoryChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "min-h-10 rounded-full border px-4 text-sm font-medium transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        active
          ? "border-primary/50 bg-primary/15 text-primary"
          : "border-white/10 bg-white/[0.03] text-zinc-300 hover:border-white/25 hover:text-white",
      )}
    >
      {children}
    </button>
  );
}
