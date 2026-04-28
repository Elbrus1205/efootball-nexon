"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Loader2, Send } from "lucide-react";
import { toast } from "sonner";

export function TelegramConnect({
  enabled,
  linked,
  telegramHandle,
  completionToken,
  errorMessage,
}: {
  enabled: boolean;
  linked: boolean;
  telegramHandle?: string | null;
  completionToken?: string;
  errorMessage?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [widgetError, setWidgetError] = useState<string | null>(errorMessage ?? null);
  const [finalizedToken, setFinalizedToken] = useState("");
  const router = useRouter();

  useEffect(() => {
    setWidgetError(errorMessage ?? null);
  }, [errorMessage]);

  useEffect(() => {
    if (!completionToken || finalizedToken === completionToken) return;

    setFinalizedToken(completionToken);
    setWidgetError(null);

    startTransition(async () => {
      const response = await fetch("/api/security/connections/telegram/finalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: completionToken }),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setWidgetError(payload?.error || "Не удалось привязать Telegram.");
        toast.error(payload?.error || "Не удалось привязать Telegram.");
        return;
      }

      toast.success(payload?.message || "Telegram успешно привязан.");
      router.refresh();
    });
  }, [completionToken, finalizedToken, router, startTransition]);

  const startTelegramConnect = () => {
    if (!enabled) {
      setWidgetError("Telegram Login не настроен. Добавьте TELEGRAM_CLIENT_ID и TELEGRAM_CLIENT_SECRET.");
      return;
    }

    setWidgetError(null);
    window.location.assign("/api/auth/telegram-oidc/begin?mode=connect");
  };

  if (linked) {
    return (
      <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
        <div className="flex items-center gap-2">
          <Send className="h-4 w-4 shrink-0" />
          <span>Telegram подключён {telegramHandle ? `@${telegramHandle}` : "к аккаунту"}.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
        <button
          type="button"
          onClick={startTelegramConnect}
          disabled={pending || !enabled}
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#229ED9] px-4 py-3 text-sm font-semibold text-white shadow-[0_12px_30px_rgba(34,158,217,0.18)] transition hover:bg-[#1d8fc5] disabled:cursor-not-allowed disabled:opacity-70"
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {pending ? "Привязываем Telegram..." : "Подключить Telegram"}
        </button>
      </div>

      {widgetError ? (
        <div className="flex items-start gap-2 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{widgetError}</span>
        </div>
      ) : null}
    </div>
  );
}
