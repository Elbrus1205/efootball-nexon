"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type MappingSource = {
  groupId: string;
  groupName: string;
  rank: number;
  label: string;
  participantName: string | null;
  sourceRef: string;
};

type MappingSlot = {
  round: number;
  matchNumber: number;
  slotNumber: number;
  sourceRef: string | null;
};

export function PlayoffMappingEditor({
  tournamentId,
  bracketId,
  sources,
  slots,
}: {
  tournamentId: string;
  bracketId: string;
  sources: MappingSource[];
  slots: MappingSlot[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selection, setSelection] = useState<Record<string, string>>(
    Object.fromEntries(slots.map((slot) => [`${slot.matchNumber}-${slot.slotNumber}`, slot.sourceRef ?? ""])),
  );

  const sourceMap = useMemo(() => new Map(sources.map((source) => [source.sourceRef, source])), [sources]);
  const selectedRefs = new Set(Object.values(selection).filter(Boolean));
  const matches = Array.from(new Set(slots.map((slot) => slot.matchNumber))).sort((a, b) => a - b);

  const applyStandardMapping = () => {
    const grouped = new Map<number, MappingSource[]>();
    for (const source of sources) {
      const items = grouped.get(source.rank) ?? [];
      items.push(source);
      grouped.set(source.rank, items);
    }

    const firstPlaces = (grouped.get(1) ?? []).slice().sort((a, b) => a.label.localeCompare(b.label));
    const secondPlaces = (grouped.get(2) ?? []).slice().sort((a, b) => b.label.localeCompare(a.label));
    const nextSelection: Record<string, string> = {};

    matches.forEach((matchNumber, index) => {
      nextSelection[`${matchNumber}-1`] = firstPlaces[index]?.sourceRef ?? "";
      nextSelection[`${matchNumber}-2`] = secondPlaces[index]?.sourceRef ?? "";
    });

    setSelection((current) => ({ ...current, ...nextSelection }));
  };

  const saveMapping = () => {
    startTransition(async () => {
      await fetch(`/api/admin/tournaments/${tournamentId}/playoff/mapping`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bracketId,
          mappings: slots.map((slot) => ({
            round: slot.round,
            matchNumber: slot.matchNumber,
            slotNumber: slot.slotNumber,
            sourceRef: selection[`${slot.matchNumber}-${slot.slotNumber}`] || null,
          })),
        }),
      });
      router.refresh();
    });
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <Badge variant="accent">Group to Playoff</Badge>
          <CardTitle>Visual Mapping выхода в сетку</CardTitle>
          <CardDescription>
            Администратор задаёт, кто именно попадает в каждый слот первого раунда. Схема сохраняется в виде
            источников уровня A1 - B2 и затем используется при автозаполнении плей-офф.
          </CardDescription>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" disabled={pending} onClick={applyStandardMapping}>
            Стандартная схема
          </Button>
          <Button type="button" disabled={pending} onClick={saveMapping}>
            Сохранить mapping
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {sources.map((source) => (
            <div key={source.sourceRef} className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-base font-semibold text-white">{source.label}</span>
                <Badge variant="primary">{source.groupName}</Badge>
              </div>
              <div className="mt-2 text-sm text-zinc-400">{source.participantName ?? "Место пока не определено"}</div>
            </div>
          ))}
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          {matches.map((matchNumber) => {
            const slot1 = selection[`${matchNumber}-1`] ?? "";
            const slot2 = selection[`${matchNumber}-2`] ?? "";
            const preview = [sourceMap.get(slot1)?.label, sourceMap.get(slot2)?.label].filter(Boolean).join(" vs ");

            return (
              <div key={matchNumber} className="rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-5">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm uppercase tracking-[0.24em] text-zinc-500">Match {matchNumber}</div>
                    <div className="mt-1 text-lg font-semibold text-white">{preview || "Слот для пары ещё не настроен"}</div>
                  </div>
                  <Badge variant="neutral">Раунд 1</Badge>
                </div>

                <div className="space-y-3">
                  {[1, 2].map((slotNumber) => {
                    const key = `${matchNumber}-${slotNumber}`;
                    const currentValue = selection[key] ?? "";

                    return (
                      <label key={key} className="block space-y-2">
                        <div className="text-sm text-zinc-400">Слот {slotNumber}</div>
                        <select
                          value={currentValue}
                          onChange={(event) =>
                            setSelection((current) => ({
                              ...current,
                              [key]: event.target.value,
                            }))
                          }
                          className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none transition focus:border-primary/50"
                        >
                          <option value="">Не выбрано</option>
                          {sources.map((source) => {
                            const isTaken = selectedRefs.has(source.sourceRef) && currentValue !== source.sourceRef;
                            return (
                              <option key={source.sourceRef} value={source.sourceRef} disabled={isTaken}>
                                {source.label} - {source.groupName}
                              </option>
                            );
                          })}
                        </select>
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
