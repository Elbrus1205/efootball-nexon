export type TelegramWidgetUser = {
  id?: number | string;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date?: number | string;
  hash?: string;
};

type TelegramWidgetMountOptions = {
  botUsername: string;
  onAuth(user: TelegramWidgetUser): void;
  onLoad?(): void;
  onError?(): void;
  size?: "large" | "medium" | "small";
  radius?: number;
  requestAccess?: "write";
  lang?: string;
  showUserPic?: boolean;
};

const TELEGRAM_WIDGET_SCRIPT_URL = "https://telegram.org/js/telegram-widget.js?22";

export function normalizeTelegramBotUsername(value?: string | null) {
  if (!value) return "";

  return value
    .trim()
    .replace(/^https?:\/\/t\.me\//i, "")
    .replace(/^@/, "")
    .replace(/\/$/, "");
}

export function hasTelegramAuthPayload(
  user: TelegramWidgetUser | false | null | undefined,
): user is TelegramWidgetUser & Required<Pick<TelegramWidgetUser, "id" | "auth_date" | "hash">> {
  return typeof user === "object" && user !== null && Boolean(user.id && user.auth_date && user.hash);
}

export function mountTelegramLoginWidget(container: HTMLDivElement, options: TelegramWidgetMountOptions) {
  const botUsername = normalizeTelegramBotUsername(options.botUsername);
  if (!botUsername) {
    container.innerHTML = "";
    return () => undefined;
  }

  const callbackName = `telegramAuth_${Math.random().toString(36).slice(2)}`;
  const callbackHost = window as unknown as Record<string, unknown>;

  callbackHost[callbackName] = (user: TelegramWidgetUser) => {
    options.onAuth(user);
  };

  container.innerHTML = "";

  const script = document.createElement("script");
  script.src = TELEGRAM_WIDGET_SCRIPT_URL;
  script.async = true;
  script.setAttribute("data-telegram-login", botUsername);
  script.setAttribute("data-size", options.size ?? "large");
  script.setAttribute("data-radius", String(options.radius ?? 12));
  script.setAttribute("data-userpic", options.showUserPic ? "true" : "false");
  script.setAttribute("data-lang", options.lang ?? "ru");
  script.setAttribute("data-onauth", `${callbackName}(user)`);

  if (options.requestAccess) {
    script.setAttribute("data-request-access", options.requestAccess);
  }

  if (options.onLoad) {
    script.addEventListener("load", options.onLoad, { once: true });
  }

  if (options.onError) {
    script.addEventListener("error", options.onError, { once: true });
  }

  container.appendChild(script);

  return () => {
    delete callbackHost[callbackName];
    container.innerHTML = "";
  };
}
