"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, Loader2, Send } from "lucide-react";
import { signIn } from "next-auth/react";

declare global {
  interface Window {
    __telegramAuthCallbacks?: Record<string, (user: TelegramWidgetUser) => void>;
  }
}

type TelegramWidgetUser = {
  id?: number | string;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date?: number | string;
  hash?: string;
};

const TELEGRAM_WIDGET_SCRIPT_URL = "https://telegram.org/js/telegram-widget.js?22";

function normalizeTelegramBotUsername(value?: string) {
  if (!value) return "";

  return value
    .trim()
    .replace(/^https?:\/\/t\.me\//i, "")
    .replace(/^@/, "")
    .replace(/\/$/, "");
}

function toTelegramPayload(user: TelegramWidgetUser) {
  if (!user.id || !user.auth_date || !user.hash) {
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
  const scriptLoadedRef = useRef(false);
  const normalizedBotUsername = useMemo(() => normalizeTelegramBotUsername(botUsername), [botUsername]);
  const isBlockedByLegal = requireLegalAcceptance && !legalAccepted;
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const finishTelegramAuth = useCallback(
    async (user: TelegramWidgetUser) => {
      if (isBlockedByLegal) {
        setError("Сначала примите документы сайта.");
        return;
      }

      const payload = toTelegramPayload(user);
      if (!payload) {
        setError("Telegram не вернул данные авторизации. Попробуйте ещё раз.");
        return;
      }

      setPending(true);
      setError(null);

      const result = await signIn("telegram", {
        ...payload,
        legalAccepted: legalAccepted ? "true" : "false",
        callbackUrl: "/dashboard",
        redirect: false,
      });

      setPending(false);

      if (!result || result.error) {
        setError("Не удалось завершить вход через Telegram. Проверьте домен бота и настройки Telegram Login.");
        return;
      }

      window.location.replace(result.url || "/dashboard");
    },
    [isBlockedByLegal, legalAccepted],
  );

  useEffect(() => {
    const callbackName = callbackNameRef.current;
    window.__telegramAuthCallbacks = window.__telegramAuthCallbacks ?? {};
    window.__telegramAuthCallbacks[callbackName] = finishTelegramAuth;

    return () => {
      if (window.__telegramAuthCallbacks) {
        delete window.__telegramAuthCallbacks[callbackName];
      }
    };
  }, [finishTelegramAuth]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || isBlockedByLegal || !normalizedBotUsername) {
      return;
    }

    setError(null);
    container.innerHTML = "";

    const script = document.createElement("script");
    script.src = TELEGRAM_WIDGET_SCRIPT_URL;
    script.async = true;
    script.setAttribute("data-telegram-login", normalizedBotUsername);
    script.setAttribute("data-size", "large");
    script.setAttribute("data-radius", "12");
    script.setAttribute("data-userpic", "false");
    script.setAttribute("data-request-access", "write");
    script.setAttribute("data-lang", "ru");
    script.setAttribute("data-onauth", `__telegramAuthCallbacks.${callbackNameRef.current}(user)`);
    script.addEventListener("load", () => {
      scriptLoadedRef.current = true;
    });
    script.addEventListener("error", () => {
      setError("Не удалось загрузить Telegram Login Widget. Проверьте доступность telegram.org.");
    });

    container.appendChild(script);

    return () => {
      container.innerHTML = "";
      scriptLoadedRef.current = false;
    };
  }, [isBlockedByLegal, normalizedBotUsername]);

  return (
    <div className="rounded-3xl border border-[#229ED9]/25 bg-[linear-gradient(180deg,rgba(34,158,217,0.16),rgba(34,158,217,0.06))] p-4 shadow-[0_12px_30px_rgba(34,158,217,0.08)]">
      <div className="mb-4 flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#229ED9] text-white shadow-lg shadow-[#229ED9]/20">
          <Send className="h-5 w-5" />
        </div>
        <div className="space-y-1">
          <div className="text-lg font-semibold text-white">Вход через Telegram</div>
          <p className="text-sm text-sky-100/90">Официальный Telegram Login Widget. В Telegram подтвердите вход в свой аккаунт.</p>
        </div>
      </div>

      {isBlockedByLegal ? (
        <div className="rounded-2xl border border-dashed border-[#229ED9]/25 bg-black/20 px-4 py-3 text-sm leading-6 text-sky-100">
          Примите документы выше, чтобы продолжить регистрацию через Telegram.
        </div>
      ) : normalizedBotUsername ? (
        <div className="rounded-2xl bg-black/20 p-3">
          <div
            ref={containerRef}
            className={`flex min-h-12 items-center justify-center ${pending ? "pointer-events-none opacity-70" : ""}`}
          />

          {pending ? (
            <div className="mt-3 flex items-center justify-center gap-2 text-sm text-sky-100">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Завершаем вход...</span>
            </div>
          ) : null}

          {error ? (
            <div className="mt-3 flex items-start gap-2 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-3 py-3 text-sm text-amber-200">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="flex items-start gap-2 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>Добавьте `TELEGRAM_BOT_USERNAME` или `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME`, чтобы включить Telegram Login Widget.</span>
        </div>
      )}
    </div>
  );
}
