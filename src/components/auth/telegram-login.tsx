"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Loader2, Send } from "lucide-react";
import { signIn } from "next-auth/react";
import { formatTelegramLoginSdkError, loadTelegramLoginSdk, openTelegramLoginPopup } from "@/lib/telegram-login-sdk";
import { getDeviceFingerprint } from "@/lib/device-fingerprint";

export function TelegramLogin({
  mode,
  enabled,
  clientId,
  requireLegalAcceptance = false,
  registrationAllowed = true,
  dateOfBirth = "",
  termsAccepted = false,
  personalDataConsent = false,
  publicDataConsent = false,
}: {
  mode: "login" | "register";
  enabled: boolean;
  clientId?: string;
  requireLegalAcceptance?: boolean;
  registrationAllowed?: boolean;
  dateOfBirth?: string;
  termsAccepted?: boolean;
  personalDataConsent?: boolean;
  publicDataConsent?: boolean;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isBlockedByLegal = requireLegalAcceptance && !registrationAllowed;

  useEffect(() => {
    if (!enabled || !clientId) return;

    loadTelegramLoginSdk().catch(() => null);
  }, [clientId, enabled]);

  const startTelegramLogin = async () => {
    if (isBlockedByLegal || pending) return;

    if (!enabled || !clientId) {
      setError("Telegram Login не настроен. Добавьте TELEGRAM_CLIENT_ID.");
      return;
    }

    setPending(true);
    setError(null);

    try {
      const authResult = await openTelegramLoginPopup({
        clientId,
        lang: "ru",
        requestAccess: ["write"],
      });

      if (authResult.error) {
        setError("Telegram не завершил авторизацию. Попробуйте ещё раз.");
        setPending(false);
        return;
      }

      const idToken = authResult.id_token?.trim();
      if (!idToken) {
        setError("Telegram не вернул ID token. Попробуйте ещё раз.");
        setPending(false);
        return;
      }

      const result = await signIn("telegram", {
        idToken,
        dateOfBirth,
        termsAccepted: termsAccepted ? "true" : "false",
        personalDataConsent: personalDataConsent ? "true" : "false",
        publicDataConsent: publicDataConsent ? "true" : "false",
        callbackUrl: "/dashboard",
        fingerprint: await getDeviceFingerprint(),
        redirect: false,
      });

      if (!result || result.error) {
        setError("Не удалось завершить вход через Telegram. Попробуйте ещё раз.");
        setPending(false);
        return;
      }

      window.location.replace(result.url || "/dashboard");
    } catch (cause) {
      setError(formatTelegramLoginSdkError(cause));
      setPending(false);
    }
  };

  return (
    <div>
      {enabled ? (
        <>
          <button
            type="button"
            onClick={startTelegramLogin}
            disabled={pending || isBlockedByLegal}
            className="flex min-h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#229ED9] px-3 py-2 text-sm font-semibold text-white shadow-[0_12px_30px_rgba(34,158,217,0.18)] transition hover:bg-[#1d8fc5] disabled:cursor-not-allowed disabled:opacity-60"
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
        </>
      ) : (
        <div className="flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>Добавьте `TELEGRAM_CLIENT_ID`, чтобы включить Telegram Login.</span>
        </div>
      )}
    </div>
  );
}
