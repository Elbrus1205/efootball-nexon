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
} from "@/lib/format-blueprint";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
        <div className="text-sm font-semibold uppercase tracking-[0.24em] text-primary">Кастомный формат</div>
        <div className="text-sm text-zinc-400">
          Настрой общую стадию лиг с несколькими дивизионами, затем добавь один или несколько плей-офф и укажи, какие места
          из какой лиги попадают в сетку.
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="leagueStageName">Название блока лиг</Label>
          <Input
            id="leagueStageName"
            value={blueprint.leagueStageName}
            onChange={(event) => setBlueprint((current) => ({ ...current, leagueStageName: event.target.value }))}
            placeholder="Лиги"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="divisionsCount">Сколько лиг / дивизионов</Label>
          <Input
            id="divisionsCount"
            type="number"
            min={1}
            max={8}
            value={blueprint.divisionsCount}
            onChange={(event) =>
              setBlueprint((current) => ({
                ...current,
                divisionsCount: Math.max(1, Math.min(8, Number(event.target.value || 1))),
              }))
            }
          />
        </div>
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
          {blueprint.playoffs.map((playoff, index) => (
            <div key={playoff.id} className="space-y-4 rounded-[1.75rem] border border-white/10 bg-black/20 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-semibold text-white">Плей-офф #{index + 1}</div>
                {blueprint.playoffs.length > 1 ? (
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

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-white">Правила выхода</div>
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
                            targetBracket: current.type === PlayoffType.SINGLE ? "upper" : "upper",
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
                        <Label>Из лиги</Label>
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
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
