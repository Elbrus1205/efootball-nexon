"use client";

import { SessionProvider } from "next-auth/react";
import { Toaster } from "sonner";
import { TimeZoneReporter } from "@/components/profile/time-zone-reporter";
import { RegulationsUpdateModal } from "@/components/legal/regulations-update-modal";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      {children}
      <TimeZoneReporter />
      <RegulationsUpdateModal />
      <Toaster richColors position="top-right" />
    </SessionProvider>
  );
}
