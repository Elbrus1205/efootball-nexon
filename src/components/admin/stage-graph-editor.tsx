"use client";

import { PlayoffType } from "@prisma/client";
import { ArrowRight, Check, CircleHelp, Eye, GripVertical, Layers3, Link2, Plus, Settings2, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  normalizeStageGraph,
  type StageGraphBlueprint,
  type StageGraphResult,
  type StageGraphStage,
  type StageGraphStageType,
  type StageGraphTransition,
} from "@/lib/tournament-stage-graph";
import { tournamentBuilderInputClass, tournamentBuilderSelectClass } from "@/components/admin/tournament-builder-ui";

type Props = { value: StageGraphBlueprint; onChange: (value: StageGraphBlueprint) => void };

const typeMeta: Record<StageGraphStageType, { label: string; hint: string; tone: string }> = {
  GROUPS: { label: "Группы", hint: "Участники играют внутри групп, затем выходят по местам.", tone: "border-sky-300/25 bg-sky-300/[0.06] text-sky-100" },
  LEAGUE: { label: "Лига", hint: "Общая таблица с распределением по дивизионам.", tone: "border-emerald-300/25 bg-emerald-300/[0.06] text-emerald-100" },
  PLAYOFF: { label: "Плей-офф", hint: "Выбывание по сетке до определения победителя.", tone: "border-amber-300/25 bg-amber-300/[0.06] text-amber-100" },
};
const resultMeta: Record<StageGraphResult, { label: string; description: string }> = {
  RANK: { label: "Места в таблице", description: "Передаются участники из диапазона мест." },
  WINNER: { label: "Победитель этапа", description: "Передаётся победитель сетки." },
  RUNNER_UP: { label: "Финалист этапа", description: "Передаётся проигравший финалист." },
  THIRD_PLACE: { label: "3-е место", description: "Передаётся победитель матча за третье место." },
};

const makeId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
const clamp = (value: string, min: number, max: number) => Math.max(min, Math.min(max, Number(value) || min));
const createStage = (index: number): StageGraphStage => ({ id: makeId("stage"), name: `Этап ${index + 1}`, type: "GROUPS", divisionsCount: 1, participantsPerDivision: null, roundsCount: 1, matchesPerOpponent: 1 });
const createTransition = (fromStageId: string, toStageId: string): StageGraphTransition => ({ id: makeId("transition"), fromStageId, toStageId, result: "RANK", fromDivisionIndex: 1, fromRank: 1, toRank: 1, toDivisionIndex: 1, targetBracket: "upper" });

function stageSummary(stage: StageGraphStage) {
  if (stage.type === "PLAYOFF") return `${stage.playoffType === PlayoffType.DOUBLE ? "Double" : "Single"} • сетка ${stage.bracketSize ?? "авто"} • ${stage.legsCount ?? 1} матч${stage.legsCount === 1 ? "" : "а"} в серии`;
  return `${stage.divisionsCount} ${stage.type === "LEAGUE" ? "лиг" : "групп"} • ${stage.roundsCount} тур${stage.roundsCount === 1 ? "" : "ов"}`;
}

