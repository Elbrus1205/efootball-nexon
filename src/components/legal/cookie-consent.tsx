"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Cookie, ShieldCheck } from "lucide-react";

const NOTICE_COOKIE = "cookie_notice_acknowledged";
const NOTICE_VERSION = "2";
const NOTICE_MAX_AGE_DAYS = 365;

function hasStoredConsent() {
  if (typeof document === "undefined") return true;
  return document.cookie.split("; ").some((entry) => entry === `${NOTICE_COOKIE}=${NOTICE_VERSION}`);
}

function storeConsent() {
  if (typeof document === "undefined") return;
  const maxAge = NOTICE_MAX_AGE_DAYS * 24 * 60 * 60;
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${NOTICE_COOKIE}=${NOTICE_VERSION}; Max-Age=${maxAge}; Path=/; SameSite=Lax${secure}`;
}

export function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Рендерим только на клиенте, чтобы не ловить рассинхрон гидрации.
    // Согласие хранится в cookie на год: не спрашиваем повторно, пока оно живо.
    if (!hasStoredConsent()) {
      setVisible(true);
    }
  }, []);

  if (!visible) return null;

  const accept = () => {
    storeConsent();
    setVisible(false);
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-[95] flex justify-center px-3 pb-3 sm:px-4 sm:pb-4">
      <div
        role="dialog"
        aria-live="polite"
        aria-label="Уведомление об использовании cookie"
        className="pointer-events-auto relative w-full max-w-3xl overflow-hidden rounded-2xl border border-[#b9944f]/30 bg-[#0b0b0b]/95 shadow-[0_24px_70px_rgba(0,0,0,0.6)] backdrop-blur-2xl animate-mobile-menu-item"
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#b9944f]/65 to-transparent" />
        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-4 sm:p-5">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#b9944f]/30 bg-[#b9944f]/10 text-[#e7cf8f]">
              <Cookie className="h-5 w-5" />
            </span>
            <div className="min-w-0 space-y-1">
              <div className="text-sm font-black text-white sm:text-base">Мы используем cookie</div>
              <p className="text-xs leading-5 text-zinc-400 sm:text-sm sm:leading-6">
                Сайт использует только обязательные cookie для входа, безопасности и корректной работы турниров. Сторонняя аналитика и маркетинговые cookie не подключены. Кнопка «Понятно» только закрывает уведомление.{" "}
                <Link href="/cookies" className="font-semibold text-[#e7cf8f] underline-offset-4 transition hover:text-white hover:underline">
                  Политика cookie
                </Link>
                .
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2 sm:ml-auto">
            <Link
              href="/cookies"
              className="hidden h-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] px-4 text-sm font-bold text-zinc-200 transition hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b9944f]/60 sm:inline-flex"
            >
              Подробнее
            </Link>
            <button
              type="button"
              onClick={accept}
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-black uppercase tracking-[0.06em] text-black shadow-[0_2px_18px_rgba(212,175,55,0.22)] transition-all hover:bg-primary/90 hover:shadow-[0_2px_24px_rgba(212,175,55,0.32)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 active:scale-[0.99] sm:w-auto"
            >
              <ShieldCheck className="h-4 w-4" />
              Понятно
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
