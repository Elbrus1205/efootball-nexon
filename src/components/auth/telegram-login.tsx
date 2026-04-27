"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Send } from "lucide-react";
import { signIn } from "next-auth/react";

declare global {
  interface Window {
    __telegramAuthCallbacks?: Record<string, (user: TelegramWidgetUser) => void>;
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

type TelegramWidgetUser = Record<string, string | number | undefined>;
type TelegramAuthPayload = Record<"id" | "auth_date" | "hash", string> &
  Partial<Record<"first_name" | "last_name" | "username" | "photo_url", string>>;

const TELEGRAM_WIDGET_SCRIPT_URL = "/api/telegram/widget";

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

function toTelegramAuthPayload(user: TelegramWidgetUser): TelegramAuthPayload | null {
  if (!user.id || !user.auth_date || !user.hash) return null;

  const payload: TelegramAuthPayload = {
    id: String(user.id),
    auth_date: String(user.auth_date),
    hash: String(user.hash),
  };

  for (const key of ["first_name", "last_name", "username", "photo_url"] as const) {
    const value = user[key];
    if (value !== undefined && value !== null && String(value).length > 0) {
      payload[key] = String(value);
    }
  }

  return payload;
}

export function TelegramLogin({
  botId,
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
  const normalizedBotId = useMemo(() => normalizeTelegramBotId(botId), [botId]);
  const [scriptReady, setScriptReady] = useState(false);
  const isBlockedByLegal = requireLegalAcceptance && !legalAccepted;
  const router = useRouter();

  const finishTelegramAuth = useCallback(
    async (user: TelegramWidgetUser | false) => {
      if (isBlockedByLegal) {
        setWidgetError("Сначала примите документы сайта.");
        return;
      }

      if (!user) {
        setWidgetError("Telegram не вернул данные авторизации.");
        return;
      }

      setPending(true);
      setWidgetError(null);
      const payload = toTelegramAuthPayload(user);

      if (!payload) {
        setPending(false);
        setWidgetError("Telegram вернул неполные данные авторизации. Попробуйте ещё раз.");
        return;
      }

      const result = await signIn("telegram", {
        ...payload,
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
    if (isBlockedByLegal || !normalizedBotId || normalizedBotUsername) return;

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
  }, [isBlockedByLegal, normalizedBotId, normalizedBotUsername]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || isBlockedByLegal || !normalizedBotUsername) return;

    setWidgetError(null);
    container.innerHTML = "";

    const script = document.createElement("script");
    script.src = TELEGRAM_WIDGET_SCRIPT_URL;
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
  }, [isBlockedByLegal, normalizedBotUsername]);

  const startTelegramAuth = () => {
    if (isBlockedByLegal) {
      setWidgetError("Сначала примите документы сайта.");
      return;
    }

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
    window.Telegram.Login.auth({ bot_id: normalizedBotId, request_access: "write", lang: "ru" }, finishTelegramAuth);
  };

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
      ) : normalizedBotUsername ? (
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
      ) : normalizedBotId ? (
        <div className="rounded-2xl bg-black/20 p-3">
          <button
            type="button"
            onClick={startTelegramAuth}
            disabled={pending}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#229ED9] px-4 py-3 text-sm font-semibold text-white shadow-[0_12px_30px_rgba(34,158,217,0.18)] transition hover:bg-[#1d8fc5] disabled:cursor-not-allowed disabled:opacity-70"
          >
            <Send className="h-4 w-4" />
            {pending ? "Выполняем вход..." : scriptReady ? "Войти через Telegram" : "Загрузка Telegram..."}
          </button>

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
