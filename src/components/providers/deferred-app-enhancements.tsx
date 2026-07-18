"use client";

import { useEffect, useState } from "react";
import { Toaster } from "sonner";
import { CookieConsent } from "@/components/legal/cookie-consent";
import { RegulationsUpdateModal } from "@/components/legal/regulations-update-modal";
import { TimeZoneReporter } from "@/components/profile/time-zone-reporter";
import { PushNotificationRegistrar } from "@/components/providers/push-notification-registrar";

export function DeferredAppEnhancements() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setReady(true), 600);
    return () => window.clearTimeout(timer);
  }, []);

  if (!ready) return null;

  return (
    <>
      <PushNotificationRegistrar />
      <TimeZoneReporter />
      <RegulationsUpdateModal />
      <CookieConsent />
      <Toaster richColors position="top-right" />
    </>
  );
}
