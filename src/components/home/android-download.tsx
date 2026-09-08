"use client";

import { useEffect, useState } from "react";
import { Download, Check, Smartphone } from "lucide-react";
import { InstallAppButton } from "./install-app-button";
import s from "@/app/home.module.css";

export function AndroidDownload({ downloadUrl }: { downloadUrl: string | null }) {
  const [platform, setPlatform] = useState<"unknown" | "android" | "ios" | "desktop">("unknown");
  const [message, setMessage] = useState("");
  const [installed, setInstalled] = useState(false);
  useEffect(() => {
    const agent = navigator.userAgent;
    setPlatform(/Android/i.test(agent) ? "android" : /iPhone|iPad|iPod/i.test(agent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1) ? "ios" : "desktop");
    const update = () => setInstalled(window.matchMedia("(display-mode: standalone)").matches);
    update();
    window.addEventListener("appinstalled", update);
    return () => window.removeEventListener("appinstalled", update);
  }, []);

  return <div className={s.androidActions}>
    {installed ? <p className={s.installState}><Check aria-hidden="true" /> Приложение уже установлено</p> : <>
      {downloadUrl ? <a href={downloadUrl} className={s.primaryButton} download="efootball-nexon.apk" onClick={(event) => {
        if (platform !== "android") {
          event.preventDefault();
          setMessage(platform === "ios" ? "Приложение доступно для Android. Вы можете продолжить пользоваться сайтом." : "Откройте эту страницу на Android, чтобы скачать приложение.");
        }
      }}><Download aria-hidden="true" /> Скачать APK</a> : <p className={s.installState}>APK пока не опубликован</p>}
      {platform === "android" && <InstallAppButton />}
      <button type="button" className={s.textButton} onClick={() => setMessage(platform === "ios"
        ? "Приложение доступно для Android. На iPhone все турниры доступны в браузере."
        : platform === "android" ? "Откройте сайт в Chrome на Android. В меню браузера выберите «Установить приложение» или «Добавить на главный экран»."
          : "Откройте eFootball Nexon в Chrome на Android. В меню браузера выберите «Установить приложение».")}>
        <Smartphone aria-hidden="true" /> Как установить
      </button>
    </>}
    <p className={s.installHelp} role="status">{message || "Android • APK 0,96 МБ • скачивание начнётся сразу"}</p>
  </div>;
}
