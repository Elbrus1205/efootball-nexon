import { MatchStatus, TournamentStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { getConfiguredSiteBaseUrl } from "@/lib/affiliate";
import { db } from "@/lib/db";
import {
  getTelegramWebhookSecret,
  isTelegramRecipientUnavailableError,
  sendTelegramRichMessage,
  sendTelegramRichMessageWithFallback,
} from "@/lib/telegram-bot";
import { buildTelegramInlineKeyboard } from "@/lib/telegram-format";
import { buildPersonalMatchMessage, type TelegramRichMessageDraft } from "@/lib/telegram-rich";
import { buildTournamentBulletin } from "@/lib/services/telegram-publications";

export const runtime = "nodejs";

type TelegramWebhookUser = {
  id?: number | string;
  username?: string;
  first_name?: string;
};

type TelegramWebhookMessage = {
  message_id?: number;
  from?: TelegramWebhookUser;
  chat?: { id?: number | string; type?: "private" | "group" | "supergroup" | "channel"; title?: string };
  text?: string;
};

type TelegramWebhookUpdate = {
  message?: TelegramWebhookMessage;
  edited_message?: TelegramWebhookMessage;
  callback_query?: { id?: string; from?: TelegramWebhookUser; message?: TelegramWebhookMessage };
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

function welcomeMessage(firstName: string | null, linked: boolean): TelegramRichMessageDraft {
  const name = firstName?.trim() ? `, ${firstName.trim()}` : "";
  const platformUrl = siteUrl("/");
  return {
    blocks: [
      { type: "section_heading", text: `Добро пожаловать${name}` },
      { type: "paragraph", text: "eFootball Nexon объединяет турниры, матчи, рейтинги и достижения. Бот присылает только важные игровые события." },
      {
        type: "table",
        columns: ["Команда", "Что покажет"],
        rows: [
          ["/mymatch", "Ваш ближайший матч"],
          ["/deadline", "Дедлайн текущего тура"],
          ["/table", "Таблицы турнира"],
          ["/schedule", "Ближайшие матчи"],
          ["/rules", "Регламент"],
        ],
      },
      {
        type: linked ? "footer" : "blockquote",
        text: linked
          ? "Telegram привязан к вашему аккаунту — персональные уведомления включены."
          : "Привяжите Telegram на платформе, чтобы бот мог найти ваши матчи и дедлайны.",
      },
    ],
    fallbackText: [
      `<b>Добро пожаловать${escapeTelegramHtml(name)}</b>`,
      "",
      "eFootball Nexon — турниры, матчи, рейтинги и достижения.",
      "",
      "/mymatch — ближайший матч",
      "/deadline — дедлайн тура",
      "/table — таблицы",
      "/schedule — расписание",
      "/rules — регламент",
      "",
      linked ? "Telegram привязан к аккаунту." : "Привяжите Telegram на платформе.",
    ].join("\n"),
    buttons: platformUrl
      ? [
          { text: "Открыть платформу", url: platformUrl, row: 1 },
          { text: "Турниры", url: siteUrl("/tournaments")!, row: 2 },
          { text: "Рейтинги", url: siteUrl("/ratings")!, row: 2 },
        ]
      : undefined,
  };
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

  await sendTelegramRichMessageWithFallback({ chatId, message: params.draft, replyMarkup });
}

function infoMessage(title: string, body: string, button?: { text: string; url: string }): TelegramRichMessageDraft {
  return {
    blocks: [
      { type: "section_heading", text: title },
      { type: "blockquote", text: body },
      { type: "footer", text: "eFootball Nexon · матчевый помощник" },
    ],
    fallbackText: `<b>${escapeTelegramHtml(title)}</b>\n\n<blockquote>${escapeTelegramHtml(body)}</blockquote>`,
    buttons: button ? [{ ...button, row: 1 }] : undefined,
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

  const context = await resolveCommandContext(message);
  let draft: TelegramRichMessageDraft;

  if (command === "start") {
    draft = welcomeMessage(message.from?.first_name?.trim() || null, Boolean(context.user));
  } else if (!context.user) {
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
      fallbackText: `<b>Регламент · ${escapeTelegramHtml(context.tournament.title)}</b>\n\n<blockquote expandable>${escapeTelegramHtml(context.tournament.rules)}</blockquote>`,
      buttons: url ? [{ text: "Полный регламент", url, row: 1 }] : undefined,
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
    if (update.message) await handleCommand(update.message);
  }

  return NextResponse.json({ ok: true });
}
