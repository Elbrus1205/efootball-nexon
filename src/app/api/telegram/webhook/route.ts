import { MatchStatus, TournamentStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { getConfiguredSiteBaseUrl } from "@/lib/affiliate";
import { db } from "@/lib/db";
import {
  answerTelegramCallbackQuery,
  editTelegramMessageReplyMarkup,
  getTelegramWebhookSecret,
  isTelegramRecipientUnavailableError,
  sendTelegramDraftAsText,
  sendTelegramMessage,
  sendTelegramRichMessage,
} from "@/lib/telegram-bot";
import { handleTelegramCallbackAction } from "@/lib/services/telegram-callbacks";
import {
  handleTelegramAutoReply,
  type TelegramAutoReplyMessage,
} from "@/lib/services/telegram-auto-replies";
import { tgEmoji, tgEmojiId } from "@/lib/telegram-emoji";
import { buildTelegramInlineKeyboard } from "@/lib/telegram-format";
import { buildPersonalMatchMessage, type TelegramRichMessageDraft } from "@/lib/telegram-rich";
import { buildTournamentBulletin } from "@/lib/services/telegram-publications";

export const runtime = "nodejs";

type TelegramWebhookUser = {
  id?: number | string;
  username?: string;
  first_name?: string;
  is_bot?: boolean;
};

type TelegramWebhookMessage = TelegramAutoReplyMessage & {
  from?: TelegramWebhookUser;
};

type TelegramWebhookUpdate = {
  message?: TelegramWebhookMessage;
  edited_message?: TelegramWebhookMessage;
  callback_query?: {
    id?: string;
    from?: TelegramWebhookUser;
    message?: TelegramWebhookMessage;
    data?: string;
  };
};

const activeMatchStatuses = [
  MatchStatus.READY,
  MatchStatus.SCHEDULED,
  MatchStatus.LIVE,
  MatchStatus.RESULT_SUBMITTED,
  MatchStatus.DISPUTED,
];

function normalizeTelegramUsername(value?: string | null) {
  const username = value?.trim().replace(/^@/, "");
  return username && /^[A-Za-z0-9_]{5,32}$/.test(username) ? username : null;
}

function normalizeId(value?: number | string | null) {
  if (value === undefined || value === null) return null;
  const normalized = String(value).trim();
  return /^-?\d+$/.test(normalized) ? normalized : null;
}

function escapeTelegramHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function commandName(text?: string) {
  return text?.trim().match(/^\/([a-z]+)(?:@[A-Za-z0-9_]+)?(?:\s|$)/i)?.[1]?.toLowerCase() ?? null;
}

function isGroupMessage(message: TelegramWebhookMessage) {
  return message.chat?.type === "group" || message.chat?.type === "supergroup";
}

async function syncTelegramUsernameFromWebhook(update: TelegramWebhookUpdate) {
  const from = update.message?.from ?? update.edited_message?.from ?? update.callback_query?.from;
  const telegramId = normalizeId(from?.id);
  if (!telegramId || telegramId.startsWith("-")) return;

  await db.user.updateMany({
    where: { telegramId },
    data: { telegramUsername: normalizeTelegramUsername(from?.username) },
  });
}

function siteUrl(path: string) {
  const baseUrl = getConfiguredSiteBaseUrl();
  return baseUrl ? new URL(path, baseUrl).toString() : null;
}

async function deliverWelcomeMessage(params: {
  message: TelegramWebhookMessage;
  linked: boolean;
  registeredUsers: number;
}) {
  const chatId = normalizeId(params.message.chat?.id ?? params.message.from?.id);
  if (!chatId) return;

  const firstName = params.message.from?.first_name?.trim();
  const greetingName = firstName ? `, ${escapeTelegramHtml(firstName)}` : "";
  const platformUrl = siteUrl("/");

  const lines = [
    `${tgEmoji("gamepad")} <b>eFootball Nexon</b>`,
    `${tgEmoji("party")} <b>Добро пожаловать${greetingName}!</b>`,
    "<blockquote>Это официальный бот киберспортивной платформы eFootball Nexon — турниры, матчи, рейтинги и достижения в одном месте.</blockquote>",
    "",
    `${tgEmoji("bell")} <b>Сюда будут приходить:</b>`,
    `${tgEmoji("crown")} приглашения и старты турниров`,
    `${tgEmoji("fire")} назначения и напоминания о матчах`,
    `${tgEmoji("chart")} подтверждённые результаты и изменения рейтинга`,
    `${tgEmoji("lock")} коды входа и оповещения безопасности`,
    "",
    `${tgEmoji("info")} <b>В боте зарегистрировано:</b> ${params.registeredUsers}`,
    "",
    params.linked
      ? `${tgEmoji("check")} <b>Telegram привязан к вашему аккаунту.</b> Уведомления уже включены.`
      : `${tgEmoji("link")} <b>Аккаунт ещё не привязан.</b> Войдите на сайте через Telegram, чтобы получать уведомления здесь.`,
  ];

  await sendTelegramMessage({
    chatId,
    text: lines.join("\n"),
    disableWebPagePreview: true,
    replyMarkup: platformUrl
        ? buildTelegramInlineKeyboard([
          { text: "Открыть платформу", url: platformUrl, row: 1, iconCustomEmojiId: tgEmojiId("home") },
          { text: "Турниры", url: siteUrl("/tournaments")!, row: 2, iconCustomEmojiId: tgEmojiId("crown") },
          { text: "Рейтинги", url: siteUrl("/ratings")!, row: 2, iconCustomEmojiId: tgEmojiId("chart") },
        ])
      : undefined,
  });
}

async function deliverCommandMessage(params: {
  message: TelegramWebhookMessage;
  draft: TelegramRichMessageDraft;
}) {
  const chatId = normalizeId(params.message.chat?.id ?? params.message.from?.id);
  const receiverUserId = normalizeId(params.message.from?.id);
  if (!chatId) return;
  const replyMarkup = buildTelegramInlineKeyboard(params.draft.buttons ?? []);

  if (isGroupMessage(params.message)) {
    if (!receiverUserId) return;
    await sendTelegramRichMessage({
      chatId,
      message: params.draft,
      receiverUserId,
      replyMarkup,
    });
    return;
  }

  await sendTelegramDraftAsText({ chatId, message: params.draft, replyMarkup });
}

function infoMessage(title: string, body: string, button?: { text: string; url: string }): TelegramRichMessageDraft {
  return {
    blocks: [
      { type: "section_heading", text: title },
      { type: "blockquote", text: body },
      { type: "footer", text: "eFootball Nexon · матчевый помощник" },
    ],
    fallbackText: `${tgEmoji("info")} <b>${escapeTelegramHtml(title)}</b>\n\n${escapeTelegramHtml(body)}`,
    buttons: button ? [{ ...button, row: 1, iconCustomEmojiId: tgEmojiId("arrowRight") }] : undefined,
  };
}

async function resolveCommandContext(message: TelegramWebhookMessage) {
  const telegramId = normalizeId(message.from?.id);
  const chatId = normalizeId(message.chat?.id);
  const user = telegramId && !telegramId.startsWith("-")
    ? await db.user.findUnique({ where: { telegramId }, select: { id: true } })
    : null;

  const communityTournament = chatId
    ? await db.tournament.findFirst({
        where: {
          isTest: false,
          OR: [
            { telegramGroupId: chatId },
            { telegramChannelId: chatId },
            { telegramCommunityId: chatId },
          ],
        },
        orderBy: { updatedAt: "desc" },
        select: { id: true, title: true, rules: true },
      })
    : null;

  const userTournament = !communityTournament && user
    ? await db.tournament.findFirst({
        where: {
          isTest: false,
          status: { in: [TournamentStatus.REGISTRATION_OPEN, TournamentStatus.AWAITING_START, TournamentStatus.IN_PROGRESS] },
          participants: { some: { userId: user.id } },
        },
        orderBy: { updatedAt: "desc" },
        select: { id: true, title: true, rules: true },
      })
    : null;

  return { user, tournament: communityTournament ?? userTournament };
}

async function buildMyMatchDraft(userId: string, tournamentId: string) {
  const match = await db.match.findFirst({
    where: {
      tournamentId,
      status: { in: activeMatchStatuses },
      isPenaltyTiebreak: false,
      OR: [{ player1Id: userId }, { player2Id: userId }],
    },
    orderBy: [{ scheduledAt: "asc" }, { round: "asc" }, { matchNumber: "asc" }],
    include: {
      tournament: { select: { title: true } },
      stage: { select: { id: true, name: true } },
      player1: { select: { id: true, name: true, telegramUsername: true, email: true } },
      player2: { select: { id: true, name: true, telegramUsername: true, email: true } },
    },
  });
  if (!match) return null;
  const opponent = match.player1Id === userId ? match.player2 : match.player1;
  const deadline = match.stageId
    ? await db.roundDeadline.findUnique({ where: { stageId_round: { stageId: match.stageId, round: match.round } } })
    : null;
  const name = opponent?.name?.trim() || (opponent?.telegramUsername ? `@${opponent.telegramUsername.replace(/^@/, "")}` : "") || opponent?.email?.split("@")[0] || "Соперник";
  const url = siteUrl(`/tournaments/${tournamentId}?tab=my-matches`);
  if (!url) return null;
  return buildPersonalMatchMessage({
    tournamentTitle: match.tournament.title,
    stageName: match.stage?.name || "Основной этап",
    round: match.round,
    opponentName: name,
    scheduledAt: match.scheduledAt,
    deadlineAt: deadline?.deadlineAt,
    statusLabel: match.status === MatchStatus.DISPUTED ? "Требуется решение судьи" : "Ожидается результат",
    matchUrl: url,
  });
}

async function handleCommand(message: TelegramWebhookMessage) {
  if (!process.env.TELEGRAM_BOT_TOKEN) return;
  const command = commandName(message.text);
  if (!command || !["start", "mymatch", "deadline", "table", "schedule", "rules"].includes(command)) return;

  if (command === "start") {
    const telegramId = normalizeId(message.from?.id);
    const [linkedUser, registeredUsers] = await Promise.all([
      telegramId && !telegramId.startsWith("-")
        ? db.user.findUnique({ where: { telegramId }, select: { id: true } })
        : null,
      db.user.count({ where: { telegramId: { not: null }, isBanned: false } }),
    ]);
    await deliverWelcomeMessage({ message, linked: Boolean(linkedUser), registeredUsers }).catch((error) => {
      if (isTelegramRecipientUnavailableError(error)) return;
      console.error("Failed to send Telegram welcome message", error);
    });
    return;
  }

  const context = await resolveCommandContext(message);
  let draft: TelegramRichMessageDraft;

  if (!context.user) {
    const url = siteUrl("/dashboard/security");
    draft = infoMessage(
      "Сначала привяжите Telegram",
      "Бот не нашёл связанный аккаунт. Войдите на платформу и подключите Telegram в настройках безопасности.",
      url ? { text: "Подключить Telegram", url } : undefined,
    );
  } else if (!context.tournament) {
    draft = infoMessage("Нет активного турнира", "Сейчас для вашего аккаунта не найден активный турнир или эта группа ещё не привязана организатором.");
  } else if (command === "mymatch" || command === "deadline") {
    draft = await buildMyMatchDraft(context.user.id, context.tournament.id)
      ?? infoMessage("Нет активного матча", "Для вас пока нет матча, требующего результата. Проверьте расписание турнира позже.");
  } else if (command === "rules") {
    const url = siteUrl(`/tournaments/${context.tournament.id}?tab=rules`);
    draft = {
      blocks: [
        { type: "section_heading", text: `Регламент · ${context.tournament.title}` },
        { type: "details", title: "Открыть правила", blocks: [{ type: "paragraph", text: context.tournament.rules }] },
        { type: "footer", text: "Полная и актуальная версия всегда доступна на платформе." },
      ],
      fallbackText: `${tgEmoji("bookmark")} <b>Регламент · ${escapeTelegramHtml(context.tournament.title)}</b>\n\n${escapeTelegramHtml(context.tournament.rules)}`,
      buttons: url ? [{ text: "Полный регламент", url, row: 1, iconCustomEmojiId: tgEmojiId("bookmark") }] : undefined,
    };
  } else {
    draft = await buildTournamentBulletin(context.tournament.id)
      ?? infoMessage("Данные готовятся", "Таблицы и расписание появятся после формирования этапов турнира.");
  }

  await deliverCommandMessage({ message, draft }).catch((error) => {
    if (isTelegramRecipientUnavailableError(error)) return;
    console.error("Failed to answer Telegram tournament command", { command, error });
  });
}

async function handleCallbackQuery(callbackQuery: NonNullable<TelegramWebhookUpdate["callback_query"]>) {
  if (!process.env.TELEGRAM_BOT_TOKEN) return;
  const callbackQueryId = callbackQuery.id;
  const data = callbackQuery.data?.trim();
  if (!callbackQueryId || !data) return;

  const telegramId = normalizeId(callbackQuery.from?.id);
  const user = telegramId && !telegramId.startsWith("-")
    ? await db.user.findUnique({ where: { telegramId }, select: { id: true } })
    : null;

  if (!user) {
    await answerTelegramCallbackQuery({
      callbackQueryId,
      text: "Аккаунт не привязан. Войдите на платформе через Telegram.",
      showAlert: true,
    }).catch(() => null);
    return;
  }

  let result;
  try {
    result = await handleTelegramCallbackAction({ userId: user.id, data });
  } catch (error) {
    console.error("Failed to handle Telegram callback", { data, error });
    await answerTelegramCallbackQuery({ callbackQueryId, text: "Не удалось выполнить действие. Попробуйте на сайте." }).catch(() => null);
    return;
  }

  await answerTelegramCallbackQuery({
    callbackQueryId,
    text: result.toast,
    showAlert: result.showAlert,
  }).catch(() => null);

  if (result.clearKeyboard) {
    const chatId = normalizeId(callbackQuery.message?.chat?.id);
    const messageId = callbackQuery.message?.message_id;
    if (chatId && messageId) {
      await editTelegramMessageReplyMarkup({ chatId, messageId: String(messageId) }).catch(() => null);
    }
  }
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
      await handleCommand(update.message);
      await handleTelegramAutoReply(update.message).catch((error) => {
        if (isTelegramRecipientUnavailableError(error)) return;
        console.error("Failed to send Telegram auto reply", error);
      });
    }
    if (update.callback_query) await handleCallbackQuery(update.callback_query);
  }

  return NextResponse.json({ ok: true });
}
