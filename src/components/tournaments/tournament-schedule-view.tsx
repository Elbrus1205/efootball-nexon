"use client";

import { Clock3, Filter, RotateCcw } from "lucide-react";
import { useMemo, useState } from "react";
import { ClubPlayerLine } from "@/components/tournaments/club-player-line";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type ScheduleSide = {
  playerId: string | null;
  playerName: string;
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
  scoreLabel: string;
  sideOne: ScheduleSide;
  sideTwo: ScheduleSide;
};

export type TournamentScheduleSection = {
  key: string;
  title: string;
  deadlineLabel: string | null;
  deadlineAt: string | null;
  matches: TournamentScheduleMatch[];
};

function groupKey(match: TournamentScheduleMatch) {
  return match.groupId ?? "__without-group";
}

function groupLabel(match: TournamentScheduleMatch) {
  return match.groupName ?? "Без группы";
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
    return <Card className="p-6 text-zinc-500">После публикации расписания здесь появится календарь всех матчей турнира.</Card>;
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
              className="h-9 w-full rounded-md border border-white/10 bg-[#0A0A0A] px-2 text-xs font-medium text-white outline-none transition focus:border-primary/60 sm:h-11 sm:px-3 sm:text-sm"
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
              className="h-9 w-full rounded-md border border-white/10 bg-[#0A0A0A] px-2 text-xs font-medium text-white outline-none transition focus:border-primary/60 sm:h-11 sm:px-3 sm:text-sm"
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
            className="h-9 rounded-md px-0 sm:h-11 sm:px-4"
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
          {filteredSections.map((section) => (
            <section key={section.key} className="space-y-4 rounded-lg border border-white/10 bg-white/[0.04] p-4 sm:p-5">
              {(() => {
                const liveDeadline = formatLiveDeadline(section.deadlineAt);

                return (
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
                <h3 className="text-sm font-semibold uppercase tracking-[0.24em] text-zinc-300">{section.title}</h3>
                <div className="flex flex-wrap items-center gap-3 text-xs uppercase tracking-[0.16em]">
                  {section.deadlineLabel ? (
                    <div className="flex flex-wrap items-center gap-2">
                      {liveDeadline ? (
                        <div className={cn("inline-flex items-center gap-2 rounded-full border px-3 py-1 font-semibold", deadlineToneClass(liveDeadline.tone))}>
                          <Clock3 className="h-3.5 w-3.5" />
                          {liveDeadline.label}
                        </div>
                      ) : null}
                      <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-1 text-zinc-400">
                        Дедлайн: {section.deadlineLabel}
                      </div>
                    </div>
                  ) : null}
                  <div className="text-zinc-500">{pluralMatches(section.matches.length)}</div>
                </div>
              </div>
                );
              })()}

              <div className="divide-y divide-white/10">
                {section.matches.map((match, matchIndex) => {
                  const prevGroupName = matchIndex > 0 ? section.matches[matchIndex - 1].groupName : null;
                  const showGroupLabel = match.groupName && match.groupName !== prevGroupName;

                  return (
                    <div key={match.id} className="py-4 first:pt-0 last:pb-0">
                      {showGroupLabel ? (
                        <div className="mb-3 text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                          {match.groupName}
                        </div>
                      ) : null}
                      <div className="mx-auto grid max-w-[760px] grid-cols-[minmax(88px,1fr)_auto_minmax(88px,1fr)] items-center gap-2 sm:grid-cols-[minmax(180px,220px)_auto_minmax(180px,220px)] sm:gap-4">
                        <div className="min-w-0 justify-self-end">
                          <ClubPlayerLine
                            playerId={match.sideOne.playerId}
                            playerName={match.sideOne.playerName}
                            clubName={match.sideOne.clubName}
                            badgePath={match.sideOne.clubBadgePath}
                            align="center"
                            compact
                            reverse
                          />
                        </div>
                        <div className="flex shrink-0 items-center justify-center self-center">
                          <div className="flex min-w-[54px] items-center justify-center rounded-md border border-white/10 bg-black/20 px-2 py-2 text-center text-xs font-semibold tracking-[0.16em] text-zinc-200 sm:min-w-[72px] sm:text-sm">
                            {match.scoreLabel}
                          </div>
                        </div>
                        <div className="min-w-0 justify-self-start">
                          <ClubPlayerLine
                            playerId={match.sideTwo.playerId}
                            playerName={match.sideTwo.playerName}
                            clubName={match.sideTwo.clubName}
                            badgePath={match.sideTwo.clubBadgePath}
                            align="center"
                            compact
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <Card className="p-6 text-zinc-500">По выбранным фильтрам матчей нет.</Card>
      )}
    </div>
  );
}
