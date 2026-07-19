"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Loader2, RefreshCw, Send } from "lucide-react";
import { toast } from "sonner";
import { formatTelegramLoginSdkError, loadTelegramLoginSdk, openTelegramLoginPopup } from "@/lib/telegram-login-sdk";

export function TelegramConnect({
  enabled,
  clientId,
  linked,
  telegramHandle,
}: {
  enabled: boolean;
  clientId?: string;
  linked: boolean;
  telegramHandle?: string | null;
}) {
  const [pending, setPending] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [widgetError, setWidgetError] = useState<string | null>(null);
  const router = useRouter();

  const syncTelegramProfile = async () => {
    if (syncing) return;
    setSyncing(true);

    try {
      const response = await fetch("/api/security/connections/telegram/sync", { method: "POST" });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        toast.error(payload?.error || "Не удалось синхронизировать профиль Telegram.");
        return;
      }

      toast.success(payload?.message || "Профиль Telegram обновлён.");
      if (payload?.changed) router.refresh();
    } catch {
      toast.error("Не удалось синхронизировать профиль Telegram. Попробуйте позже.");
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    if (!enabled || !clientId || linked) return;

    loadTelegramLoginSdk().catch(() => null);
  }, [clientId, enabled, linked]);

  const startTelegramConnect = async () => {
    if (pending) return;

    if (!enabled || !clientId) {
      setWidgetError("Telegram Login не настроен. Добавьте TELEGRAM_CLIENT_ID.");
      return;
    }

    setPending(true);
    setWidgetError(null);

    try {
      const authResult = await openTelegramLoginPopup({
        clientId,
        lang: "ru",
        requestAccess: ["write"],
      });

      if (authResult.error) {
        setWidgetError("Telegram не завершил авторизацию. Попробуйте ещё раз.");
        setPending(false);
        return;
      }

      const idToken = authResult.id_token?.trim();
      if (!idToken) {
        setWidgetError("Telegram не вернул ID token. Попробуйте ещё раз.");
        setPending(false);
        return;
      }

      const response = await fetch("/api/security/connections/telegram/finalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        const message = payload?.error || "Не удалось привязать Telegram.";
        setWidgetError(message);
        toast.error(message);
        setPending(false);
        return;
      }

      toast.success(payload?.message || "Telegram успешно привязан.");
      router.refresh();
    } catch (cause) {
      const message = formatTelegramLoginSdkError(cause);
      setWidgetError(message);
      toast.error(message);
      setPending(false);
    }
  };

  if (linked) {
    return (
      <div className="space-y-2">
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
          <div className="flex items-center gap-2">
            <Send className="h-4 w-4 shrink-0" />
            <span>Telegram подключён {telegramHandle ? `@${telegramHandle}` : "к аккаунту"}.</span>
          </div>
        </div>
        <button
          type="button"
          onClick={syncTelegramProfile}
          disabled={syncing}
          className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-black/20 px-4 text-sm font-medium text-white transition duration-200 hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-70"
        >
          {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          {syncing ? "Синхронизируем..." : "Синхронизировать профиль Telegram"}
        </button>
        <p className="text-xs text-zinc-500">
          Обновляет ваш никнейм @username, если вы изменили его в Telegram.
        </p>
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
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#21F1A8] px-4 py-3 text-sm font-semibold text-white shadow-[0_12px_30px_rgba(33,241,168,0.18)] transition hover:bg-[#21F1A8] disabled:cursor-not-allowed disabled:opacity-70"
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
