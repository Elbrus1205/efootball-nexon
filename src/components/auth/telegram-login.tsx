"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, ExternalLink, Loader2, Send } from "lucide-react";
import { signIn } from "next-auth/react";

type TelegramLoginPhase = "idle" | "starting" | "waiting" | "finishing";
type TelegramLoginStatus = "verified" | "expired" | "missing";

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
  const router = useRouter();
  const pollTimerRef = useRef<number | null>(null);
  const normalizedBotUsername = useMemo(() => normalizeTelegramBotUsername(botUsername), [botUsername]);
  const isBlockedByLegal = requireLegalAcceptance && !legalAccepted;
  const [phase, setPhase] = useState<TelegramLoginPhase>("idle");
  const [loginToken, setLoginToken] = useState<string | null>(null);
  const [botUrl, setBotUrl] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (pollTimerRef.current) {
        window.clearInterval(pollTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!loginToken || phase !== "waiting") {
      if (pollTimerRef.current) {
        window.clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
      return;
    }

    const poll = async () => {
      const response = await fetch(`/api/auth/telegram-bot-login/status?token=${encodeURIComponent(loginToken)}`, {
        cache: "no-store",
      }).catch(() => null);

      if (!response) {
        return;
      }

      const payload = (await response.json().catch(() => null)) as { status?: TelegramLoginStatus | "pending" } | null;
      const nextStatus = payload?.status ?? "missing";

      if (nextStatus === "verified") {
        if (pollTimerRef.current) {
          window.clearInterval(pollTimerRef.current);
          pollTimerRef.current = null;
        }

        setPhase("finishing");

        const result = await signIn("telegram-bot", {
          token: loginToken,
          legalAccepted: legalAccepted ? "true" : "false",
          callbackUrl: "/dashboard",
          redirect: false,
        });

        if (result?.error) {
          setPhase("idle");
          setError("Telegram подтвердил вход, но сайт не смог завершить авторизацию. Повторите попытку.");
          return;
        }

        router.refresh();
        router.push(result?.url ?? "/dashboard");
        return;
      }

      if (nextStatus === "expired" || nextStatus === "missing") {
        if (pollTimerRef.current) {
          window.clearInterval(pollTimerRef.current);
          pollTimerRef.current = null;
        }

        setPhase("idle");
        setLoginToken(null);
        setError("Ссылка для входа через Telegram истекла. Запустите вход ещё раз.");
      }
    };

    void poll();
    pollTimerRef.current = window.setInterval(() => {
      void poll();
    }, 2000);

    return () => {
      if (pollTimerRef.current) {
        window.clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [legalAccepted, loginToken, phase, router]);

  const startTelegramLogin = async () => {
    if (isBlockedByLegal) {
      setError("Сначала примите документы сайта.");
      return;
    }

    setPhase("starting");
    setError(null);

    const response = await fetch("/api/auth/telegram-bot-login/begin", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        legalAccepted,
      }),
    }).catch(() => null);

    const payload = (await response?.json().catch(() => null)) as
      | { error?: string; token?: string; botUrl?: string; botUsername?: string }
      | null;

    if (!response?.ok || !payload?.token || !payload?.botUrl) {
      setPhase("idle");
      setError(payload?.error || "Не удалось начать вход через Telegram. Проверьте настройки бота и webhook.");
      return;
    }

    setLoginToken(payload.token);
    setBotUrl(payload.botUrl);
    setPhase("waiting");

    const popup = window.open(payload.botUrl, "_blank", "noopener,noreferrer");
    if (!popup) {
      setError("Браузер заблокировал открытие Telegram. Откройте бота по ссылке ниже и нажмите Start.");
    }
  };

  const busy = phase === "starting" || phase === "finishing";
  const showHelp = phase === "waiting" && Boolean(loginToken);

  return (
    <div className="rounded-3xl border border-[#229ED9]/25 bg-[linear-gradient(180deg,rgba(34,158,217,0.16),rgba(34,158,217,0.06))] p-4 shadow-[0_12px_30px_rgba(34,158,217,0.08)]">
      <div className="mb-4 flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#229ED9] text-white shadow-lg shadow-[#229ED9]/20">
          <Send className="h-5 w-5" />
        </div>
        <div className="space-y-1">
          <div className="text-lg font-semibold text-white">Вход через Telegram</div>
          <p className="text-sm text-sky-100/90">Откроем бота, вы нажмёте Start, а сайт завершит вход автоматически.</p>
        </div>
      </div>

      {isBlockedByLegal ? (
        <div className="rounded-2xl border border-dashed border-[#229ED9]/25 bg-black/20 px-4 py-3 text-sm leading-6 text-sky-100">
          Примите документы выше, чтобы продолжить регистрацию через Telegram.
        </div>
      ) : (
        <div className="rounded-2xl bg-black/20 p-3">
          <button
            type="button"
            onClick={() => void startTelegramLogin()}
            disabled={busy}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#229ED9] px-4 py-3 text-sm font-semibold text-white shadow-[0_12px_30px_rgba(34,158,217,0.18)] transition hover:bg-[#1d8fc5] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {phase === "starting"
              ? "Готовим вход..."
              : phase === "finishing"
                ? "Завершаем вход..."
                : "Войти через Telegram"}
          </button>

          {showHelp ? (
            <div className="mt-3 rounded-2xl border border-sky-400/20 bg-sky-500/10 px-3 py-3 text-sm text-sky-100">
              <p>В Telegram откройте бота и нажмите Start. Как только бот подтвердит ваш аккаунт, сайт войдёт сам.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <a
                  href={botUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl border border-sky-300/20 bg-sky-400/10 px-3 py-2 font-medium text-white transition hover:bg-sky-400/20"
                >
                  <ExternalLink className="h-4 w-4" />
                  Открыть бота
                </a>
                {normalizedBotUsername ? (
                  <span className="inline-flex items-center rounded-xl border border-white/10 px-3 py-2 text-xs text-sky-100/80">
                    @{normalizedBotUsername}
                  </span>
                ) : null}
              </div>
            </div>
          ) : null}

          {error ? (
            <div className="mt-3 flex items-start gap-2 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-3 py-3 text-sm text-amber-200">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
