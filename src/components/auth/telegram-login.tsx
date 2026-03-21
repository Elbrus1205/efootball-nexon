"use client";

import { useEffect, useRef } from "react";
import { Send } from "lucide-react";
import { signIn } from "next-auth/react";

declare global {
  interface Window {
    onTelegramAuth?: (user: Record<string, string>) => void;
  }
}

export function TelegramLogin({ botUsername }: { botUsername?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!botUsername || !container) return;

    window.onTelegramAuth = async (user) => {
      await signIn("telegram", {
        ...user,
        callbackUrl: "/dashboard",
      });
    };

    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.async = true;
    script.setAttribute("data-telegram-login", botUsername);
    script.setAttribute("data-size", "large");
    script.setAttribute("data-radius", "12");
    script.setAttribute("data-request-access", "write");
    script.setAttribute("data-onauth", "onTelegramAuth(user)");
    container.appendChild(script);

    return () => {
      container.replaceChildren();
    };
  }, [botUsername]);

  return (
    <div className="rounded-2xl border border-white/10 bg-[#229ED9]/10 p-4">
      <div className="mb-3 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#229ED9] text-white">
          <Send className="h-5 w-5" />
        </div>
        <div>
          <div className="font-medium text-white">Вход через Telegram</div>
          <div className="text-xs text-zinc-400">Подтвердите вход через Telegram Login Widget.</div>
        </div>
      </div>

      {botUsername ? (
        <div ref={containerRef} className="min-h-11" />
      ) : (
        <div className="rounded-xl border border-dashed border-white/10 px-4 py-3 text-sm text-zinc-400">
          Добавьте `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME`, чтобы показать Telegram-кнопку.
        </div>
      )}
    </div>
  );
}
