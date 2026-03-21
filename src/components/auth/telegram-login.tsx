"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Send } from "lucide-react";
import { signIn } from "next-auth/react";

declare global {
  interface Window {
    onTelegramAuth?: (user: Record<string, string>) => void;
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

export function TelegramLogin({ botUsername }: { botUsername?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [widgetError, setWidgetError] = useState<string | null>(null);
  const normalizedBotUsername = useMemo(() => normalizeTelegramBotUsername(botUsername), [botUsername]);
  const isValidUsername = /^[A-Za-z0-9_]{5,32}$/.test(normalizedBotUsername);
  const router = useRouter();

  useEffect(() => {
    const container = containerRef.current;
    if (!normalizedBotUsername || !container || !isValidUsername) return;

    setWidgetError(null);
    container.replaceChildren();

    window.onTelegramAuth = async (user) => {
      const result = await signIn("telegram", {
        ...user,
        callbackUrl: "/dashboard",
        redirect: false,
      });

      if (result?.error) {
        setWidgetError("Не удалось завершить вход через Telegram. Проверьте токен бота и домен.");
        return;
      }

      router.refresh();
      router.push(result?.url ?? "/dashboard");
    };

    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.async = true;
    script.setAttribute("data-telegram-login", normalizedBotUsername);
    script.setAttribute("data-size", "large");
    script.setAttribute("data-radius", "12");
    script.setAttribute("data-request-access", "write");
    script.setAttribute("data-onauth", "onTelegramAuth(user)");
    script.onerror = () => {
      setWidgetError("Не удалось загрузить Telegram Login Widget.");
    };

    container.appendChild(script);

    const timeout = window.setTimeout(() => {
      if (container.textContent?.toLowerCase().includes("username invalid")) {
        setWidgetError("Указан неверный username Telegram-бота. Используйте имя без @, например my_auth_bot.");
        container.replaceChildren();
      }

      if (container.textContent?.toLowerCase().includes("bot domain invalid")) {
        setWidgetError("Для бота не настроен домен. Укажите домен сайта в BotFather через /setdomain.");
        container.replaceChildren();
      }
    }, 1500);

    return () => {
      window.clearTimeout(timeout);
      container.replaceChildren();
    };
  }, [isValidUsername, normalizedBotUsername, router]);

  return (
    <div className="rounded-3xl border border-[#229ED9]/25 bg-[linear-gradient(180deg,rgba(34,158,217,0.16),rgba(34,158,217,0.06))] p-4 shadow-[0_12px_30px_rgba(34,158,217,0.08)]">
      <div className="mb-4 flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#229ED9] text-white shadow-lg shadow-[#229ED9]/20">
          <Send className="h-5 w-5" />
        </div>
        <div className="space-y-1">
          <div className="text-lg font-semibold text-white">Вход через Telegram</div>
          <div className="text-sm text-zinc-300">Быстрый вход без пароля через официальный Telegram Login Widget.</div>
        </div>
      </div>

      {normalizedBotUsername && isValidUsername ? (
        <div className="rounded-2xl bg-black/20 p-3">
          <div ref={containerRef} className="flex min-h-12 items-center justify-center" />
          {widgetError ? (
            <div className="mt-3 flex items-start gap-2 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-3 py-3 text-sm text-amber-200">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{widgetError}</span>
            </div>
          ) : null}
        </div>
      ) : botUsername ? (
        <div className="flex items-start gap-2 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME` заполнен неверно. Укажи username бота без `@` и без ссылки, например `my_auth_bot`.
          </span>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-white/10 px-4 py-3 text-sm text-zinc-400">
          Добавьте `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME`, чтобы показать Telegram-кнопку.
        </div>
      )}
    </div>
  );
}
