export type TelegramWidgetUser = {
  id?: number | string;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date?: number | string;
  hash?: string;
};

declare global {
  interface Window {
    Telegram?: {
      Login?: {
        auth?: (
          options: { bot_id: string; request_access?: "write"; lang?: string },
          callback: (user: TelegramWidgetUser | false) => void,
        ) => void;
      };
    };
  }
}

const TELEGRAM_WIDGET_SCRIPT_URL = "/api/telegram/widget";

export function normalizeTelegramBotUsername(value?: string) {
  if (!value) return "";

  return value
    .trim()
    .replace(/^https?:\/\/t\.me\//i, "")
    .replace(/^@/, "")
    .replace(/\/$/, "");
}

export function normalizeTelegramBotId(value?: string) {
  return value?.trim().match(/^\d+$/)?.[0] ?? "";
}

export function loadTelegramWidgetScript() {
  return new Promise<void>((resolve, reject) => {
    if (window.Telegram?.Login?.auth) {
      resolve();
      return;
    }

    const existingScript = document.querySelector<HTMLScriptElement>(
      `script[src="${TELEGRAM_WIDGET_SCRIPT_URL}"], script[src^="https://telegram.org/js/telegram-widget.js"]`,
    );

    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(), { once: true });
      existingScript.addEventListener("error", () => reject(new Error("Telegram widget load failed")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = TELEGRAM_WIDGET_SCRIPT_URL;
    script.async = true;
    script.addEventListener("load", () => resolve(), { once: true });
    script.addEventListener("error", () => reject(new Error("Telegram widget load failed")), { once: true });
    document.head.appendChild(script);
  });
}
