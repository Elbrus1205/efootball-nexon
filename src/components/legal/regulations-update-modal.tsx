"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { CheckCircle2, FileText } from "lucide-react";
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

function formatRegulationsVersion(version: string, updatedAt?: string | null) {
  const date = new Date(updatedAt ?? version);
  if (Number.isNaN(date.getTime())) {
    return version;
  }

  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

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
  const versionLabel = formatRegulationsVersion(payload.regulations.version, payload.regulations.updatedAt);

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
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/75 px-3 pb-3 pt-8 backdrop-blur-md sm:items-center sm:p-6">
      <div className="flex max-h-[90dvh] w-full max-w-xl flex-col overflow-hidden rounded-xl border border-white/10 bg-[#1D1D1D] text-white shadow-[0_24px_90px_rgba(0,0,0,0.7)] sm:max-h-[84vh]">
        <div className="border-b border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.045),rgba(255,255,255,0.015))] px-4 py-3 sm:px-5">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#21F1A8]/30 bg-[#21F1A8]/12 text-[#77F8CB]">
              <FileText className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-base font-black leading-tight text-white sm:text-lg">Регламент обновлён</div>
              <p className="mt-1 max-w-md text-xs leading-5 text-zinc-400">
                Прочитайте и подтвердите новую версию, чтобы продолжить участие на платформе.
              </p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
            <span className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-1">Версия от {versionLabel}</span>
            {changedCount ? <span className="rounded-md border border-[#21F1A8]/25 bg-[#21F1A8]/10 px-2 py-1 text-[#77F8CB]">Изменений: {changedCount}</span> : null}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3 sm:px-5">
          <div className="rounded-lg border border-white/10 bg-white/[0.025] p-2 text-[12px] leading-5 text-zinc-300 sm:p-3 sm:text-sm sm:leading-6">
            {lines.map((line, index) => (
              <p
                key={`${index}-${line.text.slice(0, 18)}`}
                className={cn(
                  "whitespace-pre-wrap rounded-md px-2 py-1",
                  line.changed ? "border border-[#21F1A8]/25 bg-[#21F1A8]/10 text-[#C9FFF0]" : "text-zinc-300",
                )}
              >
                {line.text || " "}
              </p>
            ))}
          </div>
        </div>

        <div className="shrink-0 space-y-3 border-t border-white/10 bg-[#101010] px-3 py-3 sm:px-5">
          <label className="flex items-start gap-2 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs font-semibold leading-5 text-zinc-300 sm:text-sm">
            <input
              type="checkbox"
              checked={checked}
              onChange={(event) => setChecked(event.target.checked)}
              className="mt-1 h-4 w-4 shrink-0"
            />
            <span>Я прочитал актуальный регламент и принимаю его условия.</span>
          </label>
          {error ? <div className="rounded-lg border border-rose-400/25 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">{error}</div> : null}
          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
            <Link
              href="/regulations"
              className="inline-flex h-10 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] px-3 text-sm font-bold text-zinc-200 transition hover:bg-white/[0.08]"
            >
              Открыть страницу регламента
            </Link>
            <Button type="button" disabled={pending || !checked} onClick={accept} className="h-10 rounded-lg gap-2 px-5">
              <CheckCircle2 className="h-4 w-4" />
              {pending ? "..." : "Принять"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
