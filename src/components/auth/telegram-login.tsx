"use client";

import { useState, useTransition } from "react";
import { AlertCircle, Loader2, Send } from "lucide-react";
import { signIn } from "next-auth/react";
import { formatTelegramLoginSdkError, openTelegramLoginPopup } from "@/lib/telegram-login-sdk";

export function TelegramLogin({
  mode,
  enabled,
  clientId,
  legalAccepted = true,
  requireLegalAcceptance = false,
}: {
  mode: "login" | "register";
  enabled: boolean;
  clientId?: string;
  legalAccepted?: boolean;
  requireLegalAcceptance?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const isBlockedByLegal = requireLegalAcceptance && !legalAccepted;
  const effectiveLegalAccepted = requireLegalAcceptance ? legalAccepted : true;

  const startTelegramLogin = () => {
    if (isBlockedByLegal) {
      setError("Сначала примите документы сайта.");
      return;
    }

    if (!enabled || !clientId) {
      setError("Telegram Login не настроен. Добавьте TELEGRAM_CLIENT_ID.");
      return;
    }

    setError(null);

    startTransition(async () => {
      try {
        const authResult = await openTelegramLoginPopup({
          clientId,
          lang: "ru",
          requestAccess: ["write"],
        });

        if (authResult.error) {
          setError("Telegram не завершил авторизацию. Попробуйте ещё раз.");
          return;
        }

        const idToken = authResult.id_token?.trim();
        if (!idToken) {
          setError("Telegram не вернул ID token. Попробуйте ещё раз.");
          return;
        }

        const result = await signIn("telegram", {
          idToken,
          legalAccepted: effectiveLegalAccepted ? "true" : "false",
          callbackUrl: "/dashboard",
          redirect: false,
        });

        if (!result || result.error) {
          setError("Не удалось завершить вход через Telegram. Попробуйте ещё раз.");
          return;
        }

        window.location.replace(result.url || "/dashboard");
      } catch (cause) {
        setError(formatTelegramLoginSdkError(cause));
      }
    });
  };

  return (
    <div className="rounded-2xl border border-[#229ED9]/25 bg-[linear-gradient(180deg,rgba(34,158,217,0.14),rgba(34,158,217,0.05))] p-3 shadow-[0_12px_30px_rgba(34,158,217,0.08)]">
      <div className="mb-3 flex items-start gap-2.5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#229ED9] text-white shadow-lg shadow-[#229ED9]/20">
          <Send className="h-4 w-4" />
        </div>
        <div className="min-w-0 space-y-0.5">
          <div className="text-sm font-semibold text-white">Вход через Telegram</div>
          <p className="text-xs leading-4 text-sky-100/80">Быстрый вход без пароля.</p>
        </div>
      </div>

      {isBlockedByLegal ? (
        <div className="rounded-xl border border-dashed border-[#229ED9]/25 bg-black/20 px-3 py-2 text-xs leading-5 text-sky-100">
          Примите документы выше, чтобы продолжить регистрацию через Telegram.
        </div>
      ) : enabled ? (
        <div className="rounded-xl bg-black/20 p-2">
          <button
            type="button"
            onClick={startTelegramLogin}
            disabled={pending}
            className="flex min-h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#229ED9] px-3 py-2 text-sm font-semibold text-white shadow-[0_12px_30px_rgba(34,158,217,0.18)] transition hover:bg-[#1d8fc5] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {pending ? "Завершаем вход..." : mode === "register" ? "Зарегистрироваться через Telegram" : "Войти через Telegram"}
          </button>

          {error ? (
            <div className="mt-2 flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>Добавьте `TELEGRAM_CLIENT_ID`, чтобы включить новый Telegram Login.</span>
        </div>
      )}
    </div>
  );
}
