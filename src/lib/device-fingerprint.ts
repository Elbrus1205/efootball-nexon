"use client";

/**
 * Браузерный отпечаток устройства для обнаружения твинк-аккаунтов.
 *
 * Важно: это веб-приложение (и TWA-обёртка), поэтому IMEI / MAC / Android ID
 * недоступны — браузер их не отдаёт. Мы собираем стабильные браузерные сигналы
 * и хэшируем их в SHA-256. Отпечаток не уникален на 100% (у одинаковых устройств
 * он может совпасть), поэтому на сервере он используется только как сигнал для
 * уведомления, а не для блокировки.
 */

const STORAGE_KEY = "efn-device-fp";

function safeGet<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

function collectSignals(): string {
  const nav = typeof navigator !== "undefined" ? navigator : ({} as Navigator);
  const scr = typeof screen !== "undefined" ? screen : ({} as Screen);

  const signals: Array<string | number> = [
    safeGet(() => nav.userAgent, ""),
    safeGet(() => nav.language, ""),
    safeGet(() => (nav.languages || []).join(","), ""),
    safeGet(() => nav.platform, ""),
    safeGet(() => nav.hardwareConcurrency ?? 0, 0),
    // deviceMemory есть не во всех браузерах
    safeGet(() => (nav as Navigator & { deviceMemory?: number }).deviceMemory ?? 0, 0),
    safeGet(() => nav.maxTouchPoints ?? 0, 0),
    safeGet(() => scr.width ?? 0, 0),
    safeGet(() => scr.height ?? 0, 0),
    safeGet(() => scr.colorDepth ?? 0, 0),
    safeGet(() => (scr as Screen & { pixelDepth?: number }).pixelDepth ?? 0, 0),
    safeGet(() => window.devicePixelRatio ?? 0, 0),
    safeGet(() => Intl.DateTimeFormat().resolvedOptions().timeZone, ""),
    safeGet(() => new Date().getTimezoneOffset(), 0),
    collectCanvasHash(),
  ];

  return signals.join("|");
}

/** Небольшой canvas-рендер: разные GPU/шрифты дают разный результат. */
function collectCanvasHash(): string {
  return safeGet(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 240;
    canvas.height = 60;
    const ctx = canvas.getContext("2d");
    if (!ctx) return "no-canvas";

    ctx.textBaseline = "top";
    ctx.font = "16px 'Arial'";
    ctx.fillStyle = "#f60";
    ctx.fillRect(0, 0, 120, 30);
    ctx.fillStyle = "#069";
    ctx.fillText("eFootball Nexon \u{1F3AE}", 4, 8);
    ctx.fillStyle = "rgba(102, 204, 0, 0.7)";
    ctx.fillText("device-fp", 8, 24);

    return canvas.toDataURL();
  }, "no-canvas");
}

async function sha256Hex(input: string): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) return "";

  const data = new TextEncoder().encode(input);
  const digest = await subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Возвращает hex-строку SHA-256 отпечатка устройства.
 * При любой ошибке / недоступности API возвращает "" — вход не должен ломаться.
 * Результат кэшируется в sessionStorage на время сессии вкладки.
 */
export async function getDeviceFingerprint(): Promise<string> {
  if (typeof window === "undefined") return "";

  const cached = safeGet(() => window.sessionStorage.getItem(STORAGE_KEY), null);
  if (cached) return cached;

  try {
    const fingerprint = await sha256Hex(collectSignals());
    if (fingerprint) {
      safeGet(() => window.sessionStorage.setItem(STORAGE_KEY, fingerprint), undefined);
    }
    return fingerprint;
  } catch {
    return "";
  }
}
