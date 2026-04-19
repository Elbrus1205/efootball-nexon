export async function sendTelegramMessage(params: {
  chatId: string;
  text: string;
  parseMode?: "HTML" | "MarkdownV2" | null;
  disableWebPagePreview?: boolean;
}) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;

  if (!botToken) {
    throw new Error("Telegram bot token is not configured");
  }

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
}) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;

  if (!botToken) {
    throw new Error("Telegram bot token is not configured");
  }

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

  const res = await fetch(`https://api.telegram.org/bot${botToken}/${config.method}`, {
    method: "POST",
    body,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || "Failed to send Telegram media");
  }
}
