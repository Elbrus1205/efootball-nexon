"use client";

import { useDeferredValue, useMemo, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowUpRight, BookOpen, Plus, Search, SearchX, X } from "lucide-react";
import type { FaqBlock } from "@/lib/faq/content";
import { matchesFaqQuery } from "@/lib/faq/content";
import { FaqBlocks } from "@/components/faq/faq-blocks";
import styles from "./faq.module.css";

export type FaqSearchEntry = {
  id: string;
  title: string;
  category: string;
  blocks: FaqBlock[];
  searchText: string;
  extra?: ReactNode;
};

const ALL_CATEGORIES = "__all__";

export function FaqSearch({ entries }: { entries: FaqSearchEntry[] }) {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState(ALL_CATEGORIES);
  const deferredQuery = useDeferredValue(query);
  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const entry of entries) counts.set(entry.category, (counts.get(entry.category) ?? 0) + 1);
    return [...counts.entries()];
  }, [entries]);
  const filtered = useMemo(() => entries.filter((entry) =>
    (activeCategory === ALL_CATEGORIES || entry.category === activeCategory) && matchesFaqQuery(entry.searchText, deferredQuery),
  ), [entries, activeCategory, deferredQuery]);
  const grouped = useMemo(() => {
    const map = new Map<string, FaqSearchEntry[]>();
    for (const entry of filtered) {
      const group = map.get(entry.category) ?? [];
      group.push(entry);
      map.set(entry.category, group);
    }
    return [...map.entries()];
  }, [filtered]);
  const hasQuery = deferredQuery.trim().length > 0;
  const reset = () => { setQuery(""); setActiveCategory(ALL_CATEGORIES); };

  return (
    <div className={`${styles.scope} ${styles.layout}`}>
      <aside className={styles.sidebar} aria-label="Разделы FAQ">
        <p className={styles.navLabel}>Разделы помощи</p>
        <CategoryChip active={activeCategory === ALL_CATEGORIES} onClick={() => setActiveCategory(ALL_CATEGORIES)} count={entries.length}>Все вопросы</CategoryChip>
        {categories.map(([category, count]) => <CategoryChip key={category} active={activeCategory === category} onClick={() => setActiveCategory(category)} count={count}>{category}</CategoryChip>)}
        <div className={styles.help}>
          <BookOpen size={18} className="mb-3" aria-hidden="true" />
          <p>Всё о правилах и порядке проведения матчей.</p>
          <Link href="/regulations">Регламент турниров <ArrowUpRight size={14} aria-hidden="true" /></Link>
        </div>
      </aside>
      <div className={styles.content}>
        <div className={styles.search}>
          <Search aria-hidden="true" />
          <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Найти ответ на свой вопрос" aria-label="Поиск по FAQ" />
          {query ? <button type="button" onClick={() => setQuery("")} aria-label="Очистить поиск" className={styles.clear}><X size={16} /></button> : null}
        </div>
        <div className={styles.mobileCategories}>
          <label htmlFor="faq-category">Раздел помощи</label>
          <select id="faq-category" value={activeCategory} onChange={(event) => setActiveCategory(event.target.value)} className={styles.select}>
            <option value={ALL_CATEGORIES}>Все вопросы · {entries.length}</option>
            {categories.map(([category, count]) => <option key={category} value={category}>{category} · {count}</option>)}
          </select>
        </div>
        <div className={styles.results}>
          <p aria-live="polite">{hasQuery ? `Найдено ответов: ${filtered.length}` : `Вопросов: ${filtered.length} · Выберите, чтобы прочитать ответ`}</p>
          {hasQuery || activeCategory !== ALL_CATEGORIES ? <button type="button" onClick={reset}>Сбросить</button> : null}
        </div>
        {grouped.length ? <div>
          {grouped.map(([category, categoryEntries]) => (
            <section key={category} className={styles.section}>
              <h2 className={styles.sectionTitle}>{category}<span>{categoryEntries.length}</span></h2>
              <div className={styles.questions}>
                {categoryEntries.map((entry, index) => <FaqAnswer key={`${entry.id}-${hasQuery}`} entry={entry} index={index} initiallyOpen={hasQuery} />)}
              </div>
            </section>
          ))}
        </div> : (
          <div className={styles.empty}>
            <SearchX size={26} aria-hidden="true" /><strong>Ничего не найдено</strong>
            <p>Попробуйте другое слово или выберите другой раздел.</p>
            <button type="button" onClick={reset}>Показать все вопросы</button>
          </div>
        )}
      </div>
    </div>
  );
}

function FaqAnswer({ entry, index, initiallyOpen }: { entry: FaqSearchEntry; index: number; initiallyOpen: boolean }) {
  const [open, setOpen] = useState(initiallyOpen);
  return (
    <details className={styles.question} open={open} onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary><span className={styles.questionNumber}>{String(index + 1).padStart(2, "0")}</span><span className={styles.questionTitle}>{entry.title}</span><Plus aria-hidden="true" /></summary>
      {open ? <div className={styles.answer}><FaqBlocks blocks={entry.blocks} />{entry.extra}</div> : null}
    </details>
  );
}

function CategoryChip({ active, onClick, children, count }: { active: boolean; onClick: () => void; children: ReactNode; count: number }) {
  return <button type="button" onClick={onClick} aria-pressed={active} className={styles.category}><span>{children}</span><span>{count}</span></button>;
}
