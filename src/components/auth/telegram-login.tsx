"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Send } from "lucide-react";
import { signIn } from "next-auth/react";

declare global {
  interface Window {
    __telegramAuthCallbacks?: Record<string, (user: TelegramWidgetUser) => void>;
  }
}

type TelegramWidgetUser = Record<string, string | number | undefined>;

function normalizeTelegramBotUsername(value?: string) {
  if (!value) return "";

  return value
    .trim()
    .replace(/^https?:\/\/t\.me\//i, "")
    .replace(/^@/, "")
    .replace(/\/$/, "");
}

export function TelegramLogin({
  botUsername,
  legalAccepted = true,
  requireLegalAcceptance = false,
}: {
  botUsername?: string;
  botId?: string;
  legalAccepted?: boolean;
  requireLegalAcceptance?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const callbackNameRef = useRef(`telegramAuth_${Math.random().toString(36).slice(2)}`);
  const [widgetError, setWidgetError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const normalizedBotUsername = useMemo(() => normalizeTelegramBotUsername(botUsername), [botUsername]);
  const hasBotConfig = Boolean(normalizedBotUsername);
  const isBlockedByLegal = requireLegalAcceptance && !legalAccepted;
  const router = useRouter();

  const finishTelegramAuth = useCallback(
    async (user: TelegramWidgetUser) => {
      if (isBlockedByLegal) {
        setWidgetError("Сначала примите документы сайта.");
        return;
      }

      setPending(true);
      setWidgetError(null);

      const result = await signIn("telegram", {
        ...user,
        legalAccepted: legalAccepted ? "true" : "false",
        callbackUrl: "/dashboard",
        redirect: false,
      });

      setPending(false);

      if (result?.error) {
        setWidgetError("Не удалось завершить вход через Telegram. Проверьте токен бота и домен.");
        return;
      }

      router.refresh();
      router.push(result?.url ?? "/dashboard");
    },
    [isBlockedByLegal, legalAccepted, router],
  );

  useEffect(() => {
    const callbackName = callbackNameRef.current;

    window.__telegramAuthCallbacks = window.__telegramAuthCallbacks ?? {};
    window.__telegramAuthCallbacks[callbackName] = finishTelegramAuth;

    return () => {
      delete window.__telegramAuthCallbacks?.[callbackName];
    };
  }, [finishTelegramAuth]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || isBlockedByLegal || !hasBotConfig) return;

    setWidgetError(null);
    container.innerHTML = "";

    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.async = true;
    script.setAttribute("data-telegram-login", normalizedBotUsername);
    script.setAttribute("data-size", "large");
    script.setAttribute("data-radius", "12");
    script.setAttribute("data-userpic", "false");
    script.setAttribute("data-onauth", `__telegramAuthCallbacks.${callbackNameRef.current}(user)`);
    script.addEventListener("error", () => {
      setWidgetError("Не удалось загрузить Telegram Login Widget.");
    });

    container.appendChild(script);

    return () => {
      container.innerHTML = "";
    };
  }, [hasBotConfig, isBlockedByLegal, normalizedBotUsername]);

  return (
    <div className="rounded-3xl border border-[#229ED9]/25 bg-[linear-gradient(180deg,rgba(34,158,217,0.16),rgba(34,158,217,0.06))] p-4 shadow-[0_12px_30px_rgba(34,158,217,0.08)]">
      <div className="mb-4 flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#229ED9] text-white shadow-lg shadow-[#229ED9]/20">
          <Send className="h-5 w-5" />
        </div>
        <div className="space-y-1">
          <div className="text-lg font-semibold text-white">Вход через Telegram</div>
        </div>
      </div>

      {isBlockedByLegal ? (
        <div className="rounded-2xl border border-dashed border-[#229ED9]/25 bg-black/20 px-4 py-3 text-sm leading-6 text-sky-100">
          Примите документы выше, чтобы продолжить регистрацию через Telegram.
        </div>
      ) : hasBotConfig ? (
        <div className="rounded-2xl bg-black/20 p-3">
          <div
            ref={containerRef}
            className={`flex min-h-12 items-center justify-center ${pending ? "pointer-events-none opacity-70" : ""}`}
          />

          {pending ? <div className="mt-3 text-center text-sm text-sky-100">Выполняем вход...</div> : null}

          {widgetError ? (
            <div className="mt-3 flex items-start gap-2 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-3 py-3 text-sm text-amber-200">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{widgetError}</span>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="flex items-start gap-2 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>Добавьте NEXT_PUBLIC_TELEGRAM_BOT_USERNAME или TELEGRAM_BOT_USERNAME, чтобы включить Telegram Login Widget.</span>
        </div>
      )}
    </div>
  );
}
