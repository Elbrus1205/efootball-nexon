"use client";

import { useEffect, useRef, useState } from "react";
import { signIn, useSession } from "next-auth/react";
import { usePathname, useRouter } from "next/navigation";
import Script from "next/script";
import { getDeviceFingerprint } from "@/lib/device-fingerprint";

type TelegramWebApp = {
  initData?: string;
  ready?: () => void;
  expand?: () => void;
  setHeaderColor?: (color: string) => void;
  setBackgroundColor?: (color: string) => void;
};

const TELEGRAM_WEB_APP_WAIT_ATTEMPTS = 20;
const TELEGRAM_WEB_APP_WAIT_DELAY_MS = 150;

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function getTelegramWebApp() {
  for (let attempt = 0; attempt < TELEGRAM_WEB_APP_WAIT_ATTEMPTS; attempt += 1) {
    const webApp = (window as Window & { Telegram?: { WebApp?: TelegramWebApp } }).Telegram?.WebApp;
    if (webApp?.initData) return webApp;
    await wait(TELEGRAM_WEB_APP_WAIT_DELAY_MS);
  }

  return (window as Window & { Telegram?: { WebApp?: TelegramWebApp } }).Telegram?.WebApp ?? null;
}

function prepareTelegramMiniApp(webApp: TelegramWebApp) {
  webApp.ready?.();
  webApp.expand?.();
  webApp.setHeaderColor?.("#0A0A0A");
  webApp.setBackgroundColor?.("#0A0A0A");
}

export function TelegramMiniAppAutoLogin() {
  const { status } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const attemptedRef = useRef(false);
  const [shouldLoadTelegram, setShouldLoadTelegram] = useState(false);

  useEffect(() => {
    setShouldLoadTelegram(
      Boolean((window as Window & { Telegram?: { WebApp?: TelegramWebApp } }).Telegram?.WebApp) ||
        navigator.userAgent.toLowerCase().includes("telegram") ||
        window.location.hash.includes("tgWebApp") ||
        window.location.search.includes("tgWebApp"),
    );
  }, []);

  useEffect(() => {
    if (!shouldLoadTelegram) return;
    if (status !== "unauthenticated" || attemptedRef.current) return;

    attemptedRef.current = true;
    let cancelled = false;

    const run = async () => {
      const webApp = await getTelegramWebApp();
      if (cancelled || !webApp?.initData) return;

      prepareTelegramMiniApp(webApp);

      const result = await signIn("telegram-miniapp", {
        initData: webApp.initData,
        fingerprint: await getDeviceFingerprint(),
        redirect: false,
      });

      if (cancelled || !result || result.error) return;

      if (pathname === "/login" || pathname === "/register") {
        router.replace("/dashboard");
        router.refresh();
        return;
      }

      router.refresh();
    };

    run().catch((error) => {
      console.warn("[telegram-miniapp] auto-login-failed", error);
    });

    return () => {
      cancelled = true;
    };
  }, [pathname, router, shouldLoadTelegram, status]);

  return shouldLoadTelegram ? <Script src="https://telegram.org/js/telegram-web-app.js?62" strategy="afterInteractive" /> : null;
}
