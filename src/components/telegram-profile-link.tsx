"use client";

import type { AnchorHTMLAttributes, MouseEvent, ReactNode } from "react";
import type { TelegramProfileLinks } from "@/lib/social-links";

type TelegramProfileLinkProps = TelegramProfileLinks & {
  children: ReactNode;
  className?: string;
  ariaLabel?: string;
  "aria-label"?: string;
  target?: AnchorHTMLAttributes<HTMLAnchorElement>["target"];
  rel?: AnchorHTMLAttributes<HTMLAnchorElement>["rel"];
};

function pickTelegramHref(links: TelegramProfileLinks) {
  const userAgent = navigator.userAgent || "";

  if (/Android/i.test(userAgent)) return links.androidHref ?? links.href;
  if (/iPhone|iPad|iPod/i.test(userAgent)) return links.iosHref ?? links.href;

  return links.href;
}

export function TelegramProfileLink({
  href,
  androidHref,
  iosHref,
  webHref,
  telegramId,
  username,
  children,
  className,
  ariaLabel,
  "aria-label": ariaLabelProp,
  target = "_blank",
  rel = "noreferrer",
}: TelegramProfileLinkProps) {
  const openHref = (event: MouseEvent<HTMLAnchorElement>) => {
    if (typeof window === "undefined") return;

    const selectedHref = pickTelegramHref({ href, androidHref, iosHref, webHref, telegramId, username });
    if (!selectedHref.startsWith("tg://")) return;

    event.preventDefault();

    let fallbackTimer: number | undefined;
    const clearFallback = () => {
      if (fallbackTimer) window.clearTimeout(fallbackTimer);
      document.removeEventListener("visibilitychange", clearFallback);
      window.removeEventListener("pagehide", clearFallback);
    };

    if (webHref) {
      document.addEventListener("visibilitychange", clearFallback, { once: true });
      window.addEventListener("pagehide", clearFallback, { once: true });
      fallbackTimer = window.setTimeout(() => {
        if (!document.hidden) window.location.href = webHref;
      }, 1400);
    }

    window.location.href = selectedHref;
  };

  return (
    <a href={href} target={target} rel={rel} aria-label={ariaLabel ?? ariaLabelProp} className={className} onClick={openHref}>
      {children}
    </a>
  );
}
