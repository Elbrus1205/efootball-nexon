"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

const TOP_MAIL_RU_COUNTER_ID = "3765921";

declare global {
  interface Window {
    _tmr?: Array<Record<string, unknown>>;
  }
}

export function TopMailRuPixel() {
  const pathname = usePathname();

  useEffect(() => {
    window._tmr = window._tmr || [];
    window._tmr.push({
      id: TOP_MAIL_RU_COUNTER_ID,
      type: "pageView",
      start: new Date().getTime(),
    });
  }, [pathname]);

  return <Script id="tmr-code" src="https://top-fwz1.mail.ru/js/code.js" strategy="afterInteractive" />;
}
