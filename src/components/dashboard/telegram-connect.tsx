"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Link2, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

const TELEGRAM_WIDGET_SCRIPT_URL = "/api/telegram/widget";
type TelegramWidgetUser = Record<string, string | number | undefined>;

declare global {
  interface Window {
    Telegram?: {
      Login?: {
        auth?: (
          options: { bot_id: string; request_access?: "write"; lang?: string },
          callback: (user: TelegramWidgetUser | false) => void,
        ) => void;
      };
    };
  }
}

function normalizeTelegramBotUsername(value?: string) {
  if (!value) return "";

  return value
    .trim()
    .replace(/^https?:\/\/t\.me\//i, "")
    .replace(/^@/, "")
    .replace(/\/$/, "");
}

function normalizeTelegramBotId(value?: string) {
  return value?.trim().match(/^\d+$/)?.[0] ?? "";
}

function loadTelegramWidgetScript() {
  return new Promise<void>((resolve, reject) => {
    if (window.Telegram?.Login?.auth) {
      resolve();
      return;
    }

    const existingScript = document.querySelector<HTMLScriptElement>(
      `script[src="${TELEGRAM_WIDGET_SCRIPT_URL}"], script[src^="https://telegram.org/js/telegram-widget.js"]`,
    );
    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(), { once: true });
      existingScript.addEventListener("error", () => reject(new Error("Telegram widget load failed")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = TELEGRAM_WIDGET_SCRIPT_URL;
    script.async = true;
    script.addEventListener("load", () => resolve(), { once: true });
    script.addEventListener("error", () => reject(new Error("Telegram widget load failed")), { once: true });
    document.head.appendChild(script);
  });
}

export function TelegramConnect({
  botUsername,
  botId,
  linked,
  telegramHandle,
}: {
  botUsername?: string;
  botId?: string;
  linked: boolean;
  telegramHandle?: string | null;
}) {
  const [widgetError, setWidgetError] = useState<string | null>(null);
  const [scriptReady, setScriptReady] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const normalizedBotUsername = useMemo(() => normalizeTelegramBotUsername(botUsername), [botUsername]);
  const normalizedBotId = useMemo(() => normalizeTelegramBotId(botId), [botId]);

  useEffect(() => {
    if (!normalizedBotId || linked) return;

    let cancelled = false;

    setWidgetError(null);
    loadTelegramWidgetScript()
      .then(() => {
        if (!cancelled) setScriptReady(Boolean(window.Telegram?.Login?.auth));
      })
      .catch(() => {
        if (!cancelled) {
          setScriptReady(false);
          setWidgetError("Не удалось загрузить Telegram Login Widget.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [linked, normalizedBotId]);

  const finishTelegramConnect = (user: TelegramWidgetUser | false) => {
    if (!user) return;

    startTransition(async () => {
      const response = await fetch("/api/security/connections/telegram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(user),
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
  };

  const startTelegramConnect = () => {
    if (!normalizedBotId) {
      setWidgetError("Telegram bot_id не настроен.");
      return;
    }

    if (!window.Telegram?.Login?.auth) {
      setWidgetError("Telegram Login Widget ещё загружается. Нажмите ещё раз через секунду.");
      void loadTelegramWidgetScript()
        .then(() => {
          setScriptReady(Boolean(window.Telegram?.Login?.auth));
          setWidgetError(null);
        })
        .catch(() => setWidgetError("Не удалось загрузить Telegram Login Widget."));
      return;
    }

    setWidgetError(null);
    window.Telegram.Login.auth({ bot_id: normalizedBotId, request_access: "write" }, finishTelegramConnect);
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

  if (!normalizedBotId) {
    return (
      <div className="rounded-2xl border border-dashed border-white/10 px-4 py-3 text-sm text-zinc-400">
        Добавьте <code className="text-white">TELEGRAM_BOT_TOKEN</code> или{" "}
        <code className="text-white">NEXT_PUBLIC_TELEGRAM_BOT_ID</code>, чтобы включить привязку Telegram.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
        <button
          type="button"
          onClick={startTelegramConnect}
          disabled={pending}
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#229ED9] px-4 py-3 text-sm font-semibold text-white shadow-[0_12px_30px_rgba(34,158,217,0.18)] transition hover:bg-[#1d8fc5] disabled:cursor-not-allowed disabled:opacity-70"
        >
          <Send className="h-4 w-4" />
          {pending ? "Привязываем Telegram..." : scriptReady ? "Подключить Telegram" : "Загрузка Telegram..."}
        </button>

        {normalizedBotUsername ? (
          <a
            href={`https://t.me/${normalizedBotUsername}`}
            target="_blank"
            rel="noreferrer"
            className="mt-2 block text-center text-xs font-medium text-sky-100 underline-offset-4 transition hover:text-white hover:underline"
          >
            Открыть бота Telegram
          </a>
        ) : null}
      </div>

      {pending ? (
        <Button disabled className="w-full">
          <Link2 className="mr-2 h-4 w-4" />
          Привязываем Telegram...
        </Button>
      ) : null}

      {widgetError ? (
        <div className="flex items-start gap-2 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{widgetError}</span>
        </div>
      ) : null}
    </div>
  );
}
