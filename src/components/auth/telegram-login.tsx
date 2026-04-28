"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { AlertCircle, Loader2, Send } from "lucide-react";
import { signIn } from "next-auth/react";
import {
  loadTelegramWidgetScript,
  normalizeTelegramBotId,
  normalizeTelegramBotUsername,
  type TelegramWidgetUser,
} from "@/lib/telegram-widget";

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
  const [pending, startTransition] = useTransition();
  const [scriptReady, setScriptReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const normalizedBotUsername = useMemo(() => normalizeTelegramBotUsername(botUsername), [botUsername]);
  const normalizedBotId = useMemo(() => normalizeTelegramBotId(botId), [botId]);
  const isBlockedByLegal = requireLegalAcceptance && !legalAccepted;

  useEffect(() => {
    if (isBlockedByLegal || !normalizedBotId) return;

    let cancelled = false;
    setError(null);

    loadTelegramWidgetScript()
      .then(() => {
        if (!cancelled) {
          setScriptReady(Boolean(window.Telegram?.Login?.auth));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setScriptReady(false);
          setError("Не удалось загрузить Telegram Login Widget. Проверьте доступность telegram.org.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isBlockedByLegal, normalizedBotId]);

  const startTelegramAuth = () => {
    if (isBlockedByLegal) {
      setError("Сначала примите документы сайта.");
      return;
    }

    if (!normalizedBotId) {
      setError("Добавьте TELEGRAM_BOT_TOKEN или NEXT_PUBLIC_TELEGRAM_BOT_ID, чтобы включить вход через Telegram.");
      return;
    }

    if (!window.Telegram?.Login?.auth) {
      setError("Telegram Login Widget ещё загружается. Нажмите ещё раз через секунду.");
      void loadTelegramWidgetScript()
        .then(() => {
          setScriptReady(Boolean(window.Telegram?.Login?.auth));
          setError(null);
        })
        .catch(() => setError("Не удалось загрузить Telegram Login Widget. Проверьте доступность telegram.org."));
      return;
    }

    setError(null);

    window.Telegram.Login.auth(
      {
        bot_id: normalizedBotId,
        request_access: "write",
        lang: "ru",
      },
      (user) => {
        if (!user) {
          setError("Telegram не вернул данные авторизации. Попробуйте ещё раз.");
          return;
        }

        const payload = toTelegramPayload(user);
        if (!payload) {
          setError("Telegram не вернул данные авторизации. Попробуйте ещё раз.");
          return;
        }

        startTransition(async () => {
          const result = await signIn("telegram", {
            ...payload,
            legalAccepted: legalAccepted ? "true" : "false",
            callbackUrl: "/dashboard",
            redirect: false,
          });

          if (!result || result.error) {
            setError("Не удалось завершить вход через Telegram. Проверьте настройки бота и домен Telegram Login.");
            return;
          }

          window.location.replace(result.url || "/dashboard");
        });
      },
    );
  };

  return (
    <div className="rounded-3xl border border-[#229ED9]/25 bg-[linear-gradient(180deg,rgba(34,158,217,0.16),rgba(34,158,217,0.06))] p-4 shadow-[0_12px_30px_rgba(34,158,217,0.08)]">
      <div className="mb-4 flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#229ED9] text-white shadow-lg shadow-[#229ED9]/20">
          <Send className="h-5 w-5" />
        </div>
        <div className="space-y-1">
          <div className="text-lg font-semibold text-white">Вход через Telegram</div>
          <p className="text-sm text-sky-100/90">Подтвердите вход в Telegram, и мы сразу авторизуем вас на сайте.</p>
        </div>
      </div>

      {isBlockedByLegal ? (
        <div className="rounded-2xl border border-dashed border-[#229ED9]/25 bg-black/20 px-4 py-3 text-sm leading-6 text-sky-100">
          Примите документы выше, чтобы продолжить регистрацию через Telegram.
        </div>
      ) : normalizedBotId ? (
        <div className="rounded-2xl bg-black/20 p-3">
          <button
            type="button"
            onClick={startTelegramAuth}
            disabled={pending}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#229ED9] px-4 py-3 text-sm font-semibold text-white shadow-[0_12px_30px_rgba(34,158,217,0.18)] transition hover:bg-[#1d8fc5] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {pending ? "Завершаем вход..." : scriptReady ? "Войти через Telegram" : "Загрузка Telegram..."}
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
          <span>Добавьте `TELEGRAM_BOT_TOKEN` или `NEXT_PUBLIC_TELEGRAM_BOT_ID`, чтобы включить вход через Telegram.</span>
        </div>
      )}
    </div>
  );
}
