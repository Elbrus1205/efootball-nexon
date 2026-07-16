"use client";

import { Download } from "lucide-react";
import { useEffect, useState } from "react";
import s from "@/app/home.module.css";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

export function InstallAppButton() {
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(display-mode: standalone)").matches) return;

    const handlePrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    const handleInstalled = () => setInstallPrompt(null);

    window.addEventListener("beforeinstallprompt", handlePrompt);
    window.addEventListener("appinstalled", handleInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", handlePrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  if (!installPrompt) return null;

  const install = async () => {
    setPending(true);
    await installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
    setPending(false);
  };

  return (
    <button type="button" className={s.installButton} onClick={install} disabled={pending}>
      <Download aria-hidden="true" />
      {pending ? "Открываем установку…" : "Установить приложение"}
    </button>
  );
}
