"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Send } from "lucide-react";
import { signIn } from "next-auth/react";

declare global {
  interface Window {
    Telegram?: {
      Login?: {
        auth?: (
          options: { bot_id: string; request_access?: "write"; lang?: string },
          callback: (user: Record<string, string> | false) => void,
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

    const existingScript = document.querySelector<HTMLScriptElement>('script[src^="https://telegram.org/js/telegram-widget.js"]');
    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(), { once: true });
      existingScript.addEventListener("error", () => reject(new Error("Telegram widget load failed")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.async = true;
    script.addEventListener("load", () => resolve(), { once: true });
    script.addEventListener("error", () => reject(new Error("Telegram widget load failed")), { once: true });
    document.head.appendChild(script);
  });
}

export function TelegramLogin({
  botUsername,
  botId,
  legalAccepted = true,
  requireLegalAcceptance = false,
}: {
  botUsername?: string;
  botId?: string;
  legalAccepted?: boolean;
  requireLegalAcceptance?: boolean;
}) {
  const [widgetError, setWidgetError] = useState<string | null>(null);
  const [scriptReady, setScriptReady] = useState(false);
  const [pending, setPending] = useState(false);
  const normalizedBotUsername = useMemo(() => normalizeTelegramBotUsername(botUsername), [botUsername]);
  const normalizedBotId = useMemo(() => normalizeTelegramBotId(botId), [botId]);
  const hasBotConfig = Boolean(normalizedBotId);
  const isBlockedByLegal = requireLegalAcceptance && !legalAccepted;
  const router = useRouter();

  useEffect(() => {
    if (!hasBotConfig || isBlockedByLegal) return;

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
  }, [hasBotConfig, isBlockedByLegal]);

  const finishTelegramAuth = useCallback(
    async (user: Record<string, string> | false) => {
      if (!user) {
        setPending(false);
        return;
      }

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
    [legalAccepted, router],
  );

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

    setPending(true);
    setWidgetError(null);
    window.Telegram.Login.auth({ bot_id: normalizedBotId, request_access: "write" }, finishTelegramAuth);
  };

  const startTelegramBotAuth = async () => {
    if (isBlockedByLegal) {
      setWidgetError("Сначала примите документы сайта.");
      return;
    }

    if (!normalizedBotUsername) {
      startTelegramAuth();
      return;
    }

    setPending(true);
    setWidgetError(null);

    try {
      const response = await fetch("/api/auth/telegram-bot-login/begin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ legalAccepted }),
      });
      const payload = (await response.json().catch(() => null)) as { token?: string; botUrl?: string; error?: string } | null;

      if (!response.ok || !payload?.token || !payload.botUrl) {
        setWidgetError(payload?.error ?? "Не удалось начать вход через Telegram-бота.");
        setPending(false);
        return;
      }

      window.open(payload.botUrl, "_blank", "noopener,noreferrer");

      const startedAt = Date.now();
      const timer = window.setInterval(async () => {
        if (Date.now() - startedAt > 10 * 60 * 1000) {
          window.clearInterval(timer);
          setPending(false);
          setWidgetError("Ссылка для входа через Telegram истекла. Попробуйте ещё раз.");
          return;
        }

        const statusResponse = await fetch(`/api/auth/telegram-bot-login/status?token=${encodeURIComponent(payload.token!)}`, {
          cache: "no-store",
        }).catch(() => null);
        const statusPayload = (await statusResponse?.json().catch(() => null)) as { status?: string } | null;

        if (statusPayload?.status === "verified") {
          window.clearInterval(timer);
          const result = await signIn("telegram-bot", {
            token: payload.token,
            legalAccepted: legalAccepted ? "true" : "false",
            callbackUrl: "/dashboard",
            redirect: false,
          });

          setPending(false);

          if (result?.error) {
            setWidgetError("Не удалось завершить вход через Telegram-бота. Попробуйте ещё раз.");
            return;
          }

          router.refresh();
          router.push(result?.url ?? "/dashboard");
        } else if (statusPayload?.status === "expired") {
          window.clearInterval(timer);
          setPending(false);
          setWidgetError("Ссылка для входа через Telegram истекла. Попробуйте ещё раз.");
        }
      }, 2000);
    } catch {
      setPending(false);
      setWidgetError("Не удалось начать вход через Telegram-бота.");
    }
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
      ) : hasBotConfig ? (
        <div className="rounded-2xl bg-black/20 p-3">
          <button
            type="button"
            onClick={startTelegramBotAuth}
            disabled={pending}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#229ED9] px-4 py-3 text-sm font-semibold text-white shadow-[0_12px_30px_rgba(34,158,217,0.18)] transition hover:bg-[#1d8fc5] disabled:cursor-not-allowed disabled:opacity-70"
          >
            <Send className="h-4 w-4" />
            {pending ? "Открываем Telegram..." : scriptReady ? "Войти через Telegram" : "Загрузка Telegram..."}
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
          <span>Добавьте TELEGRAM_BOT_TOKEN или NEXT_PUBLIC_TELEGRAM_BOT_ID, чтобы включить вход через Telegram.</span>
        </div>
      )}
    </div>
  );
}
