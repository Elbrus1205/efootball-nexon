"use client";

import { SessionProvider } from "next-auth/react";
import { Toaster } from "sonner";
import { TimeZoneReporter } from "@/components/profile/time-zone-reporter";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      {children}
      <TimeZoneReporter />
      <Toaster richColors position="top-right" />
    </SessionProvider>
  );
}
