"use client";

import dynamic from "next/dynamic";
import { SessionProvider } from "next-auth/react";
import { TelegramMiniAppAutoLogin } from "@/components/telegram/telegram-mini-app-auto-login";
import { AppLaunchSplash } from "@/components/providers/app-launch-splash";

const DeferredAppEnhancements = dynamic(
  () => import("@/components/providers/deferred-app-enhancements").then((module) => module.DeferredAppEnhancements),
  { ssr: false },
);

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <AppLaunchSplash />
      {children}
      <TelegramMiniAppAutoLogin />
      <DeferredAppEnhancements />
    </SessionProvider>
  );
}
