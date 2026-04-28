"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import {
  hasTelegramAuthPayload,
  mountTelegramLoginWidget,
  normalizeTelegramBotUsername,
  type TelegramWidgetUser,
} from "@/lib/telegram-widget";

function toTelegramPayload(user: TelegramWidgetUser) {
  if (!hasTelegramAuthPayload(user)) {
    return null;
  }

  return {
    id: String(user.id),
    first_name: user.first_name,
    last_name: user.last_name,
    username: user.username,
    photo_url: user.photo_url,
    auth_date: String(user.auth_date),
    hash: user.hash,
  };
}

export function TelegramConnect({
  botUsername,
  linked,
  telegramHandle,
}: {
  botUsername?: string;
  linked: boolean;
  telegramHandle?: string | null;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [widgetReady, setWidgetReady] = useState(false);
  const [widgetError, setWidgetError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const normalizedBotUsername = useMemo(() => normalizeTelegramBotUsername(botUsername), [botUsername]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || linked || !normalizedBotUsername) {
      setWidgetReady(false);
      return;
    }

    setWidgetError(null);
    setWidgetReady(false);

    return mountTelegramLoginWidget(container, {
      botUsername: normalizedBotUsername,
      requestAccess: "write",
      lang: "ru",
      onLoad: () => setWidgetReady(true),
      onError: () => {
        setWidgetReady(false);
        setWidgetError("Не удалось загрузить Telegram Login Widget.");
      },
      onAuth: (user) => {
        const payload = toTelegramPayload(user);
        if (!payload) {
          setWidgetError("Telegram не вернул данные авторизации. Попробуйте ещё раз.");
          return;
        }

        startTransition(async () => {
          const response = await fetch("/api/security/connections/telegram", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });

          const body = await response.json().catch(() => null);
          if (!response.ok) {
            setWidgetError(body?.error || "Не удалось привязать Telegram.");
            toast.error(body?.error || "Не удалось привязать Telegram.");
            return;
          }

          toast.success(body?.message || "Telegram успешно привязан.");
          router.refresh();
        });
      },
    });
  }, [linked, normalizedBotUsername, router]);

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

  if (!normalizedBotUsername) {
    return (
      <div className="rounded-2xl border border-dashed border-white/10 px-4 py-3 text-sm text-zinc-400">
        Добавьте <code className="text-white">TELEGRAM_BOT_USERNAME</code> или{" "}
        <code className="text-white">NEXT_PUBLIC_TELEGRAM_BOT_USERNAME</code>, чтобы включить привязку Telegram.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
        <div
          ref={containerRef}
          className={`flex min-h-12 items-center justify-center ${pending ? "pointer-events-none opacity-70" : ""}`}
        />

        {!widgetReady && !widgetError ? (
          <div className="mt-3 flex items-center justify-center gap-2 text-sm text-sky-100">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Загружаем Telegram Login Widget...</span>
          </div>
        ) : null}

        {pending ? (
          <div className="mt-3 flex items-center justify-center gap-2 text-sm text-sky-100">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Привязываем Telegram...</span>
          </div>
        ) : null}
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
