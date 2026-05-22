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
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/65 px-2 pb-2 pt-10 backdrop-blur-sm sm:items-center sm:p-6">
      <div className="flex max-h-[88dvh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0b0f17] text-white shadow-[0_22px_80px_rgba(0,0,0,0.58)] sm:max-h-[86vh]">
        <div className="flex items-start gap-3 border-b border-white/10 bg-[#111827] px-4 py-3 sm:px-5 sm:py-4">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-sky-300/20 bg-sky-400/10 text-sky-200">
            <FileText className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-base font-black leading-tight sm:text-lg">Регламент обновлен</div>
            <p className="mt-1 text-xs leading-5 text-zinc-400 sm:text-sm">
              Прочитайте изменения. Новые и измененные строки выделены.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-black/20 text-zinc-400 transition hover:bg-white/10 hover:text-white"
            aria-label="Закрыть"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3 sm:px-5 sm:py-4">
          {changedCount ? (
            <div className="mb-3 inline-flex rounded-full border border-amber-300/20 bg-amber-400/10 px-3 py-1 text-xs font-bold text-amber-100">
              Изменений: {changedCount}
            </div>
          ) : null}
          <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-[13px] leading-6 text-zinc-300 sm:p-4 sm:text-sm sm:leading-7">
            {lines.map((line, index) => (
              <p
                key={`${index}-${line.text.slice(0, 18)}`}
                className={cn(
                  "whitespace-pre-wrap rounded-lg px-2 py-1.5",
                  line.changed ? "border border-amber-300/25 bg-amber-300/12 text-amber-50" : "text-zinc-300",
                )}
              >
                {line.text || " "}
              </p>
            ))}
          </div>
        </div>

        <div className="shrink-0 space-y-3 border-t border-white/10 bg-[#0f141f] px-4 py-3 sm:px-5 sm:py-4">
          <label className="flex items-start gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs font-semibold leading-5 text-zinc-300 sm:text-sm">
            <input
              type="checkbox"
              checked={checked}
              onChange={(event) => setChecked(event.target.checked)}
              className="mt-1 h-4 w-4 shrink-0"
            />
            <span>Я прочитал актуальный регламент и принимаю его условия.</span>
          </label>
          {error ? <div className="rounded-xl border border-rose-400/25 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">{error}</div> : null}
          <div className="grid grid-cols-2 gap-2">
            <Link
              href="/regulations"
              onClick={() => setOpen(false)}
              className="col-span-2 inline-flex h-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] px-3 text-sm font-bold text-sky-100 transition hover:bg-white/[0.08]"
            >
              Открыть страницу регламента
            </Link>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} className="h-11 rounded-xl">
              Позже
            </Button>
            <Button type="button" disabled={pending || !checked} onClick={accept} className="h-11 rounded-xl gap-2">
              <CheckCircle2 className="h-4 w-4" />
              {pending ? "..." : "Принять"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
