import { NextResponse } from "next/server";
import { getRequestBaseUrl } from "@/lib/affiliate";
import { requirePermission } from "@/lib/auth/session";
import { logAdminAction } from "@/lib/services/admin-actions";
import {
  buildTelegramInlineKeyboard,
  getTelegramRenderedTextLength,
  hasTelegramHtmlFormatting,
  parseTelegramButtonsJson,
  sanitizeTelegramHtml,
  TELEGRAM_CAPTION_LIMIT,
  TELEGRAM_TEXT_LIMIT,
  validateTelegramHtmlStructure,
} from "@/lib/telegram-format";
import {
  sendTelegramDraftAsText,
  sendTelegramMedia,
  sendTelegramMessage,
  type TelegramInlineKeyboardMarkup,
  type TelegramMediaType,
} from "@/lib/telegram-bot";
import type { TelegramAudienceScope } from "@/lib/telegram-publications";
import type { TelegramRichMessageDraft } from "@/lib/telegram-rich";
import { getTelegramBroadcastRecipients } from "@/lib/services/telegram-audiences";
import { buildTournamentAnnouncementDraft, buildTournamentBulletin } from "@/lib/services/telegram-publications";

export const runtime = "nodejs";

const mediaTypes = new Set<TelegramMediaType>(["photo", "video", "document", "animation", "audio"]);
const textChunkLimit = 3900;
const sendConcurrency = 4;
const audienceScopes = new Set<TelegramAudienceScope>(["all", "participants", "group", "applicants", "unresolved"]);

function redirectToBroadcasts(request: Request, params: Record<string, string | number>) {
  const url = new URL("/admin/broadcasts", getRequestBaseUrl(request));

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
  formattedText: string;
  useHtml: boolean;
  mediaType: "text" | TelegramMediaType;
  mediaUrl: string;
  mediaFile: File | null;
  richMessage?: TelegramRichMessageDraft | null;
  replyMarkup?: TelegramInlineKeyboardMarkup;
}) {
  if (params.richMessage) {
    await sendTelegramDraftAsText({
      chatId: params.chatId,
      message: params.richMessage,
      replyMarkup: params.replyMarkup,
    });
    return;
  }

  if (params.mediaType === "text") {
    if (params.useHtml || params.replyMarkup) {
      await sendTelegramMessage({
        chatId: params.chatId,
        text: params.useHtml ? params.formattedText : params.text,
        parseMode: params.useHtml ? "HTML" : null,
        replyMarkup: params.replyMarkup,
      });
    } else {
      for (const chunk of splitTelegramText(params.text)) {
        await sendTelegramMessage({
          chatId: params.chatId,
          text: chunk,
          parseMode: null,
        });
      }
    }

    return;
  }

  const renderedTextLength = params.useHtml ? getTelegramRenderedTextLength(params.formattedText) : params.text.length;
  const shouldUseCaption = renderedTextLength > 0 && renderedTextLength <= TELEGRAM_CAPTION_LIMIT;

  await sendTelegramMedia({
    chatId: params.chatId,
    type: params.mediaType,
    mediaUrl: params.mediaUrl || undefined,
    mediaFile: params.mediaFile ?? undefined,
    caption: shouldUseCaption ? (params.useHtml ? params.formattedText : params.text) : undefined,
    parseMode: shouldUseCaption && params.useHtml ? "HTML" : null,
    replyMarkup: params.replyMarkup,
  });

  if (!shouldUseCaption && renderedTextLength > 0) {
    if (params.useHtml) {
      await sendTelegramMessage({
        chatId: params.chatId,
        text: params.formattedText,
        parseMode: "HTML",
      });
    } else {
      for (const chunk of splitTelegramText(params.text)) {
        await sendTelegramMessage({
          chatId: params.chatId,
          text: chunk,
          parseMode: null,
        });
      }
    }
  }
}

