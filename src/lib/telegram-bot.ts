import crypto from "crypto";
import {
  toTelegramInputRichMessage,
  type TelegramRichMessageDraft,
} from "@/lib/telegram-rich";

export type TelegramInlineKeyboardMarkup = {
  inline_keyboard: Array<Array<{
    text: string;
    url?: string;
    callback_data?: string;
    web_app?: { url: string };
    icon_custom_emoji_id?: string;
  }>>;
};

export type TelegramSentMessage = {
  message_id?: number;
  ephemeral_message_id?: number;
  chat?: { id?: number | string };
};

type TelegramErrorPayload = {
  ok?: boolean;
  error_code?: number;
  description?: string;
  parameters?: {
    retry_after?: number;
  };
};

export class TelegramApiError extends Error {
  readonly status: number;
  readonly errorCode?: number;
  readonly description?: string;
  readonly retryAfterSeconds?: number;

  constructor(message: string, params: {
    status: number;
    errorCode?: number;
    description?: string;
    retryAfterSeconds?: number;
  }) {
    super(message);
    this.name = "TelegramApiError";
    this.status = params.status;
    this.errorCode = params.errorCode;
    this.description = params.description;
    this.retryAfterSeconds = params.retryAfterSeconds;
  }
}

function getTelegramBotToken() {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token) {
    throw new Error("Telegram bot token is not configured");
  }

  return token;
}

export function normalizeTelegramUsername(value?: string | null) {
  return value?.trim().replace(/^@/, "") || null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

async function readTelegramError(response: Response, fallback: string) {
  const text = await response.text().catch(() => "");
  let payload: TelegramErrorPayload | null = null;

  if (text) {
    try {
      const parsed = JSON.parse(text) as unknown;
      if (isRecord(parsed)) {
        payload = {
          ok: typeof parsed.ok === "boolean" ? parsed.ok : undefined,
          error_code: typeof parsed.error_code === "number" ? parsed.error_code : undefined,
          description: typeof parsed.description === "string" ? parsed.description : undefined,
          parameters: isRecord(parsed.parameters) && typeof parsed.parameters.retry_after === "number"
            ? { retry_after: parsed.parameters.retry_after }
            : undefined,
        };
      }
    } catch {
      // Telegram normally returns JSON errors; keep the raw text as the fallback message.
    }
  }

  const description = payload?.description || text || fallback;
  return new TelegramApiError(description, {
    status: response.status,
    errorCode: payload?.error_code,
    description,
    retryAfterSeconds: payload?.parameters?.retry_after,
  });
}

export function getTelegramRetryAfterMs(error: unknown) {
  if (!(error instanceof TelegramApiError) || error.retryAfterSeconds === undefined) {
    return undefined;
  }

  return Math.max(0, error.retryAfterSeconds * 1_000);
}

export function isTelegramRecipientUnavailableError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  const description = error instanceof TelegramApiError ? error.description ?? error.message : error.message;
  const normalized = description.toLowerCase();

  return (
    normalized.includes("chat not found") ||
    normalized.includes("bot was blocked by the user") ||
    normalized.includes("user is deactivated")
  );
}

export function isTelegramRichMessageUnsupportedError(error: unknown) {
  if (!(error instanceof Error)) return false;
  const description = error instanceof TelegramApiError ? error.description ?? error.message : error.message;
  const normalized = description.toLowerCase();
  return (
    normalized.includes("method not found") ||
    normalized.includes("sendrichmessage") ||
    normalized.includes("rich message") && (
      normalized.includes("unsupported") ||
      normalized.includes("not supported") ||
      normalized.includes("can't parse")
    )
  );
}

async function callTelegramApi<T>(method: string, init?: RequestInit) {
  const botToken = getTelegramBotToken();
  const response = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
    ...init,
    signal: init?.signal ?? AbortSignal.timeout(8_000),
  });
  const payload = (await response.json().catch(() => null)) as {
    ok?: boolean;
    result?: T;
    description?: string;
    parameters?: { retry_after?: number };
  } | null;

  if (!response.ok || !payload?.ok) {
    throw new TelegramApiError(payload?.description || `Telegram API ${method} failed`, {
      status: response.status,
      description: payload?.description,
      retryAfterSeconds: payload?.parameters?.retry_after,
    });
  }

  return payload.result as T;
}

export function getTelegramBotIdFromToken() {
  return getTelegramBotToken().split(":")[0] ?? "";
}

export function getConfiguredTelegramBotUsername() {
  const username = normalizeTelegramUsername(
    process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME ?? process.env.TELEGRAM_BOT_USERNAME,
  );

  return username;
}

export function getConfiguredTelegramBotIdentity() {
  const username = getConfiguredTelegramBotUsername();
  const id = process.env.NEXT_PUBLIC_TELEGRAM_BOT_ID?.trim() || getTelegramBotIdFromToken();

  if (!username) {
    return null;
  }

  return {
    id,
    username,
  };
}

