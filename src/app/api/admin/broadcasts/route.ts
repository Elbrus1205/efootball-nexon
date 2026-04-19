import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { requireRole } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { logAdminAction } from "@/lib/services/admin-actions";
import { sendTelegramMedia, sendTelegramMessage, type TelegramMediaType } from "@/lib/telegram-bot";

export const runtime = "nodejs";

const mediaTypes = new Set<TelegramMediaType>(["photo", "video", "document", "animation", "audio"]);
const textChunkLimit = 3900;
const mediaCaptionLimit = 1000;
const sendConcurrency = 4;

function redirectToBroadcasts(request: Request, params: Record<string, string | number>) {
  const url = new URL("/admin/broadcasts", request.url);

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, String(value));
  }

  return NextResponse.redirect(url, 303);
}

function getString(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function getUploadedFile(value: FormDataEntryValue | null) {
  if (typeof File === "undefined" || !(value instanceof File) || value.size === 0) {
    return null;
  }

  return value;
}

function splitTelegramText(text: string, limit = textChunkLimit) {
  const chunks: string[] = [];
  let rest = text.trim();

  while (rest.length > limit) {
    const newlineIndex = rest.lastIndexOf("\n", limit);
    const spaceIndex = rest.lastIndexOf(" ", limit);
    const splitAt = newlineIndex > limit * 0.6 ? newlineIndex : spaceIndex > limit * 0.6 ? spaceIndex : limit;

    chunks.push(rest.slice(0, splitAt).trim());
    rest = rest.slice(splitAt).trim();
  }

  if (rest) {
    chunks.push(rest);
  }

  return chunks;
}

async function runWithConcurrency<T, R>(items: T[], limit: number, task: (item: T) => Promise<R>) {
  const results: R[] = [];
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await task(items[currentIndex]);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

async function sendBroadcastToChat(params: {
  chatId: string;
  text: string;
  mediaType: "text" | TelegramMediaType;
  mediaUrl: string;
  mediaFile: File | null;
}) {
  if (params.mediaType === "text") {
    for (const chunk of splitTelegramText(params.text)) {
      await sendTelegramMessage({
        chatId: params.chatId,
        text: chunk,
        parseMode: null,
      });
    }

    return;
  }

  const shouldUseCaption = params.text.length > 0 && params.text.length <= mediaCaptionLimit;

  await sendTelegramMedia({
    chatId: params.chatId,
    type: params.mediaType,
    mediaUrl: params.mediaUrl || undefined,
    mediaFile: params.mediaFile ?? undefined,
    caption: shouldUseCaption ? params.text : undefined,
    parseMode: null,
  });

  if (!shouldUseCaption && params.text) {
    for (const chunk of splitTelegramText(params.text)) {
      await sendTelegramMessage({
        chatId: params.chatId,
        text: chunk,
        parseMode: null,
      });
    }
  }
}

export async function POST(request: Request) {
  const session = await requireRole([UserRole.ADMIN]);

  if (!process.env.TELEGRAM_BOT_TOKEN) {
    return redirectToBroadcasts(request, { error: "TELEGRAM_BOT_TOKEN не настроен. Рассылка в Telegram недоступна." });
  }

  const formData = await request.formData();

  if (getString(formData.get("confirm")) !== "on") {
    return redirectToBroadcasts(request, { error: "Подтвердите отправку рассылки всем получателям." });
  }

  const text = getString(formData.get("text"));
  const rawMediaType = getString(formData.get("mediaType"));
  const mediaType: "text" | TelegramMediaType = mediaTypes.has(rawMediaType as TelegramMediaType)
    ? (rawMediaType as TelegramMediaType)
    : "text";
  const mediaUrl = getString(formData.get("mediaUrl"));
  const mediaFile = getUploadedFile(formData.get("mediaFile"));

  if (mediaType === "text" && !text) {
    return redirectToBroadcasts(request, { error: "Введите текст рассылки." });
  }

  if (mediaType !== "text" && !mediaUrl && !mediaFile) {
    return redirectToBroadcasts(request, { error: "Для медиа-рассылки прикрепите файл или укажите ссылку." });
  }

  const recipients = await db.user.findMany({
    where: {
      telegramId: { not: null },
    },
    select: {
      id: true,
      telegramId: true,
      telegramUsername: true,
    },
  });

  if (!recipients.length) {
    return redirectToBroadcasts(request, { error: "Нет пользователей с привязанным Telegram." });
  }

  const results = await runWithConcurrency(recipients, sendConcurrency, async (recipient) => {
    try {
      await sendBroadcastToChat({
        chatId: recipient.telegramId!,
        text,
        mediaType,
        mediaUrl,
        mediaFile,
      });

      return { ok: true as const, userId: recipient.id };
    } catch (error) {
      return {
        ok: false as const,
        userId: recipient.id,
        telegramUsername: recipient.telegramUsername,
        error: error instanceof Error ? error.message : "Unknown Telegram error",
      };
    }
  });

  const sent = results.filter((result) => result.ok).length;
  const failed = results.filter((result) => !result.ok);

  await logAdminAction({
    adminId: session.user.id,
    entityType: "TELEGRAM_BROADCAST",
    entityId: new Date().toISOString(),
    actionType: "PUBLISH",
    afterJson: {
      mediaType,
      textLength: text.length,
      hasMediaFile: Boolean(mediaFile),
      mediaUrl: mediaUrl || null,
      recipients: recipients.length,
      sent,
      failed: failed.length,
      failures: failed.slice(0, 10),
    },
  });

  return redirectToBroadcasts(request, {
    sent,
    failed: failed.length,
  });
}
