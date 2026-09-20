"use client";

import { Check, Download, ImageDown, Loader2 } from "lucide-react";
import { useRef, useState } from "react";
import { downloadScheduleImages } from "@/lib/tournaments/download-schedule";
import { downloadStandingsImages } from "@/lib/tournaments/standings-poster-canvas";
import { standingsPosterPages, type ExportGroup } from "@/lib/tournaments/standings-poster";
import { balancedSchedulePages, schedulePosterCapacity, schedulePosterFixtures, type ExportScheduleRound } from "@/lib/tournaments/schedule-poster";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export type { ExportGroup, ExportGroupRow } from "@/lib/tournaments/standings-poster";
export type { ExportScheduleRound } from "@/lib/tournaments/schedule-poster";

const categories = [
  { id: "groups", label: "Группы", format: "1:1", size: "1600 × 1600" },
  { id: "leagues", label: "Лиги", format: "1:1", size: "1600 × 1600" },
  { id: "playoffs", label: "Плей-офф", format: "16:9", size: "1920 × 1080" },
] as const;
type Category = typeof categories[number]["id"];

function Selection({ active, title, detail, disabled, onClick }: { active: boolean; title: string; detail: string; disabled: boolean; onClick: () => void }) {
  return <button type="button" aria-pressed={active} disabled={disabled} onClick={onClick}
    className={`flex min-h-11 min-w-0 items-center gap-2.5 rounded-md border px-3 py-2 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50 ${active ? "border-primary/35 bg-primary/[0.07] text-zinc-100" : "border-white/10 bg-white/[0.02] text-zinc-400 hover:border-white/25"}`}>
    <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${active ? "border-primary bg-primary text-black" : "border-zinc-600"}`}>{active && <Check className="h-3 w-3" />}</span>
    <span className="min-w-0"><span className="block break-words text-sm font-medium">{title}</span><span className="mt-0.5 block text-xs text-zinc-500">{detail}</span></span>
  </button>;
}

export function TournamentImageExporter({ tournamentTitle, groups, rounds }: { tournamentTitle: string; groups: ExportGroup[]; rounds: ExportScheduleRound[] }) {
  const [category, setCategory] = useState<Category>(() => categories.find((item) => groups.some((group) => group.kind === item.id) || rounds.some((round) => round.kind === item.id))?.id ?? "groups");
  const [selectedGroupIds, setSelectedGroupIds] = useState(() => groups.map((group) => group.id));
  const [selectedRoundKeys, setSelectedRoundKeys] = useState(() => rounds.map((round) => round.key));
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const exportLock = useRef(false);
  const visibleGroups = groups.filter((group) => group.kind === category);
  const visibleRounds = rounds.filter((round) => (round.kind ?? "groups") === category);
  const selectedGroups = visibleGroups.filter((group) => selectedGroupIds.includes(group.id));
  const selectedRounds = visibleRounds.filter((round) => selectedRoundKeys.includes(round.key));
  const tablePages = standingsPosterPages(selectedGroups).length;
  const schedulePages = selectedRounds.reduce((sum, round) => sum + balancedSchedulePages(schedulePosterFixtures(round.matches), schedulePosterCapacity(round.format)).length, 0);
  const sections = [...new Set(visibleRounds.map((round) => round.sectionKey ?? "schedule"))].map((key) => ({
    key, rounds: visibleRounds.filter((round) => (round.sectionKey ?? "schedule") === key),
  }));
  const toggle = (items: string[], key: string) => items.includes(key) ? items.filter((id) => id !== key) : [...items, key];
  const toggleAll = (items: string[], keys: string[]) => keys.every((key) => items.includes(key)) ? items.filter((key) => !keys.includes(key)) : [...new Set([...items, ...keys])];
  const format = categories.find((item) => item.id === category)!;

  const runExport = async (action: () => Promise<number>) => {
    if (exportLock.current) return;
    exportLock.current = true;
    setBusy(true);
    setError(false);
    setStatus("Подготавливаю изображения…");
    try {
      const count = await action();
      setStatus(count > 1 ? `Готово: ZIP с ${count} изображениями PNG.` : "Готово: изображение PNG скачано.");
    } catch {
      setError(true);
      setStatus("Не удалось создать изображения. Попробуйте ещё раз или выберите меньше туров.");
    } finally {
      exportLock.current = false;
      setBusy(false);
    }
  };
  return <Card className="min-w-0 overflow-hidden rounded-lg border-primary/15 bg-white/[0.045] p-0">
    <CardHeader className="mb-0 border-b border-white/10 p-4 sm:p-5">
      <CardTitle className="flex items-center gap-2"><ImageDown className="h-5 w-5 text-primary" />Скачать изображения</CardTitle>
      <CardDescription>Таблицы и расписания для публикаций. Большие списки автоматически продолжаются на следующем фото.</CardDescription>
    </CardHeader>
    <CardContent className="min-w-0 space-y-4 p-3 sm:p-5">
      <div className="grid grid-cols-3 gap-1 rounded-lg border border-white/10 bg-black/20 p-1" role="group" aria-label="Этапы для экспорта">
        {categories.map((item) => <button key={item.id} type="button" aria-pressed={category === item.id} disabled={busy} onClick={() => { setCategory(item.id); setStatus(null); }}
          className={`min-h-11 min-w-0 rounded-md px-1 py-2 text-xs transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary sm:text-sm ${category === item.id ? "bg-white/[0.09] text-white" : "text-zinc-500 hover:text-zinc-200"}`}>
          <span className="block font-medium">{item.label}</span><span className="mt-0.5 block text-[10px] text-zinc-500 sm:text-xs">{item.format}</span>
        </button>)}
      </div>
      <p className="text-xs leading-relaxed text-zinc-400">{format.size} px · {category === "playoffs" ? "Каждая сетка и раунд — отдельно. Ответные встречи и серии показаны одной парой." : "Каждая группа или лига — отдельно. До 12 участников или пар на фото."} Несколько фото скачиваются одним ZIP.</p>
      <div className={`grid min-w-0 gap-3 ${category !== "playoffs" ? "xl:grid-cols-2" : ""}`}>
        {category !== "playoffs" && <section aria-label="Таблицы" className="min-w-0 space-y-3 rounded-lg border border-white/10 bg-black/20 p-3 sm:p-4">
          <div className="flex items-center justify-between gap-2"><h3 className="text-sm font-medium text-zinc-100">Таблицы</h3>
            <Button type="button" size="sm" variant="ghost" disabled={busy || !visibleGroups.length} onClick={() => setSelectedGroupIds((current) => toggleAll(current, visibleGroups.map((group) => group.id)))}>{selectedGroups.length === visibleGroups.length ? "Снять все" : "Выбрать все"}</Button>
          </div>
          <div className="grid max-h-80 gap-2 overflow-y-auto">
            {visibleGroups.map((group) => <Selection key={group.id} title={group.name} detail={`${group.stageName} · Участников: ${group.rows.length}`} active={selectedGroupIds.includes(group.id)} disabled={busy} onClick={() => setSelectedGroupIds((current) => toggle(current, group.id))} />)}
            {!visibleGroups.length && <p className="py-4 text-sm text-zinc-500">{category === "leagues" ? "Лиги ещё не созданы." : "Группы ещё не созданы."}</p>}
          </div>
          <Button type="button" variant="outline" className="w-full text-xs sm:text-sm" disabled={busy || !selectedGroups.length} onClick={() => runExport(() => downloadStandingsImages(tournamentTitle, selectedGroups, setStatus))}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 motion-safe:animate-spin" /> : <Download className="mr-2 h-4 w-4" />}Таблицы PNG{tablePages ? ` · ${tablePages}` : ""}
          </Button>
        </section>}
        <section aria-label="Расписание" className="min-w-0 space-y-3 rounded-lg border border-white/10 bg-black/20 p-3 sm:p-4">
          <div className="flex items-center justify-between gap-2"><h3 className="text-sm font-medium text-zinc-100">Расписание</h3>
            <Button type="button" size="sm" variant="ghost" disabled={busy || !visibleRounds.length} onClick={() => setSelectedRoundKeys((current) => toggleAll(current, visibleRounds.map((round) => round.key)))}>{selectedRounds.length === visibleRounds.length ? "Снять все" : "Выбрать все"}</Button>
          </div>
          <div className="max-h-80 space-y-4 overflow-y-auto">
            {sections.map((section) => <div key={section.key} className="space-y-2">
              <div className="flex min-w-0 items-center justify-between gap-2">
                <p className="min-w-0 break-words text-xs font-medium text-zinc-400">{section.rounds[0].sectionName || "Туры"}</p>
                <button type="button" disabled={busy} className="min-h-11 shrink-0 px-1 text-xs text-primary hover:underline" onClick={() => setSelectedRoundKeys((current) => toggleAll(current, section.rounds.map((round) => round.key)))}>{section.rounds.every((round) => selectedRoundKeys.includes(round.key)) ? "Снять" : "Все туры"}</button>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">{section.rounds.map((round) => <Selection key={round.key} title={round.title} detail={`Матчей: ${round.matches.length}`} active={selectedRoundKeys.includes(round.key)} disabled={busy} onClick={() => setSelectedRoundKeys((current) => toggle(current, round.key))} />)}</div>
            </div>)}
            {!visibleRounds.length && <p className="py-4 text-sm text-zinc-500">Матчи этого этапа ещё не созданы.</p>}
          </div>
          <Button type="button" variant="outline" className="w-full text-xs sm:text-sm" disabled={busy || !selectedRounds.length} onClick={() => runExport(() => downloadScheduleImages(selectedRounds, setStatus))}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 motion-safe:animate-spin" /> : <Download className="mr-2 h-4 w-4" />}Расписание PNG{schedulePages ? ` · ${schedulePages}` : ""}
          </Button>
        </section>
      </div>
      {status && <div role={error ? "alert" : "status"} className={`rounded-md border px-3 py-2 text-xs leading-relaxed sm:text-sm ${error ? "border-rose-300/20 bg-rose-300/10 text-rose-200" : "border-primary/20 bg-primary/10 text-primary"}`}>{status}</div>}
    </CardContent>
  </Card>;
}