export function StageGraphEditor({ value, onChange }: Props) {
  const [graph, setGraph] = useState(() => normalizeStageGraph(value));
  const [visualOpen, setVisualOpen] = useState(false);
  const [draggedStageId, setDraggedStageId] = useState<string | null>(null);
  const [selectedStageId, setSelectedStageId] = useState<string | null>(graph.stages[0]?.id ?? null);

  useEffect(() => {
    const next = normalizeStageGraph(value);
    setGraph(next);
    setSelectedStageId((current) => current && next.stages.some((stage) => stage.id === current) ? current : next.stages[0]?.id ?? null);
  }, [value]);

  const stages = graph.stages;
  const playoffs = stages.filter((stage) => stage.type === "PLAYOFF");
  const selectedStage = stages.find((stage) => stage.id === selectedStageId) ?? null;
  const commit = (next: StageGraphBlueprint) => { setGraph(next); onChange(next); };
  const update = (fn: (current: StageGraphBlueprint) => StageGraphBlueprint) => commit(fn(graph));
  const updateStage = (id: string, patch: Partial<StageGraphStage>) => update((current) => ({ ...current, stages: current.stages.map((stage) => stage.id === id ? { ...stage, ...patch } : stage) }));
  const removeStage = (id: string) => update((current) => ({ ...current, stages: current.stages.filter((stage) => stage.id !== id), transitions: current.transitions.filter((transition) => transition.fromStageId !== id && transition.toStageId !== id), superCup: { ...current.superCup, sourcePlayoffIds: current.superCup.sourcePlayoffIds.filter((sourceId) => sourceId !== id) } }));
  const addTransition = (from: string, to: string) => { if (!from || !to || from === to || graph.transitions.some((item) => item.fromStageId === from && item.toStageId === to)) return; update((current) => ({ ...current, transitions: [...current.transitions, createTransition(from, to)] })); };
  const toggleSuperCup = (enabled: boolean) => update((current) => {
    if (enabled) return { ...current, superCup: { ...current.superCup, enabled: true, sourcePlayoffIds: current.superCup.sourcePlayoffIds.length >= 2 ? current.superCup.sourcePlayoffIds : playoffs.slice(0, 2).map((stage) => stage.id) } };
    return { ...current, superCup: { ...current.superCup, enabled: false }, stages: current.stages.filter((stage) => stage.id !== "supercup"), transitions: current.transitions.filter((transition) => transition.toStageId !== "supercup") };
  });

  const stageCard = (stage: StageGraphStage, index: number, visual = false) => {
    const meta = typeMeta[stage.type];
    return (
      <article key={stage.id} draggable={visual} onDragStart={() => visual && setDraggedStageId(stage.id)} onDragEnd={() => setDraggedStageId(null)} onDragOver={(event) => visual && event.preventDefault()} onDrop={(event) => { event.preventDefault(); if (visual && draggedStageId) addTransition(draggedStageId, stage.id); setDraggedStageId(null); }} onClick={() => setSelectedStageId(stage.id)} className={`min-w-0 rounded-xl border p-4 transition ${selectedStageId === stage.id ? "border-primary/55 bg-primary/[0.08]" : "border-white/10 bg-black/25 hover:border-white/20"}`}>
        <div className="flex items-start gap-3">
          {visual ? <span className="mt-1 cursor-grab text-zinc-500" aria-label="Перетащить этап"><GripVertical className="h-5 w-5" /></span> : <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/[0.05] text-xs font-bold text-zinc-400">{index + 1}</span>}
          <div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><div><span className={`inline-flex rounded-full border px-2 py-1 text-[10px] font-bold uppercase tracking-[0.1em] ${meta.tone}`}>{meta.label}</span><h4 className="mt-2 break-words text-sm font-semibold text-white">{stage.name}</h4></div>{stages.length > 1 && !visual ? <Button type="button" variant="ghost" size="icon" aria-label={`Удалить этап ${stage.name}`} onClick={(event) => { event.stopPropagation(); removeStage(stage.id); }}><Trash2 className="h-4 w-4" /></Button> : null}</div><p className="mt-1 text-xs text-zinc-500">{stageSummary(stage)}</p><p className="mt-2 text-xs leading-5 text-zinc-400">{meta.hint}</p></div>
        </div>
      </article>
    );
  };

  return (
    <section className="space-y-5 rounded-2xl border border-primary/20 bg-[#171717] p-4 sm:p-6">
      <div className="flex flex-col gap-4 border-b border-white/10 pb-5 lg:flex-row lg:items-start lg:justify-between"><div className="flex gap-3"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 text-primary"><Layers3 className="h-5 w-5" /></div><div><h3 className="text-base font-semibold text-white">Визуальная схема турнира</h3><p className="mt-1 max-w-2xl text-sm leading-6 text-zinc-400">Добавьте этапы и соедините их. Переходы определяют, кто попадёт в следующий этап.</p></div></div><Button type="button" variant="outline" className="min-h-11" onClick={() => setVisualOpen(true)}><Eye className="mr-2 h-4 w-4" />Открыть схему</Button></div>
      <div className="grid gap-3 sm:grid-cols-3"><div className="rounded-xl border border-white/10 bg-black/20 p-3"><div className="text-xs text-zinc-500">Этапы</div><div className="mt-1 text-xl font-semibold text-white">{stages.length}</div></div><div className="rounded-xl border border-white/10 bg-black/20 p-3"><div className="text-xs text-zinc-500">Переходы</div><div className="mt-1 text-xl font-semibold text-white">{graph.transitions.length}</div></div><div className="rounded-xl border border-amber-300/20 bg-amber-300/[0.05] p-3"><div className="text-xs text-amber-100/70">Финальный блок</div><div className="mt-1 text-sm font-semibold text-amber-100">{graph.superCup.enabled ? graph.superCup.name : "Не включён"}</div></div></div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h4 className="text-sm font-semibold text-white">Этапы и параметры</h4><p className="mt-1 text-xs leading-5 text-zinc-500">Настройки сохраняются вместе с турниром.</p></div><Button type="button" variant="outline" className="min-h-11" onClick={() => { const stage = createStage(stages.length); update((current) => ({ ...current, stages: [...current.stages, stage] })); setSelectedStageId(stage.id); }}><Plus className="mr-2 h-4 w-4" />Добавить этап</Button></div>
      <div className="grid gap-3 lg:grid-cols-2">{stages.map((stage, index) => stageCard(stage, index))}</div>
      {selectedStage ? <div className="space-y-4 rounded-xl border border-white/10 bg-black/20 p-4 sm:p-5"><div className="flex items-center gap-2"><Settings2 className="h-4 w-4 text-primary" /><h4 className="text-sm font-semibold text-white">Настройки этапа: {selectedStage.name}</h4></div><div className="grid gap-4 md:grid-cols-2"><label className="space-y-2 text-xs text-zinc-300">Название этапа<Input value={selectedStage.name} className={tournamentBuilderInputClass} onChange={(event) => updateStage(selectedStage.id, { name: event.target.value })} /></label><label className="space-y-2 text-xs text-zinc-300">Тип этапа<select className={tournamentBuilderSelectClass} value={selectedStage.type} onChange={(event) => updateStage(selectedStage.id, { type: event.target.value as StageGraphStageType, divisionsCount: event.target.value === "PLAYOFF" ? 1 : selectedStage.divisionsCount, bracketSize: event.target.value === "PLAYOFF" ? selectedStage.bracketSize : null })}><option value="GROUPS">Группы</option><option value="LEAGUE">Лига</option><option value="PLAYOFF">Плей-офф</option></select></label>{selectedStage.type !== "PLAYOFF" ? <><label className="space-y-2 text-xs text-zinc-300">Количество групп или лиг<Input type="number" min={1} max={32} value={selectedStage.divisionsCount} className={tournamentBuilderInputClass} onChange={(event) => updateStage(selectedStage.id, { divisionsCount: clamp(event.target.value, 1, 32) })} /></label><label className="space-y-2 text-xs text-zinc-300">Участников в каждой группе<Input type="number" min={2} max={64} value={selectedStage.participantsPerDivision ?? ""} className={tournamentBuilderInputClass} onChange={(event) => updateStage(selectedStage.id, { participantsPerDivision: event.target.value ? clamp(event.target.value, 2, 64) : null })} /></label><label className="space-y-2 text-xs text-zinc-300">Количество туров<Input type="number" min={1} max={128} value={selectedStage.roundsCount} className={tournamentBuilderInputClass} onChange={(event) => updateStage(selectedStage.id, { roundsCount: clamp(event.target.value, 1, 128) })} /></label><label className="space-y-2 text-xs text-zinc-300">Матчей между соперниками<Input type="number" min={1} max={6} value={selectedStage.matchesPerOpponent ?? ""} className={tournamentBuilderInputClass} onChange={(event) => updateStage(selectedStage.id, { matchesPerOpponent: event.target.value ? clamp(event.target.value, 1, 6) : null })} /></label></> : <><label className="space-y-2 text-xs text-zinc-300">Формат сетки<select className={tournamentBuilderSelectClass} value={selectedStage.playoffType ?? PlayoffType.SINGLE} onChange={(event) => updateStage(selectedStage.id, { playoffType: event.target.value as PlayoffType })}><option value={PlayoffType.SINGLE}>Single Elimination</option><option value={PlayoffType.DOUBLE}>Double Elimination</option></select></label><label className="space-y-2 text-xs text-zinc-300">Команд в сетке<select className={tournamentBuilderSelectClass} value={selectedStage.bracketSize ?? "auto"} onChange={(event) => updateStage(selectedStage.id, { bracketSize: event.target.value === "auto" ? null : Number(event.target.value) })}><option value="auto">Рассчитать по переходам</option>{[2, 4, 8, 16, 32, 64, 128].map((size) => <option key={size} value={size}>{size} команд</option>)}</select></label><label className="space-y-2 text-xs text-zinc-300">Матчей в серии<Input type="number" min={1} max={2} value={selectedStage.legsCount ?? 1} className={tournamentBuilderInputClass} onChange={(event) => updateStage(selectedStage.id, { legsCount: clamp(event.target.value, 1, 2) })} /></label><label className="flex min-h-12 items-center gap-3 rounded-xl border border-white/10 bg-black/20 px-3 text-xs text-zinc-300"><input type="checkbox" className="h-5 w-5 accent-primary" checked={selectedStage.thirdPlaceMatch ?? false} onChange={(event) => updateStage(selectedStage.id, { thirdPlaceMatch: event.target.checked })} />Создать матч за 3-е место</label></>}</div><div className="flex items-center justify-between gap-3 border-t border-white/10 pt-4"><p className="text-xs leading-5 text-zinc-500">{typeMeta[selectedStage.type].hint}</p>{stages.length > 1 ? <Button type="button" variant="ghost" className="text-red-200" onClick={() => removeStage(selectedStage.id)}><Trash2 className="mr-2 h-4 w-4" />Удалить этап</Button> : null}</div></div> : null}
      <div className="space-y-4 rounded-xl border border-white/10 bg-black/20 p-4 sm:p-5"><div className="flex items-start gap-3"><CircleHelp className="mt-0.5 h-5 w-5 shrink-0 text-primary" /><div><h4 className="text-sm font-semibold text-white">Как читать переходы</h4><p className="mt-1 text-xs leading-5 text-zinc-400">«Лига 1, места 1–4 → Плей-офф» означает, что четыре лучших участника попадут в сетку.</p></div></div>{graph.transitions.length ? <div className="space-y-2">{graph.transitions.map((transition) => { const patchTransition = (patch: Partial<StageGraphTransition>) => update((current) => ({ ...current, transitions: current.transitions.map((item) => item.id === transition.id ? { ...item, ...patch } : item) })); return <div key={transition.id} className="grid gap-3 rounded-xl border border-white/10 bg-black/20 p-3 md:grid-cols-[1fr_auto_1fr_1.5fr_auto]"><select aria-label="Исходный этап" className={tournamentBuilderSelectClass} value={transition.fromStageId} onChange={(event) => patchTransition({ fromStageId: event.target.value })}>{stages.map((stage) => <option key={stage.id} value={stage.id}>{stage.name}</option>)}</select><ArrowRight className="hidden self-center text-primary md:block" /><select aria-label="Целевой этап" className={tournamentBuilderSelectClass} value={transition.toStageId} onChange={(event) => patchTransition({ toStageId: event.target.value })}>{stages.map((stage) => <option key={stage.id} value={stage.id}>{stage.name}</option>)}</select><div className="space-y-2"><select aria-label="Правило перехода" className={tournamentBuilderSelectClass} value={transition.result} onChange={(event) => { const result = event.target.value as StageGraphResult; patchTransition({ result, fromRank: result === "RANK" ? transition.fromRank ?? 1 : null, toRank: result === "RANK" ? transition.toRank ?? transition.fromRank ?? 1 : null }); }}>{(Object.keys(resultMeta) as StageGraphResult[]).map((result) => <option key={result} value={result}>{resultMeta[result].label}</option>)}</select><p className="text-[11px] text-zinc-500">{resultMeta[transition.result].description}</p></div><div className="flex items-center gap-2">{transition.result === "RANK" ? <><Input aria-label="Начальное место" type="number" min={1} max={128} value={transition.fromRank ?? 1} className={tournamentBuilderInputClass} onChange={(event) => { const fromRank = clamp(event.target.value, 1, 128); patchTransition({ fromRank, toRank: Math.max(transition.toRank ?? 1, fromRank) }); }} /><span className="text-zinc-500">–</span><Input aria-label="Конечное место" type="number" min={1} max={128} value={transition.toRank ?? transition.fromRank ?? 1} className={tournamentBuilderInputClass} onChange={(event) => patchTransition({ toRank: Math.max(transition.fromRank ?? 1, clamp(event.target.value, transition.fromRank ?? 1, 128)) })} /></> : <span className="text-xs text-zinc-500">Результат этапа</span>}</div><Button type="button" variant="ghost" size="icon" aria-label="Удалить переход" onClick={() => update((current) => ({ ...current, transitions: current.transitions.filter((item) => item.id !== transition.id) }))}><Trash2 className="h-4 w-4" /></Button></div>; })}</div> : <p className="rounded-lg border border-dashed border-white/15 px-4 py-5 text-center text-xs text-zinc-500">Переходов пока нет.</p>}<Button type="button" variant="outline" disabled={stages.length < 2} onClick={() => addTransition(stages[0]?.id ?? "", stages[1]?.id ?? "")}><Link2 className="mr-2 h-4 w-4" />Добавить переход</Button></div>
      {playoffs.length >= 2 ? (
        <div className="space-y-3 rounded-xl border border-amber-300/20 bg-amber-300/[0.05] p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <input type="checkbox" className="mt-1 h-5 w-5 accent-primary" checked={graph.superCup.enabled} onChange={(event) => toggleSuperCup(event.target.checked)} />
            <div className="min-w-0 flex-1">
              <h4 className="text-sm font-semibold text-amber-100">Суперкубок</h4>
              <p className="mt-1 text-xs leading-5 text-amber-100/65">Дополнительный плей-офф между победителями выбранных сеток.</p>
              {graph.superCup.enabled ? (
                <div className="mt-4 space-y-3">
                  <label className="block space-y-2 text-xs text-amber-100">Название<Input value={graph.superCup.name} className={tournamentBuilderInputClass} onChange={(event) => update((current) => ({ ...current, superCup: { ...current.superCup, name: event.target.value } }))} /></label>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {playoffs.map((stage) => <label key={stage.id} className="flex min-h-11 items-center gap-2 rounded-lg border border-amber-200/15 bg-black/15 px-3 text-xs text-amber-50"><input type="checkbox" className="h-5 w-5 accent-primary" checked={graph.superCup.sourcePlayoffIds.includes(stage.id)} onChange={(event) => update((current) => ({ ...current, superCup: { ...current.superCup, sourcePlayoffIds: event.target.checked ? [...current.superCup.sourcePlayoffIds, stage.id] : current.superCup.sourcePlayoffIds.filter((id) => id !== stage.id) } }))} />{stage.name}</label>)}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
      {visualOpen ? <div className="fixed inset-0 z-[100] overflow-y-auto bg-black/80 p-3 backdrop-blur-sm sm:p-6"><div className="mx-auto max-w-6xl rounded-2xl border border-primary/25 bg-[#171717] p-4 shadow-2xl sm:p-6"><div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4"><div><div className="flex items-center gap-2"><Eye className="h-5 w-5 text-primary" /><h3 className="text-lg font-semibold text-white">Схема турнира</h3></div><p className="mt-1 max-w-2xl text-sm leading-6 text-zinc-400">Перетащите карточку этапа на другую, чтобы создать переход.</p></div><Button type="button" variant="ghost" size="icon" aria-label="Закрыть схему" onClick={() => setVisualOpen(false)}><X className="h-5 w-5" /></Button></div><div className="mt-5 rounded-2xl border border-white/10 bg-[#101010] p-4 sm:p-6"><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{stages.map((stage, index) => stageCard(stage, index, true))}</div>{graph.transitions.length ? <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-white/10 pt-5">{graph.transitions.map((transition) => <div key={transition.id} className="flex items-center gap-2 rounded-full border border-primary/20 bg-primary/[0.07] px-3 py-2 text-xs text-zinc-300"><span>{stages.find((stage) => stage.id === transition.fromStageId)?.name ?? "?"}</span><ArrowRight className="h-3 w-3 text-primary" /><span>{stages.find((stage) => stage.id === transition.toStageId)?.name ?? "?"}</span><Check className="h-3 w-3 text-emerald-300" /></div>)}</div> : <p className="mt-5 border-t border-dashed border-white/10 pt-5 text-center text-sm text-zinc-500">Связей пока нет. Перетащите один этап на другой.</p>}</div><div className="mt-5 flex justify-end"><Button type="button" className="min-h-11" onClick={() => setVisualOpen(false)}>Применить схему</Button></div></div></div> : null}
    </section>
  );
}