export async function POST(request: Request) {
  const session = await requirePermission("broadcasts.manage");

  if (!process.env.TELEGRAM_BOT_TOKEN) {
    return redirectToBroadcasts(request, { error: "TELEGRAM_BOT_TOKEN не настроен. Рассылка в Telegram недоступна." });
  }

  const formData = await request.formData();

  if (getString(formData.get("confirm")) !== "on") {
    return redirectToBroadcasts(request, { error: "Подтвердите отправку рассылки всем получателям." });
  }

  const contentSource = getString(formData.get("contentSource")) === "tournament" ? "tournament" : "manual";
  const template = getString(formData.get("template")) === "bulletin" ? "bulletin" : "announcement";
  const tournamentId = getString(formData.get("tournamentId"));
  const groupId = getString(formData.get("groupId"));
  const rawAudience = getString(formData.get("audience")) as TelegramAudienceScope;
  const audience: TelegramAudienceScope = audienceScopes.has(rawAudience) ? rawAudience : "all";
  let text = getString(formData.get("text"));
  let formattedText = sanitizeTelegramHtml(text);
  let renderedTextLength = getTelegramRenderedTextLength(formattedText);
  let useHtml = hasTelegramHtmlFormatting(formattedText);
  let richMessage: TelegramRichMessageDraft | null = null;
  const rawMediaType = getString(formData.get("mediaType"));
  let mediaType: "text" | TelegramMediaType = mediaTypes.has(rawMediaType as TelegramMediaType)
    ? (rawMediaType as TelegramMediaType)
    : "text";
  const mediaUrl = getString(formData.get("mediaUrl"));
  const mediaFile = getUploadedFile(formData.get("mediaFile"));
  let buttons;

  try {
    buttons = parseTelegramButtonsJson(getString(formData.get("buttonsJson")));
  } catch (error) {
    return redirectToBroadcasts(request, {
      error: error instanceof Error ? error.message : "Не удалось обработать кнопки рассылки.",
    });
  }

  if (contentSource === "tournament") {
    if (!tournamentId) {
      return redirectToBroadcasts(request, { error: "Выберите турнир для шаблонной публикации." });
    }
    richMessage = template === "bulletin"
      ? await buildTournamentBulletin(tournamentId)
      : await buildTournamentAnnouncementDraft(tournamentId);
    if (!richMessage) {
      return redirectToBroadcasts(request, { error: "Не удалось собрать Telegram-шаблон выбранного турнира." });
    }
    text = richMessage.fallbackText;
    formattedText = sanitizeTelegramHtml(text);
    renderedTextLength = getTelegramRenderedTextLength(formattedText);
    useHtml = true;
    mediaType = "text";
    buttons = [...(richMessage.buttons ?? []), ...buttons];
  }

  const replyMarkup = buildTelegramInlineKeyboard(buttons);

  if (useHtml) {
    const structureError = validateTelegramHtmlStructure(formattedText);
    if (structureError) {
      return redirectToBroadcasts(request, { error: structureError });
    }
  }

  if (mediaType === "text" && renderedTextLength === 0) {
    return redirectToBroadcasts(request, { error: "Введите текст рассылки." });
  }

  if (mediaType !== "text" && !mediaUrl && !mediaFile) {
    return redirectToBroadcasts(request, { error: "Для медиа-рассылки прикрепите файл или укажите ссылку." });
  }

  if (!richMessage && useHtml && renderedTextLength > TELEGRAM_TEXT_LIMIT) {
    return redirectToBroadcasts(request, {
      error: `Сообщение с Telegram-разметкой должно помещаться в ${TELEGRAM_TEXT_LIMIT} символов после форматирования.`,
    });
  }

  if (!richMessage && mediaType === "text" && buttons.length && renderedTextLength > TELEGRAM_TEXT_LIMIT) {
    return redirectToBroadcasts(request, {
      error: `Текстовая рассылка с кнопками должна помещаться в ${TELEGRAM_TEXT_LIMIT} символов.`,
    });
  }

  let recipients;
  try {
    recipients = await getTelegramBroadcastRecipients({ scope: audience, tournamentId, groupId });
  } catch (error) {
    return redirectToBroadcasts(request, {
      error: error instanceof Error ? error.message : "Не удалось определить аудиторию рассылки.",
    });
  }

  if (!recipients.length) {
    return redirectToBroadcasts(request, { error: "Нет пользователей с привязанным Telegram." });
  }

  const results = await runWithConcurrency(recipients, sendConcurrency, async (recipient) => {
    try {
      await sendBroadcastToChat({
        chatId: recipient.telegramId!,
        text,
        formattedText,
        useHtml,
        mediaType,
        mediaUrl,
        mediaFile,
        richMessage,
        replyMarkup,
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
      contentSource,
      template: contentSource === "tournament" ? template : null,
      audience,
      tournamentId: tournamentId || null,
      groupId: groupId || null,
      textLength: text.length,
      renderedTextLength,
      useHtml,
      buttonsCount: buttons.length,
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
