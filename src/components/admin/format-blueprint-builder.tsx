"use client";

import { PlayoffType } from "@prisma/client";
import { Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import {
  createDefaultFormatBlueprint,
  createDefaultPlayoffSelection,
  createDefaultPlayoffStage,
  normalizeFormatBlueprint,
  stringifyFormatBlueprint,
  type FormatBlueprint,
  type OpeningStageMode,
} from "@/lib/format-blueprint";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function createOpeningStageSelections(mode: OpeningStageMode, playoffType: PlayoffType, divisionsCount: number) {
  if (mode === "LEAGUE") {
    return [
      createDefaultPlayoffSelection({ divisionIndex: 1, fromRank: 1, toRank: 8, targetBracket: "upper" }),
      ...(playoffType === PlayoffType.DOUBLE
        ? [createDefaultPlayoffSelection({ divisionIndex: 1, fromRank: 9, toRank: 16, targetBracket: "lower" })]
        : []),
    ];
  }

  const groupsCount = Math.max(1, Math.min(4, divisionsCount));
  const upperSelections = Array.from({ length: groupsCount }, (_, index) =>
    createDefaultPlayoffSelection({ divisionIndex: index + 1, fromRank: 1, toRank: 2, targetBracket: "upper" }),
  );

  if (playoffType !== PlayoffType.DOUBLE) {
    return upperSelections;
  }

  const lowerSelections = Array.from({ length: groupsCount }, (_, index) =>
    createDefaultPlayoffSelection({ divisionIndex: index + 1, fromRank: 3, toRank: 4, targetBracket: "lower" }),
  );

  return [...upperSelections, ...lowerSelections];
}

export function FormatBlueprintBuilder({
  name,
  initialValue,
  visible,
}: {
  name: string;
  initialValue?: FormatBlueprint | null;
  visible: boolean;
}) {
  const [blueprint, setBlueprint] = useState<FormatBlueprint>(normalizeFormatBlueprint(initialValue ?? createDefaultFormatBlueprint()));
  const hasOpeningStage = blueprint.openingStageMode !== "NONE";
  const selectionSourceLabel = blueprint.openingStageMode === "GROUPS" ? "Из группы" : "Из лиги";

  useEffect(() => {
    setBlueprint(normalizeFormatBlueprint(initialValue ?? createDefaultFormatBlueprint()));
  }, [initialValue]);

  const updatePlayoff = (playoffId: string, updater: (playoff: FormatBlueprint["playoffs"][number]) => FormatBlueprint["playoffs"][number]) => {
    setBlueprint((current) => ({
      ...current,
      playoffs: current.playoffs.map((playoff) => (playoff.id === playoffId ? updater(playoff) : playoff)),
    }));
  };

  if (!visible) {
    return <input type="hidden" name={name} value="" />;
  }

  return (
    <div className="space-y-5 rounded-[2rem] border border-white/10 bg-white/[0.04] p-5">
      <input type="hidden" name={name} value={stringifyFormatBlueprint(blueprint)} />

      <div className="space-y-2">
        <div className="text-sm font-semibold uppercase tracking-[0.24em] text-primary">Гибкий конструктор</div>
        <div className="text-sm text-zinc-400">
          Соберите формат под турнир: группы или лига перед плей-офф, сразу single/double elimination, количество туров,
          матчи в серии и правила выхода.
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="openingStageMode">Стартовый этап</Label>
          <select
            id="openingStageMode"
            value={blueprint.openingStageMode}
            onChange={(event) => {
              const openingStageMode = event.target.value as OpeningStageMode;
              setBlueprint((current) => {
                const divisionsCount = openingStageMode === "LEAGUE" ? 1 : current.divisionsCount;
                const resetSelections = current.openingStageMode !== openingStageMode && openingStageMode !== "NONE";
                const next = {
                  ...current,
                  openingStageMode,
                  divisionsCount,
                  playoffs:
                    openingStageMode === "NONE" && !current.playoffs.length
                      ? [createDefaultPlayoffStage({ name: "Плей-офф" })]
                      : current.playoffs.map((playoff) => ({
                          ...playoff,
                          selections: resetSelections ? createOpeningStageSelections(openingStageMode, playoff.type, divisionsCount) : playoff.selections,
                        })),
                };

                return normalizeFormatBlueprint(next);
              });
            }}
            className="h-11 w-full rounded-xl border border-white/10 bg-white/5 px-4 text-white"
          >
            <option value="GROUPS">Группы, затем плей-офф</option>
            <option value="LEAGUE">Одна лига, затем плей-офф</option>
            <option value="NONE">Сразу плей-офф</option>
          </select>
        </div>

        {hasOpeningStage ? (
          <div className="space-y-2">
            <Label htmlFor="leagueStageName">Название этапа</Label>
            <Input
              id="leagueStageName"
              value={blueprint.leagueStageName}
              onChange={(event) => setBlueprint((current) => ({ ...current, leagueStageName: event.target.value }))}
              placeholder={blueprint.openingStageMode === "LEAGUE" ? "Лига" : "Группы"}
            />
          </div>
        ) : null}

        {hasOpeningStage && blueprint.openingStageMode === "GROUPS" ? (
          <div className="space-y-2">
            <Label htmlFor="divisionsCount">Количество групп</Label>
            <Input
              id="divisionsCount"
              type="number"
              min={1}
              max={16}
              value={blueprint.divisionsCount}
              onChange={(event) =>
                setBlueprint((current) =>
                  normalizeFormatBlueprint({
                    ...current,
                    divisionsCount: Math.max(1, Math.min(16, Number(event.target.value || 1))),
                  }),
                )
              }
            />
          </div>
        ) : null}

        {hasOpeningStage ? (
          <div className="space-y-2">
            <Label htmlFor="roundsCount">Количество туров</Label>
            <Input
              id="roundsCount"
              type="number"
              min={1}
              max={4}
              value={blueprint.roundsCount}
              onChange={(event) =>
                setBlueprint((current) =>
                  normalizeFormatBlueprint({
                    ...current,
                    roundsCount: Math.max(1, Math.min(4, Number(event.target.value || 1))),
                  }),
                )
              }
            />
          </div>
        ) : null}

        {hasOpeningStage && blueprint.openingStageMode === "GROUPS" ? (
          <div className="space-y-2">
            <Label htmlFor="participantsPerGroup">Игроков в группе</Label>
            <Input
              id="participantsPerGroup"
              type="number"
              min={2}
              max={32}
              value={blueprint.participantsPerGroup ?? ""}
              onChange={(event) =>
                setBlueprint((current) =>
                  normalizeFormatBlueprint({
                    ...current,
                    participantsPerGroup: event.target.value ? Number(event.target.value) : null,
                  }),
                )
              }
              placeholder="Авто"
            />
          </div>
        ) : null}

        {!hasOpeningStage ? (
          <div className="rounded-2xl border border-primary/20 bg-primary/10 px-4 py-3 text-sm leading-6 text-blue-100 md:col-span-2">
            Группового этапа не будет: все подтвержденные участники попадут в первую сетку плей-офф напрямую.
          </div>
        ) : null}
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-white">Плей-офф блоки</div>
            <div className="text-sm text-zinc-400">Можно добавить несколько отдельных плей-офф с разными названиями и логикой выхода.</div>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              setBlueprint((current) => ({
                ...current,
                playoffs: [...current.playoffs, createDefaultPlayoffStage({ name: `Плей-офф ${current.playoffs.length + 1}` })],
              }))
            }
          >
            <Plus className="mr-2 h-4 w-4" />
            Добавить плей-офф
          </Button>
        </div>

        <div className="space-y-4">
          {!blueprint.playoffs.length ? (
            <div className="rounded-2xl border border-dashed border-white/10 bg-black/10 px-4 py-5 text-sm text-zinc-500">
              Плей-офф отключен. Турнир завершится после этапа “{blueprint.leagueStageName}”.
            </div>
          ) : null}

          {blueprint.playoffs.map((playoff, index) => (
            <div key={playoff.id} className="space-y-4 rounded-[1.75rem] border border-white/10 bg-black/20 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-semibold text-white">Плей-офф #{index + 1}</div>
                {hasOpeningStage || blueprint.playoffs.length > 1 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() =>
                      setBlueprint((current) => ({
                        ...current,
                        playoffs: current.playoffs.filter((item) => item.id !== playoff.id),
                      }))
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                ) : null}
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="space-y-2 md:col-span-2">
                  <Label>Название плей-офф</Label>
                  <Input value={playoff.name} onChange={(event) => updatePlayoff(playoff.id, (current) => ({ ...current, name: event.target.value }))} />
                </div>

                <div className="space-y-2">
                  <Label>Формат сетки</Label>
                  <select
                    value={playoff.type}
                    onChange={(event) =>
                      updatePlayoff(playoff.id, (current) => {
                        const nextType = event.target.value as PlayoffType;
                        return {
                          ...current,
                          type: nextType,
                          legsCount: nextType === PlayoffType.DOUBLE ? 1 : current.legsCount,
                          thirdPlaceMatch: nextType === PlayoffType.DOUBLE ? false : current.thirdPlaceMatch,
                          selections:
                            nextType === PlayoffType.SINGLE
                              ? current.selections.map((item) => ({ ...item, targetBracket: "upper" }))
                              : current.selections,
                        };
                      })
                    }
                    className="h-11 w-full rounded-xl border border-white/10 bg-white/5 px-4 text-white"
                  >
                    <option value={PlayoffType.SINGLE}>Single Elimination</option>
                    <option value={PlayoffType.DOUBLE}>Double Elimination</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label>Матчей в серии</Label>
                  <select
                    value={playoff.legsCount}
                    disabled={playoff.type === PlayoffType.DOUBLE}
                    onChange={(event) =>
                      updatePlayoff(playoff.id, (current) => ({
                        ...current,
                        legsCount: Math.max(1, Math.min(2, Number(event.target.value || 1))),
                      }))
                    }
                    className="h-11 w-full rounded-xl border border-white/10 bg-white/5 px-4 text-white disabled:opacity-50"
                  >
                    <option value={1}>1 матч</option>
                    <option value={2}>2 матча</option>
                  </select>
                </div>
              </div>

              <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-zinc-300">
                <input
                  type="checkbox"
                  checked={playoff.thirdPlaceMatch}
                  disabled={playoff.type === PlayoffType.DOUBLE}
                  onChange={(event) => updatePlayoff(playoff.id, (current) => ({ ...current, thirdPlaceMatch: event.target.checked }))}
                />
                Матч за 3-е место
              </label>

              {hasOpeningStage ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-white">Правила выхода</div>
                      <div className="mt-1 text-xs text-zinc-500">Укажите, какие места из этапа “{blueprint.leagueStageName}” проходят дальше.</div>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() =>
                        updatePlayoff(playoff.id, (current) => ({
                          ...current,
                          selections: [
                            ...current.selections,
                            createDefaultPlayoffSelection({
                              divisionIndex: 1,
                              fromRank: 1,
                              toRank: 1,
                              targetBracket: "upper",
                            }),
                          ],
                        }))
                      }
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Добавить правило
                    </Button>
                  </div>

                  <div className="space-y-3">
                    {playoff.selections.map((selection) => (
                      <div
                        key={selection.id}
                        className={`grid gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3 ${
                          playoff.type === PlayoffType.DOUBLE ? "md:grid-cols-[1fr_1fr_1fr_1fr_auto]" : "md:grid-cols-[1fr_1fr_1fr_auto]"
                        }`}
                      >
                        <div className="space-y-2">
                          <Label>{selectionSourceLabel}</Label>
                          <Input
                            type="number"
                            min={1}
                            max={blueprint.divisionsCount}
                            value={selection.divisionIndex}
                            onChange={(event) =>
                              updatePlayoff(playoff.id, (current) => ({
                                ...current,
                                selections: current.selections.map((item) =>
                                  item.id === selection.id
                                    ? { ...item, divisionIndex: Math.max(1, Math.min(blueprint.divisionsCount, Number(event.target.value || 1))) }
                                    : item,
                                ),
                              }))
                            }
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>С места</Label>
                          <Input
                            type="number"
                            min={1}
                            value={selection.fromRank}
                            onChange={(event) =>
                              updatePlayoff(playoff.id, (current) => ({
                                ...current,
                                selections: current.selections.map((item) =>
                                  item.id === selection.id ? { ...item, fromRank: Math.max(1, Number(event.target.value || 1)) } : item,
                                ),
                              }))
                            }
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>По место</Label>
                          <Input
                            type="number"
                            min={selection.fromRank}
                            value={selection.toRank}
                            onChange={(event) =>
                              updatePlayoff(playoff.id, (current) => ({
                                ...current,
                                selections: current.selections.map((item) =>
                                  item.id === selection.id ? { ...item, toRank: Math.max(item.fromRank, Number(event.target.value || item.fromRank)) } : item,
                                ),
                              }))
                            }
                          />
                        </div>

                        {playoff.type === PlayoffType.DOUBLE ? (
                          <div className="space-y-2">
                            <Label>Куда попадают</Label>
                            <select
                              value={selection.targetBracket}
                              onChange={(event) =>
                                updatePlayoff(playoff.id, (current) => ({
                                  ...current,
                                  selections: current.selections.map((item) =>
                                    item.id === selection.id ? { ...item, targetBracket: event.target.value as "upper" | "lower" } : item,
                                  ),
                                }))
                              }
                              className="h-11 w-full rounded-xl border border-white/10 bg-white/5 px-4 text-white"
                            >
                              <option value="upper">Верхняя сетка</option>
                              <option value="lower">Нижняя сетка</option>
                            </select>
                          </div>
                        ) : null}

                        <div className="flex items-end">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            disabled={playoff.selections.length === 1}
                            onClick={() =>
                              updatePlayoff(playoff.id, (current) => ({
                                ...current,
                                selections: current.selections.filter((item) => item.id !== selection.id),
                              }))
                            }
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {playoff.type === PlayoffType.SINGLE ? (
                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-zinc-400">
                      В single elimination все участники автоматически попадают в одну основную сетку.
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-zinc-400">
                  Этот плей-офф стартует напрямую: все подтвержденные участники будут посеяны по рейтингу, seed или порядку регистрации.
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
