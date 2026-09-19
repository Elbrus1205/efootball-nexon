"use client";

import { Download, Loader2 } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { ExportScheduleRound } from "@/lib/tournaments/schedule-poster";

export function ScheduleDownloadButton({ round }: { round: ExportScheduleRound }) {
  const lock = useRef(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const download = async () => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(false);
    setStatus("Готовлю расписание…");
    try {
      const { downloadScheduleImages } = await import("@/lib/tournaments/download-schedule");
      const count = await downloadScheduleImages([round], setStatus);
      setStatus(count > 1 ? `Скачан ZIP с ${count} изображениями PNG.` : "Изображение PNG скачано.");
    } catch {
      setError(true);
      setStatus("Не удалось скачать расписание. Проверьте соединение и повторите попытку.");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  return (
    <div className="min-w-0 space-y-2">
      <Button type="button" variant="outline" disabled={busy || !round.matches.length} onClick={download} aria-label={`Скачать фото: ${round.title}`} className="min-h-11 w-full gap-2 whitespace-normal sm:w-auto">
        {busy ? <Loader2 className="h-4 w-4 shrink-0 motion-safe:animate-spin" /> : <Download className="h-4 w-4 shrink-0" />}
        {busy ? "Готовлю фото…" : "Скачать фото"}
      </Button>
      {status ? <p role={error ? "alert" : "status"} className={`text-xs ${error ? "text-rose-300" : "text-zinc-400"}`}>{status}</p> : null}
    </div>
  );
}
