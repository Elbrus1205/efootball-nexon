"use client";

import { SessionProvider } from "next-auth/react";
import { Toaster } from "sonner";
import { TimeZoneReporter } from "@/components/profile/time-zone-reporter";
import { RegulationsUpdateModal } from "@/components/legal/regulations-update-modal";
import { CookieConsent } from "@/components/legal/cookie-consent";
import { TelegramMiniAppAutoLogin } from "@/components/telegram/telegram-mini-app-auto-login";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      {children}
      <TelegramMiniAppAutoLogin />
      <TimeZoneReporter />
      <RegulationsUpdateModal />
      <CookieConsent />
      <Toaster richColors position="top-right" />
    </SessionProvider>
  );
}