export async function getTelegramBotIdentity() {
  const configured = getConfiguredTelegramBotIdentity();

  if (configured) {
    return configured;
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

// Real liveness probe: always calls getMe (bypassing cached config identity).
// Returns false when the token is missing or the Bot API is unreachable/erroring.
export async function checkTelegramBotOnline() {
  if (!process.env.TELEGRAM_BOT_TOKEN?.trim()) return false;
  try {
    await callTelegramApi<{ id: number }>("getMe", { cache: "no-store" });
    return true;
  } catch {
    return false;
  }
}

export type TelegramChatProfile = {
  id: number | string;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
};

/**
 * Reads the current Telegram chat profile (used to detect username changes).
 * The chat id must be the private chat id, which equals the user's telegramId.
 */
export async function getTelegramChat(chatId: string): Promise<TelegramChatProfile> {
  const chat = await callTelegramApi<{
    id: number | string;
    username?: string;
    first_name?: string;
    last_name?: string;
  }>(`getChat?chat_id=${encodeURIComponent(chatId)}`, {
    cache: "no-store",
  });

  return {
    id: chat.id,
    username: normalizeTelegramUsername(chat.username),
    firstName: chat.first_name?.trim() || null,
    lastName: chat.last_name?.trim() || null,
  };
}

export async function ensureTelegramWebhook(baseUrl: string) {
  const webhookSecret = getTelegramWebhookSecret();

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
    allowed_updates?: string[];
  }>("getWebhookInfo", {
    cache: "no-store",
  });

  const requiredUpdates = ["message", "edited_message", "channel_post", "edited_channel_post", "callback_query"];
  const hasRequiredUpdates = requiredUpdates.every((update) => current.allowed_updates?.includes(update));
  const needsReset = current.url !== webhookUrl || Boolean(current.last_error_message) || !hasRequiredUpdates;

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
      allowed_updates: requiredUpdates,
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

export function getTelegramWebhookSecret() {
  const explicitSecret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
  if (explicitSecret) {
    return explicitSecret;
  }

  const nextAuthSecret = process.env.NEXTAUTH_SECRET?.trim();
  if (!nextAuthSecret) {
    throw new Error("NEXTAUTH_SECRET is not configured");
  }

  return crypto.createHash("sha256").update(`${nextAuthSecret}:telegram-webhook`).digest("hex");
}

export type SendTelegramMessageParams = {
  chatId: string;
  text: string;
  parseMode?: "HTML" | "MarkdownV2" | null;
  disableWebPagePreview?: boolean;
  replyMarkup?: TelegramInlineKeyboardMarkup;
  replyParameters?: {
    messageId: number | string;
    allowSendingWithoutReply?: boolean;
  };
  messageThreadId?: number | string;
};

export async function sendTelegramMessage(params: SendTelegramMessageParams): Promise<TelegramSentMessage> {
  const botToken = getTelegramBotToken();
  const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    signal: AbortSignal.timeout(8_000),
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      chat_id: params.chatId,
      text: params.text,
      ...(params.parseMode === null ? {} : { parse_mode: params.parseMode ?? "HTML" }),
      disable_web_page_preview: params.disableWebPagePreview ?? true,
      ...(params.replyMarkup ? { reply_markup: params.replyMarkup } : {}),
      ...(params.replyParameters
        ? {
            reply_parameters: {
              message_id: Number(params.replyParameters.messageId),
              ...(params.replyParameters.allowSendingWithoutReply ? { allow_sending_without_reply: true } : {}),
            },
          }
        : {}),
      ...(params.messageThreadId !== undefined ? { message_thread_id: Number(params.messageThreadId) } : {}),
    }),
  });

  const payload = (await res.json().catch(() => null)) as {
    ok?: boolean;
    result?: TelegramSentMessage;
    description?: string;
    error_code?: number;
    parameters?: { retry_after?: number };
  } | null;

  if (!res.ok || !payload?.ok) {
    const description = payload?.description || "Failed to send Telegram message";
    throw new TelegramApiError(description, {
      status: res.status,
      errorCode: payload?.error_code,
      description,
      retryAfterSeconds: payload?.parameters?.retry_after,
    });
  }

  return payload.result ?? {};
}

/**
 * Sends a prepared draft as a regular HTML message.
 *
 * Rich-message blocks are intentionally ignored here: ordinary Telegram
 * messages support custom emoji, render consistently in every client and keep
 * inline buttons available.
 */
export async function sendTelegramDraftAsText(params: {
  chatId: string;
  message: TelegramRichMessageDraft;
  replyMarkup?: TelegramInlineKeyboardMarkup;
}) {
  return sendTelegramMessage({
    chatId: params.chatId,
    text: params.message.fallbackText,
    replyMarkup: params.replyMarkup,
    disableWebPagePreview: true,
  });
}

