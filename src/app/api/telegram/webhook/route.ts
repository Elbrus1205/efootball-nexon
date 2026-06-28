import { NextRequest, NextResponse } from "next/server";
import { getConfiguredSiteBaseUrl } from "@/lib/affiliate";
import { db } from "@/lib/db";
import { getTelegramWebhookSecret, isTelegramRecipientUnavailableError, sendTelegramMessage } from "@/lib/telegram-bot";
import { tgEmoji } from "@/lib/telegram-emoji";
import { buildTelegramInlineKeyboard } from "@/lib/telegram-format";

export const runtime = "nodejs";

type TelegramWebhookUser = {
  id?: number | string;
  username?: string;
  first_name?: string;
};

type TelegramWebhookMessage = {
  from?: TelegramWebhookUser;
  chat?: { id?: number | string };
  text?: string;
};

type TelegramWebhookUpdate = {
  message?: TelegramWebhookMessage;
  edited_message?: TelegramWebhookMessage;
  callback_query?: { from?: TelegramWebhookUser };
};

function normalizeTelegramUsername(value?: string | null) {
  const username = value?.trim().replace(/^@/, "");
  return username && /^[A-Za-z0-9_]{5,32}$/.test(username) ? username : null;
}

function escapeTelegramHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

async function syncTelegramUsernameFromWebhook(update: TelegramWebhookUpdate) {
  const from = update.message?.from ?? update.edited_message?.from ?? update.callback_query?.from;
  const telegramId = from?.id === undefined || from.id === null ? null : String(from.id).trim();
  if (!telegramId || !/^\d+$/.test(telegramId)) return;

  await db.user.updateMany({
    where: { telegramId },
    data: { telegramUsername: normalizeTelegramUsername(from?.username) },
  });
}

function buildWelcomeMessage(params: { firstName: string | null; linked: boolean }) {
  const greetingName = params.firstName ? `, ${escapeTelegramHtml(params.firstName)}` : "";

  const lines = [
    `${tgEmoji("gamepad")} <b>eFootball Nexon</b>`,
    `${tgEmoji("party")} <b>Добро пожаловать${greetingName}!</b>`,
    `<blockquote>Это официальный бот киберспортивной платформы eFootball Nexon — турниры, матчи, рейтинги и достижения в одном месте.</blockquote>`,
    "",
    `${tgEmoji("bell")} <b>Сюда будут приходить:</b>`,
    `${tgEmoji("crown")} приглашения и старты турниров`,
    `${tgEmoji("fire")} назначения и напоминания о матчах`,
    `${tgEmoji("chart")} подтверждённые результаты и изменения рейтинга`,
    `${tgEmoji("lock")} коды входа и оповещения безопасности`,
  ];

  if (params.linked) {
    lines.push(
      "",
      `${tgEmoji("check")} <b>Telegram привязан к вашему аккаунту.</b> Уведомления уже включены.`,
    );
  } else {
    lines.push(
      "",
      `${tgEmoji("link")} <b>Аккаунт ещё не привязан.</b> Войдите на сайте через Telegram, чтобы получать уведомления здесь.`,
    );
  }

  return lines.join("\n");
}

async function handleStartCommand(message: TelegramWebhookMessage) {
  if (!process.env.TELEGRAM_BOT_TOKEN) return;

  const text = message.text?.trim() ?? "";
  if (!/^\/start(?:@[A-Za-z0-9_]+)?(?:\s|$)/i.test(text)) return;

  const chatId = message.chat?.id ?? message.from?.id;
  const normalizedChatId = chatId === undefined || chatId === null ? null : String(chatId).trim();
  if (!normalizedChatId || !/^\d+$/.test(normalizedChatId)) return;

  const linkedUser = await db.user.findFirst({
    where: { telegramId: normalizedChatId },
    select: { id: true },
  });

  const baseUrl = getConfiguredSiteBaseUrl();

  await sendTelegramMessage({
    chatId: normalizedChatId,
    text: buildWelcomeMessage({
      firstName: message.from?.first_name?.trim() || null,
      linked: Boolean(linkedUser),
    }),
    disableWebPagePreview: true,
    replyMarkup: baseUrl
      ? buildTelegramInlineKeyboard([
          { text: "🎮 Открыть платформу", url: baseUrl, row: 1 },
          { text: "🏆 Турниры", url: new URL("/tournaments", baseUrl).toString(), row: 2 },
          { text: "📊 Рейтинги", url: new URL("/ratings", baseUrl).toString(), row: 2 },
        ])
      : undefined,
  }).catch((error) => {
    if (isTelegramRecipientUnavailableError(error)) return;
    console.error("Failed to send Telegram welcome message", error);
  });
}

export async function POST(request: NextRequest) {
  let webhookSecret: string;
  try {
    webhookSecret = getTelegramWebhookSecret();
  } catch {
    return NextResponse.json({ ok: false, error: "Webhook secret is not configured." }, { status: 500 });
  }

  if (request.headers.get("x-telegram-bot-api-secret-token") !== webhookSecret) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const update = (await request.json().catch(() => null)) as TelegramWebhookUpdate | null;
  if (update) {
    await syncTelegramUsernameFromWebhook(update);
    if (update.message) {
      await handleStartCommand(update.message);
    }
  }

  return NextResponse.json({ ok: true });
}
