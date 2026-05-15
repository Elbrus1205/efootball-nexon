export type TelegramLoginRequestAccess = "phone" | "write";

export type TelegramLoginSdkUser = {
  id?: number | string;
  name?: string;
  username?: string;
  picture?: string;
  phone_number?: string;
};

export type TelegramLoginSdkResult = {
  id_token?: string;
  user?: TelegramLoginSdkUser;
  error?: string;
};

type TelegramLoginOptions = {
  client_id: number;
  request_access?: TelegramLoginRequestAccess[];
  lang?: string;
  nonce?: string;
};

declare global {
  interface Window {
    Telegram?: {
      Login?: {
        init?: (options: TelegramLoginOptions, callback: (result: TelegramLoginSdkResult) => void) => void;
        open?: (callback?: (result: TelegramLoginSdkResult) => void) => void;
        auth?: (options: TelegramLoginOptions, callback: (result: TelegramLoginSdkResult) => void) => void;
      };
    };
  }
}

const TELEGRAM_LOGIN_SDK_URL = "https://oauth.telegram.org/js/telegram-login.js";
const TELEGRAM_LOGIN_TIMEOUT_MS = 90_000;

let telegramLoginSdkPromise: Promise<void> | null = null;
let telegramLoginSdkLoaded = false;

function normalizeTelegramClientId(value?: string) {
  if (!value) return null;

  const parsedValue = Number(value.trim());
  if (!Number.isFinite(parsedValue)) {
    return null;
  }

  return parsedValue;
}

export function loadTelegramLoginSdk() {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("telegram-sdk-window-unavailable"));
  }

  if (window.Telegram?.Login?.auth || (window.Telegram?.Login?.init && window.Telegram?.Login?.open)) {
    telegramLoginSdkLoaded = true;
    return Promise.resolve();
  }

  if (telegramLoginSdkPromise) {
    return telegramLoginSdkPromise;
  }

  telegramLoginSdkPromise = new Promise<void>((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>(`script[src="${TELEGRAM_LOGIN_SDK_URL}"]`);
    if (existingScript) {
      if (telegramLoginSdkLoaded || existingScript.dataset.loaded === "true") {
        resolve();
        return;
      }

      existingScript.addEventListener(
        "load",
        () => {
          existingScript.dataset.loaded = "true";
          telegramLoginSdkLoaded = true;
          resolve();
        },
        { once: true },
      );
      existingScript.addEventListener("error", () => reject(new Error("telegram-sdk-load-failed")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = TELEGRAM_LOGIN_SDK_URL;
    script.async = true;
    script.onload = () => {
      script.dataset.loaded = "true";
      telegramLoginSdkLoaded = true;
      resolve();
    };
    script.onerror = () => reject(new Error("telegram-sdk-load-failed"));
    document.head.appendChild(script);
  }).catch((error) => {
    telegramLoginSdkPromise = null;
    throw error;
  });

  return telegramLoginSdkPromise;
}

export async function openTelegramLoginPopup({
  clientId,
  lang = "ru",
  requestAccess,
  nonce,
}: {
  clientId: string;
  lang?: string;
  requestAccess?: TelegramLoginRequestAccess[];
  nonce?: string;
}) {
  await loadTelegramLoginSdk();

  const normalizedClientId = normalizeTelegramClientId(clientId);
  if (!normalizedClientId) {
    throw new Error("telegram-client-id-invalid");
  }

  const loginApi = window.Telegram?.Login;
  if (!loginApi?.auth && !(loginApi?.init && loginApi?.open)) {
    throw new Error("telegram-sdk-api-unavailable");
  }

  const options: TelegramLoginOptions = {
    client_id: normalizedClientId,
    lang,
    ...(requestAccess?.length ? { request_access: requestAccess } : {}),
    ...(nonce ? { nonce } : {}),
  };

  return new Promise<TelegramLoginSdkResult>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      reject(new Error("telegram-login-timeout"));
    }, TELEGRAM_LOGIN_TIMEOUT_MS);

    const finish = (result: TelegramLoginSdkResult) => {
      window.clearTimeout(timeout);
      resolve(result ?? { error: "telegram-login-empty-response" });
    };

    try {
      if (loginApi.auth) {
        loginApi.auth(options, finish);
        return;
      }

      loginApi.init?.(options, finish);
      loginApi.open?.(finish);
    } catch (error) {
      window.clearTimeout(timeout);
      reject(error instanceof Error ? error : new Error("telegram-login-open-failed"));
    }
  });
}

export function formatTelegramLoginSdkError(error: unknown) {
  const message = error instanceof Error ? error.message : "telegram-login-unknown-error";

  switch (message) {
    case "telegram-sdk-load-failed":
      return "Не удалось загрузить Telegram Login. Проверьте доступность oauth.telegram.org.";
    case "telegram-sdk-api-unavailable":
      return "Telegram Login сейчас недоступен в браузере. Попробуйте ещё раз.";
    case "telegram-client-id-invalid":
      return "Некорректный TELEGRAM_CLIENT_ID.";
    case "telegram-login-timeout":
      return "Telegram Login не ответил вовремя. Попробуйте ещё раз.";
    case "telegram-login-open-failed":
      return "Не удалось открыть Telegram Login.";
    case "telegram-sdk-window-unavailable":
      return "Telegram Login недоступен вне браузера.";
    default:
      return message;
  }
}
