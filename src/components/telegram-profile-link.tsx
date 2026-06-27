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

type TelegramWebApp = {
  openTelegramLink?: (url: string) => void;
  openLink?: (url: string, options?: { try_instant_view?: boolean }) => void;
};

function getTelegramWebApp() {
  return (window as Window & { Telegram?: { WebApp?: TelegramWebApp } }).Telegram?.WebApp ?? null;
}

export function TelegramProfileLink({
  href,
  webHref,
  children,
  className,
  ariaLabel,
  "aria-label": ariaLabelProp,
  target = "_blank",
  rel = "noreferrer",
}: TelegramProfileLinkProps) {
  const telegramHref = webHref ?? href;

  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    const webApp = getTelegramWebApp();
    if (!webApp) return;

    event.preventDefault();

    if (webApp.openTelegramLink) {
      webApp.openTelegramLink(telegramHref);
      return;
    }

    if (webApp.openLink) {
      webApp.openLink(telegramHref);
      return;
    }

    window.open(telegramHref, "_blank", "noopener,noreferrer");
  }

  return (
    <a href={telegramHref} target={target} rel={rel} aria-label={ariaLabel ?? ariaLabelProp} className={className} onClick={handleClick}>
      {children}
    </a>
  );
}