/** Updates a previously sent regular HTML message from a prepared draft. */
export async function editTelegramDraftAsText(params: {
  chatId: string;
  messageId: string;
  message: TelegramRichMessageDraft;
  replyMarkup?: TelegramInlineKeyboardMarkup;
}) {
  return callTelegramApi<TelegramSentMessage | true>("editMessageText", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: params.chatId,
      message_id: Number(params.messageId),
      text: params.message.fallbackText,
      parse_mode: "HTML",
      disable_web_page_preview: true,
      ...(params.replyMarkup ? { reply_markup: params.replyMarkup } : {}),
    }),
  });
}

/**
 * Acknowledges a callback query. Telegram shows a spinner on the tapped button
 * until this is called; `text` optionally surfaces a toast/alert to the user.
 */
export async function answerTelegramCallbackQuery(params: {
  callbackQueryId: string;
  text?: string;
  showAlert?: boolean;
}) {
  return callTelegramApi<true>("answerCallbackQuery", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      callback_query_id: params.callbackQueryId,
      ...(params.text ? { text: params.text.slice(0, 200) } : {}),
      ...(params.showAlert ? { show_alert: true } : {}),
    }),
  });
}

/**
 * Replaces (or clears) the inline keyboard on an existing message. Used after a
 * callback action resolves so the same button can't be tapped again.
 */
export async function editTelegramMessageReplyMarkup(params: {
  chatId: string;
  messageId: string;
  replyMarkup?: TelegramInlineKeyboardMarkup;
}) {
  return callTelegramApi<TelegramSentMessage | true>("editMessageReplyMarkup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: params.chatId,
      message_id: Number(params.messageId),
      reply_markup: params.replyMarkup ?? { inline_keyboard: [] },
    }),
  });
}

export async function sendTelegramRichMessage(params: {
  chatId: string;
  message: TelegramRichMessageDraft;
  replyMarkup?: TelegramInlineKeyboardMarkup;
  receiverUserId?: string;
  callbackQueryId?: string;
  disableNotification?: boolean;
}) {
  return callTelegramApi<TelegramSentMessage>("sendRichMessage", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: params.chatId,
      rich_message: toTelegramInputRichMessage(params.message),
      ...(params.replyMarkup ? { reply_markup: params.replyMarkup } : {}),
      ...(params.receiverUserId ? { receiver_user_id: params.receiverUserId } : {}),
      ...(params.callbackQueryId ? { callback_query_id: params.callbackQueryId } : {}),
      ...(params.disableNotification ? { disable_notification: true } : {}),
    }),
  });
}

export async function editTelegramRichMessage(params: {
  chatId: string;
  messageId: string;
  message: TelegramRichMessageDraft;
  replyMarkup?: TelegramInlineKeyboardMarkup;
}) {
  return callTelegramApi<TelegramSentMessage | true>("editMessageText", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: params.chatId,
      message_id: Number(params.messageId),
      rich_message: toTelegramInputRichMessage(params.message),
      ...(params.replyMarkup ? { reply_markup: params.replyMarkup } : {}),
    }),
  });
}

export async function editTelegramRichMessageWithFallback(params: {
  chatId: string;
  messageId: string;
  message: TelegramRichMessageDraft;
  replyMarkup?: TelegramInlineKeyboardMarkup;
}) {
  try {
    return await editTelegramRichMessage(params);
  } catch (error) {
    if (!isTelegramRichMessageUnsupportedError(error)) throw error;
    return callTelegramApi<TelegramSentMessage | true>("editMessageText", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: params.chatId,
        message_id: Number(params.messageId),
        text: params.message.fallbackText,
        parse_mode: "HTML",
        disable_web_page_preview: true,
        ...(params.replyMarkup ? { reply_markup: params.replyMarkup } : {}),
      }),
    });
  }
}

export async function sendTelegramRichMessageWithFallback(params: {
  chatId: string;
  message: TelegramRichMessageDraft;
  replyMarkup?: TelegramInlineKeyboardMarkup;
  receiverUserId?: string;
  callbackQueryId?: string;
}) {
  try {
    return await sendTelegramRichMessage(params);
  } catch (error) {
    if (params.receiverUserId || !isTelegramRichMessageUnsupportedError(error)) throw error;
    return sendTelegramMessage({
      chatId: params.chatId,
      text: params.message.fallbackText,
      replyMarkup: params.replyMarkup,
      disableWebPagePreview: true,
    });
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
    signal: AbortSignal.timeout(8_000),
    body,
  });

  if (!res.ok) {
    throw await readTelegramError(res, "Failed to send Telegram media");
  }
}
