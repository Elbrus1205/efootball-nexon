"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import styles from "./app-launch-splash.module.css";

type SplashPhase = "loading" | "leaving" | "hidden";

function delay(milliseconds: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, milliseconds));
}

function pageLoaded() {
  if (document.readyState === "complete") return Promise.resolve();
  return new Promise<void>((resolve) => window.addEventListener("load", () => resolve(), { once: true }));
}

export function AppLaunchSplash() {
  const [phase, setPhase] = useState<SplashPhase>("loading");
  const [forceVisible, setForceVisible] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(display-mode: standalone)");
    const navigatorWithStandalone = navigator as Navigator & { standalone?: boolean };
    const isInstalled = media.matches || navigatorWithStandalone.standalone === true;

    if (!isInstalled) {
      setPhase("hidden");
      return;
    }

    setForceVisible(true);
    let cancelled = false;
    let leaveTimer: number | undefined;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const essentialsReady = pageLoaded();
    const maximumWait = delay(reducedMotion ? 100 : 700);

    Promise.race([essentialsReady, maximumWait]).then(() => {
      if (cancelled) return;
      setPhase("leaving");
      leaveTimer = window.setTimeout(() => setPhase("hidden"), reducedMotion ? 30 : 140);
    });

    return () => {
      cancelled = true;
      if (leaveTimer) window.clearTimeout(leaveTimer);
    };
  }, []);

  if (phase === "hidden") return null;

  return (
    <div
      className={`${styles.splash} ${forceVisible ? styles.forceVisible : ""} ${phase === "leaving" ? styles.leaving : ""}`}
      role="status"
      aria-live="polite"
      aria-label="Загрузка eFootball Nexon"
      aria-busy={phase === "loading"}
    >
      <div className={styles.grid} aria-hidden="true" />
      <div className={styles.orbit} aria-hidden="true" />
      <div className={styles.content}>
        <div className={styles.iconFrame}>
          <span className={styles.iconGlow} aria-hidden="true" />
          <Image
            src="/icons/efootball-nexon-maskable-512-v2.png"
            alt=""
            width={112}
            height={112}
            className={styles.icon}
          />
          <span className={styles.scan} aria-hidden="true" />
        </div>
        <div className={styles.brand}>
          <strong>eFootball</strong>
          <span>Nexon</span>
        </div>
        <p>Турнирная платформа</p>
        <div className={styles.progress} aria-hidden="true"><span /></div>
        <small>Подготавливаем приложение</small>
      </div>
    </div>
  );
}
