"use client";

import { useEffect, useRef } from "react";
import { signIn } from "next-auth/react";

declare global {
  interface Window {
    onTelegramAuth?: (user: Record<string, string>) => void;
  }
}

export function TelegramLogin({ botUsername }: { botUsername?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!botUsername || !containerRef.current) return;

    window.onTelegramAuth = async (user) => {
      await signIn("telegram", {
        ...user,
        callbackUrl: "/dashboard",
      });
    };

    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.async = true;
    script.setAttribute("data-telegram-login", botUsername);
    script.setAttribute("data-size", "large");
    script.setAttribute("data-radius", "12");
    script.setAttribute("data-request-access", "write");
    script.setAttribute("data-onauth", "onTelegramAuth(user)");
    containerRef.current.appendChild(script);

    return () => {
      containerRef.current?.replaceChildren();
    };
  }, [botUsername]);

  return <div ref={containerRef} className="min-h-11" />;
}
