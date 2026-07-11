"use client";

import { Maximize2, Minus, Plus, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function TournamentBracketToolbar({ scale, minScale, maxScale, onScale, onFit, onReset }: { scale: number; minScale: number; maxScale: number; onScale: (scale: number) => void; onFit: () => void; onReset: () => void }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-y border-white/10 bg-black/20 px-3 py-2 sm:px-5" aria-label="Масштаб турнирной сетки">
      <div className="text-xs text-zinc-400">Масштаб <strong className="ml-1 text-white tabular-nums">{Math.round(scale * 100)}%</strong></div>
      <div className="flex items-center gap-1">
        <Button type="button" size="icon" variant="ghost" aria-label="Уменьшить масштаб" title="Уменьшить" disabled={scale <= minScale} onClick={() => onScale(Math.max(minScale, scale - 0.1))}><Minus className="h-4 w-4" /></Button>
        <Button type="button" size="icon" variant="ghost" aria-label="Увеличить масштаб" title="Увеличить" disabled={scale >= maxScale} onClick={() => onScale(Math.min(maxScale, scale + 0.1))}><Plus className="h-4 w-4" /></Button>
        <Button type="button" variant="ghost" className="gap-2 px-3" onClick={onFit}><Maximize2 className="h-4 w-4" /><span className="hidden sm:inline">По ширине</span></Button>
        <Button type="button" size="icon" variant="ghost" aria-label="Сбросить масштаб" title="Сбросить" onClick={onReset}><RotateCcw className="h-4 w-4" /></Button>
      </div>
    </div>
  );
}
