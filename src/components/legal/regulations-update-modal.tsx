"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { CheckCircle2, FileText, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type RegulationsHighlight = {
  text: string;
  changed: boolean;
};

type RegulationsPayload = {
  accepted: boolean;
  regulations?: {
    body: string;
    version: string;
    updatedAt: string | null;
    highlights?: RegulationsHighlight[];
  };
};

export function RegulationsUpdateModal() {
  const { status } = useSession();
  const [payload, setPayload] = useState<RegulationsPayload | null>(null);
  const [open, setOpen] = useState(false);
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (status !== "authenticated") return;

    let ignore = false;
    fetch("/api/regulations/acceptance", { cache: "no-store" })
      .then((response) => response.json())
      .then((data: RegulationsPayload) => {
        if (ignore) return;
        setPayload(data);
        setOpen(!data.accepted);
      })
      .catch(() => null);

    return () => {
      ignore = true;
    };
  }, [status]);

  if (!open || !payload?.regulations) return null;

  const lines = payload.regulations.highlights?.length
    ? payload.regulations.highlights
    : payload.regulations.body.split("\n").map((text) => ({ text, changed: false }));
  const changedCount = lines.filter((line) => line.changed).length;

  function accept() {
    startTransition(async () => {
      setError("");
      const response = await fetch("/api/regulations/acceptance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accepted: true }),
      });
      const result = await response.json().catch(() => null);

      if (!response.ok) {
        setError(result?.error ?? "Не удалось принять регламент.");
        return;
      }

      setOpen(false);
      setPayload((current) => (current ? { ...current, accepted: true } : current));
    });
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/70 p-3 backdrop-blur-sm sm:items-center sm:p-6">
      <div className="max-h-[92vh] w-full max-w-3xl overflow-hidden rounded-2xl border border-white/10 bg-[#0b0f17] text-white shadow-[0_24px_90px_rgba(0,0,0,0.55)] sm:rounded-3xl">
        <div className="flex items-start justify-between gap-3 border-b border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.24),transparent_38%),linear-gradient(135deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02))] p-4 sm:p-5">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-lg font-black sm:text-xl">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-sky-300/25 bg-sky-400/15 text-sky-200">
                <FileText className="h-5 w-5" />
              </span>
              Регламент обновлен
            </div>
            <p className="mt-2 text-sm leading-6 text-zinc-300">
              Прочитайте новую версию. Измененные и добавленные строки выделены в этом окне.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-black/20 text-zinc-400 transition hover:text-white"
            aria-label="Закрыть"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[52vh] overflow-y-auto overscroll-contain p-4 sm:max-h-[58vh] sm:p-5">
          {changedCount ? (
            <div className="mb-4 rounded-xl border border-amber-300/20 bg-amber-400/10 px-3 py-2 text-sm font-semibold text-amber-100">
              Выделено изменений: {changedCount}
            </div>
          ) : null}
          <div className="space-y-1 rounded-xl border border-white/10 bg-black/20 p-3 text-sm leading-6 text-zinc-300 sm:p-4">
            {lines.map((line, index) => (
              <div
                key={`${index}-${line.text.slice(0, 18)}`}
                className={cn(
                  "min-h-6 whitespace-pre-wrap rounded-lg px-2 py-1",
                  line.changed && "border border-amber-300/25 bg-amber-300/15 text-amber-50",
                )}
              >
                {line.text || " "}
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-3 border-t border-white/10 bg-black/20 p-4 sm:p-5">
          <label className="flex items-start gap-2 text-sm font-semibold text-zinc-300">
            <input
              type="checkbox"
              checked={checked}
              onChange={(event) => setChecked(event.target.checked)}
              className="mt-1"
            />
            Я прочитал актуальный регламент и принимаю его условия.
          </label>
          {error ? <div className="rounded-xl border border-rose-400/25 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">{error}</div> : null}
          <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto] sm:items-center">
            <Link href="/regulations" className="text-sm font-bold text-sky-200 transition hover:text-sky-100" onClick={() => setOpen(false)}>
              Открыть страницу регламента
            </Link>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Позже
            </Button>
            <Button type="button" disabled={pending || !checked} onClick={accept} className="gap-2">
              <CheckCircle2 className="h-4 w-4" />
              {pending ? "Сохраняем..." : "Принять"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
