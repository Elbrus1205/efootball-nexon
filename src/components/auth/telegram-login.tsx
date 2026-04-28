"use client";

import { useEffect, useState, useTransition } from "react";
import { AlertCircle, Loader2, Send } from "lucide-react";
import { signIn } from "next-auth/react";

export function TelegramLogin({
  mode,
  enabled,
  completionToken,
  errorMessage,
  legalAccepted = true,
  requireLegalAcceptance = false,
}: {
  mode: "login" | "register";
  enabled: boolean;
  completionToken?: string;
  errorMessage?: string;
  legalAccepted?: boolean;
  requireLegalAcceptance?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(errorMessage ?? null);
  const [finalizedToken, setFinalizedToken] = useState("");
  const isBlockedByLegal = requireLegalAcceptance && !legalAccepted;
  const effectiveLegalAccepted = requireLegalAcceptance ? legalAccepted : true;

  useEffect(() => {
    setError(errorMessage ?? null);
  }, [errorMessage]);

  useEffect(() => {
    if (!completionToken || finalizedToken === completionToken) return;

    setFinalizedToken(completionToken);
    setError(null);

    startTransition(async () => {
      const result = await signIn("telegram", {
        token: completionToken,
        callbackUrl: "/dashboard",
        redirect: false,
      });

      if (!result || result.error) {
        setError("Не удалось завершить вход через Telegram. Попробуйте ещё раз.");
        return;
      }

      window.location.replace(result.url || "/dashboard");
    });
  }, [completionToken, finalizedToken, startTransition]);

  const startTelegramLogin = () => {
    if (isBlockedByLegal) {
      setError("Сначала примите документы сайта.");
      return;
    }

    if (!enabled) {
      setError("Telegram Login не настроен. Добавьте TELEGRAM_CLIENT_ID и TELEGRAM_CLIENT_SECRET.");
      return;
    }

    setError(null);
    const params = new URLSearchParams({
      mode,
      legalAccepted: effectiveLegalAccepted ? "1" : "0",
    });

    window.location.assign(`/api/auth/telegram-oidc/begin?${params.toString()}`);
  };

  return (
    <div className="rounded-3xl border border-[#229ED9]/25 bg-[linear-gradient(180deg,rgba(34,158,217,0.16),rgba(34,158,217,0.06))] p-4 shadow-[0_12px_30px_rgba(34,158,217,0.08)]">
      <div className="mb-4 flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#229ED9] text-white shadow-lg shadow-[#229ED9]/20">
          <Send className="h-5 w-5" />
        </div>
        <div className="space-y-1">
          <div className="text-lg font-semibold text-white">Вход через Telegram</div>
          <p className="text-sm text-sky-100/90">Новый Telegram Login на базе OpenID Connect и redirect flow.</p>
        </div>
      </div>

      {isBlockedByLegal ? (
        <div className="rounded-2xl border border-dashed border-[#229ED9]/25 bg-black/20 px-4 py-3 text-sm leading-6 text-sky-100">
          Примите документы выше, чтобы продолжить регистрацию через Telegram.
        </div>
      ) : enabled ? (
        <div className="rounded-2xl bg-black/20 p-3">
          <button
            type="button"
            onClick={startTelegramLogin}
            disabled={pending}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#229ED9] px-4 py-3 text-sm font-semibold text-white shadow-[0_12px_30px_rgba(34,158,217,0.18)] transition hover:bg-[#1d8fc5] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {pending ? "Завершаем вход..." : "Продолжить через Telegram"}
          </button>

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
          <span>Добавьте `TELEGRAM_CLIENT_ID` и `TELEGRAM_CLIENT_SECRET`, чтобы включить новый Telegram Login.</span>
        </div>
      )}
    </div>
  );
}
