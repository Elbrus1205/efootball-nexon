export type TelegramInlineKeyboardMarkup = {
  inline_keyboard: Array<Array<{ text: string; url: string }>>;
};

function getTelegramBotToken() {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token) {
    throw new Error("Telegram bot token is not configured");
  }

  return token;
}

function normalizeTelegramUsername(value?: string | null) {
  return value?.trim().replace(/^@/, "") || null;
}

async function callTelegramApi<T>(method: string, init?: RequestInit) {
  const botToken = getTelegramBotToken();
  const response = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, init);
  const payload = (await response.json().catch(() => null)) as { ok?: boolean; result?: T; description?: string } | null;

  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.description || `Telegram API ${method} failed`);
  }

  return payload.result as T;
}

export function getTelegramBotIdFromToken() {
  return getTelegramBotToken().split(":")[0] ?? "";
}

export async function getTelegramBotIdentity() {
  const configuredUsername = normalizeTelegramUsername(
    process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME ?? process.env.TELEGRAM_BOT_USERNAME,
  );

  if (configuredUsername) {
    return {
      id: getTelegramBotIdFromToken(),
      username: configuredUsername,
    };
  }

  const me = await callTelegramApi<{ id: number; username?: string }>("getMe", {
    cache: "no-store",
  });

  const username = normalizeTelegramUsername(me.username);
  if (!username) {
    throw new Error("Telegram bot username is not available");
  }

  return {
    id: String(me.id),
    username,
  };
}

export async function ensureTelegramWebhook(baseUrl: string) {
  const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
  if (!webhookSecret) {
    throw new Error("Telegram webhook secret is not configured");
  }

  const normalizedBaseUrl = baseUrl.replace(/\/$/, "");
  if (!/^https:\/\//i.test(normalizedBaseUrl)) {
    return {
      ok: false,
      skipped: true,
      webhookUrl: `${normalizedBaseUrl}/api/telegram/webhook`,
      reason: "non-https-base-url",
    } as const;
  }

  const webhookUrl = `${normalizedBaseUrl}/api/telegram/webhook`;
  const current = await callTelegramApi<{
    url?: string;
    pending_update_count?: number;
    last_error_date?: number;
    last_error_message?: string;
  }>("getWebhookInfo", {
    cache: "no-store",
  });

  const needsReset = current.url !== webhookUrl || Boolean(current.last_error_message);

  if (!needsReset) {
    return {
      ok: true,
      skipped: false,
      webhookUrl,
      action: "already-configured",
    } as const;
  }

  await callTelegramApi("setWebhook", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      url: webhookUrl,
      secret_token: webhookSecret,
      allowed_updates: ["message"],
      drop_pending_updates: false,
    }),
  });

  return {
    ok: true,
    skipped: false,
    webhookUrl,
    action: "updated",
  } as const;
}

export async function sendTelegramMessage(params: {
  chatId: string;
  text: string;
  parseMode?: "HTML" | "MarkdownV2" | null;
  disableWebPagePreview?: boolean;
  replyMarkup?: TelegramInlineKeyboardMarkup;
}) {
  const botToken = getTelegramBotToken();
  const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      chat_id: params.chatId,
      text: params.text,
      ...(params.parseMode === null ? {} : { parse_mode: params.parseMode ?? "HTML" }),
      disable_web_page_preview: params.disableWebPagePreview ?? true,
      ...(params.replyMarkup ? { reply_markup: params.replyMarkup } : {}),
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || "Failed to send Telegram message");
  }
}

export type TelegramMediaType = "photo" | "video" | "document" | "animation" | "audio";

const mediaConfig: Record<TelegramMediaType, { method: string; field: string }> = {
  photo: { method: "sendPhoto", field: "photo" },
  video: { method: "sendVideo", field: "video" },
  document: { method: "sendDocument", field: "document" },
  animation: { method: "sendAnimation", field: "animation" },
  audio: { method: "sendAudio", field: "audio" },
};

export async function sendTelegramMedia(params: {
  chatId: string;
  type: TelegramMediaType;
  mediaUrl?: string;
  mediaFile?: File;
  caption?: string;
  parseMode?: "HTML" | "MarkdownV2" | null;
  replyMarkup?: TelegramInlineKeyboardMarkup;
}) {
  const botToken = getTelegramBotToken();
  const config = mediaConfig[params.type];
  const body = new FormData();
  body.set("chat_id", params.chatId);

  if (params.mediaFile) {
    body.set(config.field, params.mediaFile, params.mediaFile.name || "broadcast");
  } else if (params.mediaUrl) {
    body.set(config.field, params.mediaUrl);
  } else {
    throw new Error("Telegram media is missing");
  }

  if (params.caption) {
    body.set("caption", params.caption);
  }

  if (params.parseMode) {
    body.set("parse_mode", params.parseMode);
  }

  if (params.replyMarkup) {
    body.set("reply_markup", JSON.stringify(params.replyMarkup));
  }

  const res = await fetch(`https://api.telegram.org/bot${botToken}/${config.method}`, {
    method: "POST",
    body,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || "Failed to send Telegram media");
  }
}
