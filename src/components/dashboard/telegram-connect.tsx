"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Link2, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

declare global {
  interface Window {
    onTelegramConnect?: (user: Record<string, string>) => void;
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

export function TelegramConnect({
  botUsername,
  linked,
  telegramHandle,
}: {
  botUsername?: string;
  linked: boolean;
  telegramHandle?: string | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [widgetError, setWidgetError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const normalizedBotUsername = useMemo(() => normalizeTelegramBotUsername(botUsername), [botUsername]);
  const isValidUsername = /^[A-Za-z0-9_]{5,32}$/.test(normalizedBotUsername);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !normalizedBotUsername || !isValidUsername || linked) return;

    setWidgetError(null);
    container.replaceChildren();

    window.onTelegramConnect = (user) => {
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

    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.async = true;
    script.setAttribute("data-telegram-login", normalizedBotUsername);
    script.setAttribute("data-size", "large");
    script.setAttribute("data-radius", "12");
    script.setAttribute("data-request-access", "write");
    script.setAttribute("data-onauth", "onTelegramConnect(user)");
    script.onerror = () => {
      setWidgetError("Не удалось загрузить Telegram Login Widget.");
    };

    container.appendChild(script);

    const timeout = window.setTimeout(() => {
      const content = container.textContent?.toLowerCase() ?? "";

      if (content.includes("username invalid")) {
        setWidgetError("Указан неверный username Telegram-бота. Используйте имя без @.");
        container.replaceChildren();
      }

      if (content.includes("bot domain invalid")) {
        setWidgetError("Для бота не настроен домен. Укажите домен сайта через BotFather.");
        container.replaceChildren();
      }
    }, 1500);

    return () => {
      window.clearTimeout(timeout);
      container.replaceChildren();
    };
  }, [isValidUsername, linked, normalizedBotUsername, router]);

  if (linked) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
          <Send className="h-4 w-4 shrink-0" />
          <span>Telegram уже привязан {telegramHandle ? `к @${telegramHandle}` : "к аккаунту"}.</span>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-zinc-400">
          Изменить или перенести привязку Telegram можно только через администратора.
        </div>
      </div>
    );
  }

  if (!botUsername) {
    return (
      <div className="rounded-2xl border border-dashed border-white/10 px-4 py-3 text-sm text-zinc-400">
        Добавьте <code className="text-white">NEXT_PUBLIC_TELEGRAM_BOT_USERNAME</code>, чтобы включить привязку Telegram.
      </div>
    );
  }

  if (!isValidUsername) {
    return (
      <div className="flex items-start gap-2 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
        <span>Имя Telegram-бота указано неверно. Нужен username без @ и без ссылки.</span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
        <div ref={containerRef} className="flex min-h-12 items-center justify-center" />
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
