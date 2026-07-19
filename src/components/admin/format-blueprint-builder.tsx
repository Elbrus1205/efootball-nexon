"use client";

import { PlayoffType } from "@prisma/client";
import { GitBranch, Layers3, Plus, TableProperties, Trash2, Trophy, UsersRound } from "lucide-react";
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
import {
  TournamentBuilderChoice,
  TournamentBuilderField,
  TournamentBuilderNotice,
  tournamentBuilderInputClass,
  tournamentBuilderSelectClass,
} from "@/components/admin/tournament-builder-ui";

function createOpeningStageSelections(mode: OpeningStageMode, playoffType: PlayoffType, divisionsCount: number) {
  if (mode === "LEAGUE") {
    const leaguesCount = Math.max(1, Math.min(16, divisionsCount));

    if (leaguesCount === 1) {
      return [
        createDefaultPlayoffSelection({ divisionIndex: 1, fromRank: 1, toRank: 8, targetBracket: "upper" }),
        ...(playoffType === PlayoffType.DOUBLE
          ? [createDefaultPlayoffSelection({ divisionIndex: 1, fromRank: 9, toRank: 16, targetBracket: "lower" })]
          : []),
      ];
    }

    const upperSelections = Array.from({ length: leaguesCount }, (_, index) =>
      createDefaultPlayoffSelection({ divisionIndex: index + 1, fromRank: 1, toRank: 4, targetBracket: "upper" }),
    );

    if (playoffType !== PlayoffType.DOUBLE) {
      return upperSelections;
    }

    const lowerSelections = Array.from({ length: leaguesCount }, (_, index) =>
      createDefaultPlayoffSelection({ divisionIndex: index + 1, fromRank: 5, toRank: 8, targetBracket: "lower" }),
    );

    return [...upperSelections, ...lowerSelections];
  }

  const groupsCount = Math.max(1, Math.min(16, divisionsCount));
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

function clampNumber(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function formatDivisionName(mode: OpeningStageMode, index: number) {
  const letter = String.fromCharCode(65 + index);
  return mode === "LEAGUE" ? `Лига ${index + 1}` : `Группа ${letter}`;
}

function NumberInput({
  id,
  ariaLabel,
  value,
  min,
  max,
  placeholder,
  onValueChange,
}: {
  id?: string;
  ariaLabel?: string;
  value: number | null;
  min: number;
  max: number;
  placeholder?: string;
  onValueChange: (value: number | null) => void;
}) {
  const [draft, setDraft] = useState(value === null ? "" : String(value));

  useEffect(() => {
    setDraft(value === null ? "" : String(value));
  }, [value]);

  return (
    <Input
      id={id}
      aria-label={ariaLabel}
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      value={draft}
      className={tournamentBuilderInputClass}
      placeholder={placeholder}
      onChange={(event) => {
        const nextDraft = event.target.value.replace(/\D/g, "");
        setDraft(nextDraft);

        if (!nextDraft) {
          onValueChange(null);
          return;
        }

        onValueChange(clampNumber(Number(nextDraft), min, max));
      }}
      onBlur={() => {
        if (!draft) {
          setDraft(value === null ? "" : String(value));
          return;
        }

        const nextValue = clampNumber(Number(draft), min, max);
        setDraft(String(nextValue));
        onValueChange(nextValue);
      }}
    />
  );
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

  const updateOpeningStageMode = (openingStageMode: OpeningStageMode) => {
    setBlueprint((current) => {
      const divisionsCount = openingStageMode === "NONE" ? current.divisionsCount : Math.max(1, current.divisionsCount);
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
  };

  if (!visible) {
    return <input type="hidden" name={name} value="" />;
  }

  return (
    <div className="min-w-0 space-y-7">
      <input type="hidden" name={name} value={stringifyFormatBlueprint(blueprint)} />

      <div className="flex flex-col gap-4 rounded-xl border border-primary/15 bg-primary/[0.05] p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
            <Layers3 className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <div className="text-sm font-semibold text-white">Сценарий турнира</div>
            <div className="mt-1 max-w-2xl text-xs leading-5 text-zinc-400">
              Настройте стартовый этап, число дивизионов и один или несколько блоков плей-офф.
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 text-[10px] font-bold uppercase tracking-[0.12em]">
          <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-zinc-400">
            {hasOpeningStage ? `${blueprint.divisionsCount} див.` : "Без групп"}
          </span>
          <span className="rounded-full border border-primary/20 bg-primary/[0.08] px-3 py-1.5 text-primary">
            Плей-офф: {blueprint.playoffs.length}
          </span>
        </div>
      </div>

      <TournamentBuilderField label="Стартовый этап" required description="Выбор меняет доступные параметры и автоматически подготавливает правила выхода.">
        <div className="grid gap-3 md:grid-cols-3">
          <TournamentBuilderChoice
            name="openingStageModePreview"
            value="GROUPS"
            title="Группы"
            description="Групповой этап, затем один или несколько плей-офф."
            icon={UsersRound}
            checked={blueprint.openingStageMode === "GROUPS"}
            onChange={() => updateOpeningStageMode("GROUPS")}
          />
          <TournamentBuilderChoice
            name="openingStageModePreview"
            value="LEAGUE"
            title="Лига"
            description="Одна или несколько лиг перед финальной стадией."
            icon={TableProperties}
            checked={blueprint.openingStageMode === "LEAGUE"}
            onChange={() => updateOpeningStageMode("LEAGUE")}
          />
          <TournamentBuilderChoice
            name="openingStageModePreview"
            value="NONE"
            title="Сразу плей-офф"
            description="Все подтверждённые участники сразу попадают в сетку."
            icon={GitBranch}
            checked={blueprint.openingStageMode === "NONE"}
            onChange={() => updateOpeningStageMode("NONE")}
          />
        </div>
      </TournamentBuilderField>

      <div className="grid gap-5 rounded-xl border border-white/10 bg-black/20 p-4 md:grid-cols-2 sm:p-5">

        {hasOpeningStage ? (
          <TournamentBuilderField htmlFor="leagueStageName" label="Название этапа">
            <Input
              id="leagueStageName"
              value={blueprint.leagueStageName}
              onChange={(event) => setBlueprint((current) => ({ ...current, leagueStageName: event.target.value }))}
              placeholder={blueprint.openingStageMode === "LEAGUE" ? "Лига" : "Группы"}
              className={tournamentBuilderInputClass}
            />
          </TournamentBuilderField>
        ) : null}

        {hasOpeningStage ? (
          <TournamentBuilderField htmlFor="divisionsCount" label={blueprint.openingStageMode === "LEAGUE" ? "Количество лиг" : "Количество групп"}>
            <NumberInput
              id="divisionsCount"
              value={blueprint.divisionsCount}
              min={1}
              max={16}
              onValueChange={(value) => {
                if (value === null) return;
                setBlueprint((current) =>
                  normalizeFormatBlueprint({
                    ...current,
                    divisionsCount: value,
                  }),
                );
              }}
            />
          </TournamentBuilderField>
        ) : null}

        {hasOpeningStage ? (
          <TournamentBuilderField htmlFor="roundsCount" label="Матчей с одним соперником" description="От 1 до 6 матчей. Все игры пары попадут в один тур.">
            <NumberInput
              id="roundsCount"
              value={blueprint.roundsCount}
              min={1}
              max={6}
              onValueChange={(value) => {
                if (value === null) return;
                setBlueprint((current) =>
                  normalizeFormatBlueprint({
                    ...current,
                    roundsCount: value,
                  }),
                );
              }}
            />
          </TournamentBuilderField>
        ) : null}

        {hasOpeningStage ? (
          <TournamentBuilderField
            htmlFor="openingRoundsCount"
            label={blueprint.openingStageMode === "LEAGUE" ? "Туров в лиге" : "Туров в групповом этапе"}
            description="Оставьте пустым для автоматического расчёта по количеству участников."
          >
            <NumberInput
              id="openingRoundsCount"
              value={blueprint.openingRoundsCount}
              min={1}
              max={128}
              placeholder="Авто"
              onValueChange={(value) => {
                setBlueprint((current) =>
                  normalizeFormatBlueprint({
                    ...current,
                    openingRoundsCount: value,
                  }),
                );
              }}
            />
          </TournamentBuilderField>
        ) : null}

        {hasOpeningStage ? (
          <TournamentBuilderField htmlFor="participantsPerGroup" label={blueprint.openingStageMode === "LEAGUE" ? "Игроков в лиге" : "Игроков в группе"}>
            <Input
              id="participantsPerGroup"
              type="number"
              min={2}
              max={32}
              value={blueprint.participantsPerGroup ?? ""}
              onChange={(event) => {
                const rawValue = event.target.value;
                setBlueprint((current) => ({
                  ...current,
                  participantsPerGroup: rawValue ? Number(rawValue) : null,
                }));
              }}
              onBlur={() => setBlueprint((current) => normalizeFormatBlueprint(current))}
              placeholder="Авто"
              inputMode="numeric"
              className={tournamentBuilderInputClass}
            />
          </TournamentBuilderField>
        ) : null}

        {!hasOpeningStage ? (
          <TournamentBuilderNotice className="md:col-span-2">
            Группового этапа не будет: все подтвержденные участники попадут в первую сетку плей-офф напрямую.
          </TournamentBuilderNotice>
        ) : null}
      </div>

      <div className="space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-black/20 text-primary">
              <Trophy className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <div className="text-sm font-semibold text-white">Плей-офф блоки</div>
              <div className="mt-1 text-xs leading-5 text-zinc-500">Добавляйте отдельные сетки с собственным форматом и логикой выхода.</div>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            className="w-full sm:w-auto"
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
            <div className="rounded-xl border border-dashed border-white/15 bg-black/15 px-4 py-6 text-center text-sm text-zinc-500">
              Плей-офф отключен. Турнир завершится после этапа “{blueprint.leagueStageName}”.
            </div>
          ) : null}

          {blueprint.playoffs.map((playoff, index) => (
            <div key={playoff.id} className="space-y-5 overflow-hidden rounded-xl border border-white/10 bg-black/20 p-4 sm:p-5">
              <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-4">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/[0.08] text-xs font-black text-primary">
                    {index + 1}
                  </span>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-white">{playoff.name || `Плей-офф ${index + 1}`}</div>
                    <div className="mt-0.5 text-[11px] text-zinc-500">Настройки сетки и переходов</div>
                  </div>
                </div>
                {hasOpeningStage || blueprint.playoffs.length > 1 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Удалить плей-офф ${index + 1}`}
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

              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
                <TournamentBuilderField htmlFor={`playoff-name-${playoff.id}`} label="Название плей-офф" className="md:col-span-2">
                  <Input
                    id={`playoff-name-${playoff.id}`}
                    value={playoff.name}
                    onChange={(event) => updatePlayoff(playoff.id, (current) => ({ ...current, name: event.target.value }))}
                    className={tournamentBuilderInputClass}
                  />
                </TournamentBuilderField>

                <TournamentBuilderField htmlFor={`playoff-type-${playoff.id}`} label="Формат сетки">
                  <select
                    id={`playoff-type-${playoff.id}`}
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
                    className={tournamentBuilderSelectClass}
                  >
                    <option value={PlayoffType.SINGLE}>Single Elimination</option>
                    <option value={PlayoffType.DOUBLE}>Double Elimination</option>
                  </select>
                </TournamentBuilderField>

                <TournamentBuilderField htmlFor={`playoff-legs-${playoff.id}`} label="Матчей в серии" description={playoff.type === PlayoffType.DOUBLE ? "Для Double Elimination используется один матч." : undefined}>
                  <select
                    id={`playoff-legs-${playoff.id}`}
                    value={playoff.legsCount}
                    disabled={playoff.type === PlayoffType.DOUBLE}
                    onChange={(event) =>
                      updatePlayoff(playoff.id, (current) => ({
                        ...current,
                        legsCount: Math.max(1, Math.min(2, Number(event.target.value || 1))),
                      }))
                    }
                    className={tournamentBuilderSelectClass}
                  >
                    <option value={1}>1 матч</option>
                    <option value={2}>2 матча</option>
                  </select>
                </TournamentBuilderField>
              </div>

              <label className="flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border border-white/10 bg-white/[0.025] px-4 py-3 text-sm text-zinc-300 transition hover:border-white/20 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50">
                <input
                  type="checkbox"
                  checked={playoff.thirdPlaceMatch}
                  disabled={playoff.type === PlayoffType.DOUBLE}
                  className="h-5 w-5 shrink-0 accent-primary"
                  onChange={(event) => updatePlayoff(playoff.id, (current) => ({ ...current, thirdPlaceMatch: event.target.checked }))}
                />
                Матч за 3-е место
              </label>

              {hasOpeningStage ? (
                <div className="space-y-4 border-t border-white/10 pt-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="text-sm font-semibold text-white">Правила выхода</div>
                      <div className="mt-1 text-xs text-zinc-500">Укажите, какие места из этапа “{blueprint.leagueStageName}” проходят дальше.</div>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full sm:w-auto"
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
                        className={`grid min-w-0 gap-3 rounded-xl border border-white/10 bg-white/[0.025] p-3 ${
                          playoff.type === PlayoffType.DOUBLE ? "lg:grid-cols-[1.2fr_0.75fr_0.75fr_1fr_auto]" : "lg:grid-cols-[1.2fr_0.75fr_0.75fr_auto]"
                        }`}
                      >
                        <div className="space-y-2">
                          <Label htmlFor={`selection-source-${selection.id}`}>{selectionSourceLabel}</Label>
                          <select
                            id={`selection-source-${selection.id}`}
                            value={selection.divisionIndex}
                            onChange={(event) =>
                              updatePlayoff(playoff.id, (current) => ({
                                ...current,
                                selections: current.selections.map((item) =>
                                  item.id === selection.id ? { ...item, divisionIndex: Number(event.target.value) } : item,
                                ),
                              }))
                            }
                            className={tournamentBuilderSelectClass}
                          >
                            {Array.from({ length: blueprint.divisionsCount }, (_, index) => (
                              <option key={index + 1} value={index + 1}>
                                {formatDivisionName(blueprint.openingStageMode, index)}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor={`selection-from-${selection.id}`}>С места</Label>
                          <NumberInput
                            id={`selection-from-${selection.id}`}
                            value={selection.fromRank}
                            min={1}
                            max={32}
                            onValueChange={(value) => {
                              if (value === null) return;
                              updatePlayoff(playoff.id, (current) => ({
                                ...current,
                                selections: current.selections.map((item) =>
                                  item.id === selection.id
                                    ? { ...item, fromRank: value, toRank: Math.max(value, item.toRank) }
                                    : item,
                                ),
                              }));
                            }}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor={`selection-to-${selection.id}`}>По место</Label>
                          <NumberInput
                            id={`selection-to-${selection.id}`}
                            value={selection.toRank}
                            min={selection.fromRank}
                            max={32}
                            onValueChange={(value) => {
                              if (value === null) return;
                              updatePlayoff(playoff.id, (current) => ({
                                ...current,
                                selections: current.selections.map((item) =>
                                  item.id === selection.id ? { ...item, toRank: Math.max(item.fromRank, value) } : item,
                                ),
                              }));
                            }}
                          />
                        </div>

                        {playoff.type === PlayoffType.DOUBLE ? (
                          <div className="space-y-2">
                            <Label htmlFor={`selection-target-${selection.id}`}>Куда попадают</Label>
                            <select
                              id={`selection-target-${selection.id}`}
                              value={selection.targetBracket}
                              onChange={(event) =>
                                updatePlayoff(playoff.id, (current) => ({
                                  ...current,
                                  selections: current.selections.map((item) =>
                                    item.id === selection.id ? { ...item, targetBracket: event.target.value as "upper" | "lower" } : item,
                                  ),
                                }))
                              }
                              className={tournamentBuilderSelectClass}
                            >
                              <option value="upper">Верхняя сетка</option>
                              <option value="lower">Нижняя сетка</option>
                            </select>
                          </div>
                        ) : null}

                        <div className="flex items-end justify-end">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            disabled={playoff.selections.length === 1}
                            aria-label="Удалить правило выхода"
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
                    <TournamentBuilderNotice>
                      В single elimination все участники автоматически попадают в одну основную сетку.
                    </TournamentBuilderNotice>
                  ) : null}
                </div>
              ) : (
                <TournamentBuilderNotice>
                  Этот плей-офф стартует напрямую: все подтвержденные участники будут посеяны по рейтингу, seed или порядку регистрации.
                </TournamentBuilderNotice>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
