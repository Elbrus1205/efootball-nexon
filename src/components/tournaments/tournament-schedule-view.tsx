"use client";

import { Clock3, Filter, RotateCcw } from "lucide-react";
import { useMemo, useState } from "react";
import { ClubPlayerLine } from "@/components/tournaments/club-player-line";
import { TournamentEmptyState } from "@/components/tournaments/tournament-empty-state";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type ScheduleSide = {
  playerId: string | null;
  playerName: string;
  showPlayerName: boolean;
  clubName: string | null;
  clubBadgePath: string | null;
};

export type TournamentScheduleMatch = {
  id: string;
  roundKey: string;
  roundLabel: string;
  roundSort: number;
  matchNumber: number;
  groupId: string | null;
  groupName: string | null;
  groupSort: number;
  matchLabel: string;
  scoreLabel: string;
  sideOne: ScheduleSide;
  sideTwo: ScheduleSide;
};

export type TournamentScheduleSection = {
  key: string;
  title: string;
  deadlineLabel: string | null;
  deadlineAt: string | null;
  allMatchesPlayed: boolean;
  matches: TournamentScheduleMatch[];
};

function groupKey(match: TournamentScheduleMatch) {
  return match.groupId ?? "__without-group";
}

function groupLabel(match: TournamentScheduleMatch) {
  return match.groupName ?? "Без группы";
}

function groupScheduleMatches(matches: TournamentScheduleMatch[]) {
  const groups = new Map<string, { key: string; label: string | null; matches: TournamentScheduleMatch[] }>();

  for (const match of matches) {
    const key = groupKey(match);
    const group = groups.get(key);

    if (group) {
      group.matches.push(match);
    } else {
      groups.set(key, {
        key,
        label: match.groupName,
        matches: [match],
      });
    }
  }

  return Array.from(groups.values());
}

function pluralMatches(count: number) {
  const mod10 = count % 10;
  const mod100 = count % 100;

  if (mod10 === 1 && mod100 !== 11) return `${count} матч`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${count} матча`;
  return `${count} матчей`;
}

function formatLiveDeadline(deadlineAt: string | null) {
  if (!deadlineAt) return null;

  const deadline = new Date(deadlineAt);
  if (Number.isNaN(deadline.getTime())) return null;

  const diffMs = deadline.getTime() - Date.now();
  const absMs = Math.abs(diffMs);
  const hours = Math.floor(absMs / (60 * 60 * 1000));
  const minutes = Math.max(1, Math.round((absMs % (60 * 60 * 1000)) / (60 * 1000)));

  if (diffMs <= 0) {
    return {
      label: hours > 0 ? `Просрочено на ${hours} ч ${minutes} мин` : `Просрочено на ${minutes} мин`,
      tone: "danger" as const,
    };
  }

  if (hours < 1) {
    return { label: `Осталось ${minutes} мин`, tone: "danger" as const };
  }

  if (hours < 6) {
    return { label: `Осталось ${hours} ч ${minutes} мин`, tone: "warning" as const };
  }

  if (hours < 24) {
    return { label: `Сегодня, осталось ${hours} ч`, tone: "today" as const };
  }

  const days = Math.floor(hours / 24);
  return { label: `Осталось ${days} д ${hours % 24} ч`, tone: "neutral" as const };
}

function deadlineToneClass(tone: NonNullable<ReturnType<typeof formatLiveDeadline>>["tone"]) {
  if (tone === "danger") return "border-rose-400/30 bg-rose-500/10 text-rose-100";
  if (tone === "warning") return "border-amber-300/30 bg-amber-300/10 text-amber-100";
  if (tone === "today") return "border-primary/30 bg-primary/10 text-primary";
  return "border-white/10 bg-white/[0.04] text-zinc-300";
}

function ScheduleMatchCard({ match }: { match: TournamentScheduleMatch }) {
  return (
    <article
      aria-label={`${match.matchLabel}: ${match.sideOne.clubName ?? match.sideOne.playerName} — ${match.sideTwo.clubName ?? match.sideTwo.playerName}`}
      className="relative overflow-hidden rounded-xl border border-white/10 bg-black/20 px-2.5 pb-3 pt-8 transition-colors hover:border-primary/25 hover:bg-white/[0.035] sm:px-4 sm:pb-4 sm:pt-9"
    >
      <div className="absolute inset-x-0 top-0 flex h-7 items-center justify-between border-b border-white/[0.07] bg-white/[0.025] px-3 text-[9px] font-semibold uppercase tracking-[0.16em] text-zinc-600 sm:h-8 sm:text-[10px]">
        <span>{match.matchLabel}</span>
        <span>{match.roundLabel}</span>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_3.5rem_minmax(0,1fr)] items-center gap-2 sm:grid-cols-[minmax(0,1fr)_4.5rem_minmax(0,1fr)] sm:gap-3">
        <div className="min-w-0">
          <ClubPlayerLine
            playerId={match.sideOne.playerId}
            playerName={match.sideOne.playerName}
            showPlayerName={match.sideOne.showPlayerName}
            clubName={match.sideOne.clubName}
            badgePath={match.sideOne.clubBadgePath}
            compact
            stack
          />
        </div>

        <div className="flex min-h-11 items-center justify-center self-center rounded-lg border border-primary/15 bg-[#111513] px-1.5 text-center text-xs font-bold tabular-nums tracking-[0.12em] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] sm:min-h-12 sm:text-sm">
          {match.scoreLabel}
        </div>

        <div className="min-w-0">
          <ClubPlayerLine
            playerId={match.sideTwo.playerId}
            playerName={match.sideTwo.playerName}
            showPlayerName={match.sideTwo.showPlayerName}
            clubName={match.sideTwo.clubName}
            badgePath={match.sideTwo.clubBadgePath}
            compact
            stack
          />
        </div>
      </div>
    </article>
  );
}

export function TournamentScheduleView({ sections }: { sections: TournamentScheduleSection[] }) {
  const [roundFilter, setRoundFilter] = useState("all");
  const [groupFilter, setGroupFilter] = useState("all");

  const roundOptions = useMemo(() => {
    const map = new Map<string, { key: string; label: string; sort: number }>();

    for (const section of sections) {
      for (const match of section.matches) {
        if (!map.has(match.roundKey)) {
          map.set(match.roundKey, {
            key: match.roundKey,
            label: match.roundLabel,
            sort: match.roundSort,
          });
        }
      }
    }

    return Array.from(map.values()).sort((a, b) => a.sort - b.sort || a.label.localeCompare(b.label, "ru"));
  }, [sections]);

  const groupOptions = useMemo(() => {
    const map = new Map<string, { key: string; label: string; sort: number }>();

    for (const section of sections) {
      for (const match of section.matches) {
        const key = groupKey(match);
        if (!map.has(key)) {
          map.set(key, {
            key,
            label: groupLabel(match),
            sort: match.groupSort,
          });
        }
      }
    }

    return Array.from(map.values()).sort((a, b) => a.sort - b.sort || a.label.localeCompare(b.label, "ru"));
  }, [sections]);

  const filteredSections = useMemo(
    () =>
      sections
        .map((section) => ({
          ...section,
          matches: section.matches.filter((match) => {
            if (roundFilter !== "all" && match.roundKey !== roundFilter) return false;
            if (groupFilter !== "all" && groupKey(match) !== groupFilter) return false;
            return true;
          }),
        }))
        .filter((section) => section.matches.length > 0),
    [sections, roundFilter, groupFilter],
  );

  const visibleMatchCount = filteredSections.reduce((sum, section) => sum + section.matches.length, 0);
  const hasFilters = roundFilter !== "all" || groupFilter !== "all";

  if (!sections.length) {
    return <TournamentEmptyState title="Расписание ещё не опубликовано" description="Календарь всех матчей появится здесь после формирования этапов." />;
  }

  return (
    <div className="space-y-5">
      <Card className="rounded-lg border-primary/15 bg-white/[0.035] p-2.5 sm:p-5">
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_2.25rem] gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end sm:gap-3">
          <label className="grid gap-1.5 sm:gap-2">
            <span className="hidden items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 sm:flex">
              <Filter className="h-3.5 w-3.5 text-primary" />
              Тур
            </span>
            <select
              value={roundFilter}
              onChange={(event) => setRoundFilter(event.target.value)}
              aria-label="Фильтр по туру"
              className="h-11 w-full rounded-md border border-white/10 bg-[#1D1D1D] px-2 text-xs font-medium text-white outline-none transition focus:border-primary/60 sm:px-3 sm:text-sm"
            >
              <option value="all">Все туры</option>
              {roundOptions.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-1.5 sm:gap-2">
            <span className="hidden text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 sm:block">Группа</span>
            <select
              value={groupFilter}
              onChange={(event) => setGroupFilter(event.target.value)}
              aria-label="Фильтр по группе"
              className="h-11 w-full rounded-md border border-white/10 bg-[#1D1D1D] px-2 text-xs font-medium text-white outline-none transition focus:border-primary/60 sm:px-3 sm:text-sm"
            >
              <option value="all">Все группы</option>
              {groupOptions.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <Button
            type="button"
            variant="outline"
            disabled={!hasFilters}
            onClick={() => {
              setRoundFilter("all");
              setGroupFilter("all");
            }}
            aria-label="Сбросить фильтры"
            className="h-11 rounded-md px-0 sm:px-4"
          >
            <RotateCcw className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Сбросить</span>
          </Button>
        </div>

        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-2 text-[10px] uppercase tracking-[0.14em] text-zinc-500 sm:mt-4 sm:pt-3 sm:text-xs sm:tracking-[0.16em]">
          <span>Показано: {pluralMatches(visibleMatchCount)}</span>
          <span>{hasFilters ? "Фильтр активен" : "Полное расписание"}</span>
        </div>
      </Card>

      {filteredSections.length ? (
        <div className="space-y-6 sm:space-y-8">
          {filteredSections.map((section) => {
            const liveDeadline = formatLiveDeadline(section.deadlineAt);
            const matchGroups = groupScheduleMatches(section.matches);

            return (
              <section key={section.key} className="space-y-5 rounded-xl border border-white/10 bg-white/[0.035] p-3 sm:p-5 lg:p-6">
                <div className="space-y-3 border-b border-white/10 pb-4">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-semibold uppercase tracking-[0.22em] text-zinc-200 sm:text-base">{section.title}</h3>
                    <div className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500 sm:text-xs">
                      {pluralMatches(section.matches.length)}
                    </div>
                  </div>

                  {section.deadlineLabel ? (
                    <div className="grid gap-2 text-[10px] uppercase tracking-[0.1em] sm:flex sm:flex-wrap sm:items-center sm:text-xs sm:tracking-[0.14em]">
                      {section.allMatchesPlayed ? (
                        <div className="inline-flex w-full justify-center gap-2 rounded-lg border border-emerald-400/25 bg-emerald-400/10 px-3 py-2 font-semibold text-emerald-200 sm:w-auto sm:rounded-full sm:py-1">
                          <Clock3 className="h-3.5 w-3.5 shrink-0" />
                          <span>Все матчи сыграны</span>
                        </div>
                      ) : liveDeadline ? (
                        <div className={cn("inline-flex w-full justify-center sm:w-auto gap-2 rounded-lg border px-3 py-2 font-semibold sm:rounded-full sm:py-1", deadlineToneClass(liveDeadline.tone))}>
                          <Clock3 className="h-3.5 w-3.5 shrink-0" />
                          <span>{liveDeadline.label}</span>
                        </div>
                      ) : null}
                      <div className="inline-flex w-full justify-center rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-center text-zinc-400 sm:w-auto sm:rounded-full sm:py-1">
                        Дедлайн: {section.deadlineLabel}
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="space-y-6">
                  {matchGroups.map((group) => (
                    <div key={group.key} className="space-y-3">
                      {group.label ? (
                        <div className="flex items-center gap-3" aria-label={`Группа ${group.label}`}>
                          <span className="h-px flex-1 bg-white/[0.08]" aria-hidden="true" />
                          <h4 className="text-center text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500 sm:text-xs">
                            {group.label}
                          </h4>
                          <span className="h-px flex-1 bg-white/[0.08]" aria-hidden="true" />
                        </div>
                      ) : null}
                      <div className="grid gap-3 lg:grid-cols-2">
                        {group.matches.map((match) => <ScheduleMatchCard key={match.id} match={match} />)}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <TournamentEmptyState title="Матчей по фильтрам нет" description="Сбросьте фильтры или выберите другой тур и группу." />
      )}
    </div>
  );
}
