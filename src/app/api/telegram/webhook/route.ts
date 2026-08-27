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
  buildEmptyTelegramAiContext,
  handleTelegramAiMessage,
  isTelegramAbusiveMessage,
  isTelegramAiRelevantMessage,
  TELEGRAM_AI_NAME,
  type TelegramAiContext,
  type TelegramAiMessage,
} from "@/lib/services/telegram-ai";
import { tgEmoji, tgEmojiId } from "@/lib/telegram-emoji";
import { buildTelegramInlineKeyboard } from "@/lib/telegram-format";
import { buildPersonalMatchMessage, type TelegramRichMessageDraft } from "@/lib/telegram-rich";
import { getRegulationsDocument } from "@/lib/regulations";
import { blocksToPlainText, resolveFaqBlocks } from "@/lib/faq/content";
import { buildTournamentBulletin } from "@/lib/services/telegram-publications";
import { claimTelegramUpdate, consumeTelegramAiRateLimit } from "@/lib/services/telegram-webhook-guard";

export const runtime = "nodejs";

type TelegramWebhookUser = {
  id?: number | string;
  username?: string;
  first_name?: string;
  is_bot?: boolean;
};

type TelegramWebhookMessage = TelegramAiMessage & {
  from?: TelegramWebhookUser;
};

type TelegramWebhookUpdate = {
  update_id?: number;
  message?: TelegramWebhookMessage;
  edited_message?: TelegramWebhookMessage;
  channel_post?: TelegramWebhookMessage;
  edited_channel_post?: TelegramWebhookMessage;
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

const completedMatchStatuses = [MatchStatus.CONFIRMED, MatchStatus.FINISHED, MatchStatus.FORFEIT];
const upcomingTournamentContextMatchLimit = 18;
const completedTournamentContextMatchLimit = 6;
const founderContact = { name: "Kumyk", role: "FOUNDER", telegramUsername: "@Kumyk007" } as const;

const telegramAiMatchSelect = {
  id: true,
  stageId: true,
  round: true,
  matchNumber: true,
  status: true,
  scheduledAt: true,
  startsAt: true,
  player1Score: true,
  player2Score: true,
  player1: { select: { name: true, telegramUsername: true } },
  player2: { select: { name: true, telegramUsername: true } },
  participant1Entry: {
    select: { teamName: true, clubName: true, user: { select: { name: true, telegramUsername: true } } },
  },
  participant2Entry: {
    select: { teamName: true, clubName: true, user: { select: { name: true, telegramUsername: true } } },
  },
  stage: { select: { name: true } },
  group: { select: { name: true } },
  schedules: { orderBy: { startsAt: "asc" as const }, take: 1, select: { startsAt: true, endsAt: true } },
} as const;

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
  const from = update.message?.from ?? update.edited_message?.from ?? update.channel_post?.from ?? update.edited_channel_post?.from ?? update.callback_query?.from;
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
        select: {
          id: true,
          title: true,
          description: true,
          rules: true,
          status: true,
          startsAt: true,
          registrationStartsAt: true,
          registrationEndsAt: true,
          format: true,
          participantMode: true,
          rosterSize: true,
          matchupFormat: true,
          bestOfWins: true,
          playoffType: true,
          playoffLegs: true,
          pointsForWin: true,
          pointsForDraw: true,
          pointsForLoss: true,
        },
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
        select: {
          id: true,
          title: true,
          description: true,
          rules: true,
          status: true,
          startsAt: true,
          registrationStartsAt: true,
          registrationEndsAt: true,
          format: true,
          participantMode: true,
          rosterSize: true,
          matchupFormat: true,
          bestOfWins: true,
          playoffType: true,
          playoffLegs: true,
          pointsForWin: true,
          pointsForDraw: true,
          pointsForLoss: true,
        },
      })
    : null;

  return { user, tournament: communityTournament ?? userTournament };
}

async function buildTelegramAiContext(message: TelegramWebhookMessage): Promise<TelegramAiContext> {
  const context = await resolveCommandContext(message);
  const [upcomingTournaments, regulationsDocument, faqItems] = await Promise.all([
    db.tournament.findMany({
      where: {
        isTest: false,
        status: { in: [TournamentStatus.REGISTRATION_OPEN, TournamentStatus.AWAITING_START, TournamentStatus.IN_PROGRESS] },
      },
      orderBy: { startsAt: "asc" },
      take: 5,
      select: { id: true, title: true, status: true, startsAt: true, registrationEndsAt: true },
    }),
    getRegulationsDocument(),
    db.faqItem.findMany({
      where: { isPublished: true },
      orderBy: [{ sortOrder: "asc" }, { updatedAt: "desc" }],
      take: 40,
      select: { title: true, category: true, answer: true, contentJson: true, attachments: { orderBy: { sortOrder: "asc" }, select: { title: true, url: true, kind: true, mimeType: true } } },
    }),
  ]);
  const regulations = { body: regulationsDocument.body, version: regulationsDocument.version };
  const faq = faqItems.map((item) => ({
    title: item.title,
    category: item.category,
    answer: blocksToPlainText(resolveFaqBlocks(item)).slice(0, 4_000),
  })).filter((item) => item.answer.trim());
  const staffContacts = [founderContact];
  if (!context.user && !context.tournament) {
    return {
      ...buildEmptyTelegramAiContext(),
      staffContacts,
      regulations,
      faq,
      upcomingTournaments: upcomingTournaments.map((tournament) => ({
        id: tournament.id,
        title: tournament.title,
        status: tournament.status,
        startsAt: tournament.startsAt.toISOString(),
        registrationEndsAt: tournament.registrationEndsAt.toISOString(),
      })),
    };
  }

  const user = context.user && telegramUserId(message)
    ? await db.user.findUnique({
        where: { id: context.user.id },
        select: { name: true, telegramUsername: true },
      })
    : null;

  let personalMatch: TelegramAiContext["personalMatch"] = null;
  if (context.user && context.tournament) {
    const match = await db.match.findFirst({
      where: {
        tournamentId: context.tournament.id,
        status: { in: activeMatchStatuses },
        isPenaltyTiebreak: false,
        OR: [{ player1Id: context.user.id }, { player2Id: context.user.id }],
      },
      orderBy: [{ scheduledAt: "asc" }, { round: "asc" }, { matchNumber: "asc" }],
      include: {
        tournament: { select: { title: true } },
        stage: { select: { name: true, id: true } },
        player1: { select: { id: true, name: true, telegramUsername: true } },
        player2: { select: { id: true, name: true, telegramUsername: true } },
      },
    });
    if (match) {
      const opponent = match.player1Id === context.user.id ? match.player2 : match.player1;
      const deadline = match.stageId
        ? await db.roundDeadline.findUnique({ where: { stageId_round: { stageId: match.stageId, round: match.round } }, select: { deadlineAt: true } })
        : null;
      personalMatch = {
        id: match.id,
        tournamentId: match.tournamentId,
        tournamentTitle: match.tournament.title,
        stage: match.stage?.name || "Основной этап",
        round: match.round,
        opponent: opponent?.name?.trim() || (opponent?.telegramUsername ? `@${opponent.telegramUsername.replace(/^@/, "")}` : "Не указан"),
        opponentTelegramUsername: opponent?.telegramUsername ? `@${opponent.telegramUsername.replace(/^@/, "")}` : null,
        status: match.status,
        scheduledAt: match.scheduledAt?.toISOString() ?? null,
        deadlineAt: deadline?.deadlineAt?.toISOString() ?? null,
      };
    }
  }

  let tournamentDetails: TelegramAiContext["tournament"] = null;
  if (context.tournament) {
    const [stages, upcomingMatchRows, completedMatchRows, totalMatches, upcomingMatches, completedMatches, deadlines] = await Promise.all([
      db.tournamentStage.findMany({
        where: { tournamentId: context.tournament.id },
        orderBy: { orderIndex: "asc" },
        take: 16,
        select: { name: true, type: true, status: true, startsAt: true, endsAt: true },
      }),
      db.match.findMany({
        where: {
          tournamentId: context.tournament.id,
          isPenaltyTiebreak: false,
          status: { notIn: [...completedMatchStatuses, MatchStatus.CANCELLED, MatchStatus.REJECTED] },
        },
        orderBy: [{ scheduledAt: "asc" }, { round: "asc" }, { matchNumber: "asc" }],
        take: upcomingTournamentContextMatchLimit,
        select: telegramAiMatchSelect,
      }),
      db.match.findMany({
        where: {
          tournamentId: context.tournament.id,
          isPenaltyTiebreak: false,
          status: { in: completedMatchStatuses },
        },
        orderBy: [{ finishedAt: "desc" }, { round: "desc" }, { matchNumber: "desc" }],
        take: completedTournamentContextMatchLimit,
        select: telegramAiMatchSelect,
      }),
      db.match.count({ where: { tournamentId: context.tournament.id, isPenaltyTiebreak: false } }),
      db.match.count({ where: { tournamentId: context.tournament.id, isPenaltyTiebreak: false, status: { in: activeMatchStatuses } } }),
      db.match.count({ where: { tournamentId: context.tournament.id, isPenaltyTiebreak: false, status: { in: completedMatchStatuses } } }),
      db.roundDeadline.findMany({
        where: { tournamentId: context.tournament.id },
        select: { stageId: true, round: true, deadlineAt: true },
      }),
    ]);
    const deadlineByStageAndRound = new Map(
      deadlines.map((deadline) => [`${deadline.stageId}:${deadline.round}`, deadline.deadlineAt.toISOString()]),
    );
    const matches = [...upcomingMatchRows, ...completedMatchRows];
    const participantName = (entry: {
      teamName: string | null;
      clubName: string | null;
      user: { name: string | null; telegramUsername: string | null };
    } | null, player: { name: string | null; telegramUsername: string | null } | null) =>
      entry?.teamName?.trim()
      || entry?.clubName?.trim()
      || entry?.user.name?.trim()
      || (entry?.user.telegramUsername ? `@${entry.user.telegramUsername.replace(/^@/, "")}` : "")
      || player?.name?.trim()
      || (player?.telegramUsername ? `@${player.telegramUsername.replace(/^@/, "")}` : "")
      || "Ещё не определён";

    tournamentDetails = {
      ...context.tournament,
      startsAt: context.tournament.startsAt.toISOString(),
      registrationStartsAt: context.tournament.registrationStartsAt?.toISOString() ?? null,
      registrationEndsAt: context.tournament.registrationEndsAt.toISOString(),
      stages: stages.map((stage) => ({
        name: stage.name,
        type: stage.type,
        status: stage.status,
        startsAt: stage.startsAt?.toISOString() ?? null,
        endsAt: stage.endsAt?.toISOString() ?? null,
      })),
      matches: matches.map((match) => {
        const schedule = match.schedules[0];
        return {
          id: match.id,
          stage: match.stage?.name ?? null,
          group: match.group?.name ?? null,
          round: match.round,
          matchNumber: match.matchNumber,
          home: participantName(match.participant1Entry, match.player1),
          away: participantName(match.participant2Entry, match.player2),
          homeTelegramUsername: match.player1?.telegramUsername
            ? `@${match.player1.telegramUsername.replace(/^@/, "")}`
            : match.participant1Entry?.user.telegramUsername
              ? `@${match.participant1Entry.user.telegramUsername.replace(/^@/, "")}`
              : null,
          awayTelegramUsername: match.player2?.telegramUsername
            ? `@${match.player2.telegramUsername.replace(/^@/, "")}`
            : match.participant2Entry?.user.telegramUsername
              ? `@${match.participant2Entry.user.telegramUsername.replace(/^@/, "")}`
              : null,
          status: match.status,
          scheduledAt: match.scheduledAt?.toISOString() ?? match.startsAt?.toISOString() ?? null,
          scheduleStartsAt: schedule?.startsAt.toISOString() ?? null,
          scheduleEndsAt: schedule?.endsAt?.toISOString() ?? null,
          deadlineAt: match.stageId ? deadlineByStageAndRound.get(`${match.stageId}:${match.round}`) ?? null : null,
          score: match.player1Score !== null && match.player2Score !== null ? `${match.player1Score}:${match.player2Score}` : null,
        };
      }),
      matchCounts: { total: totalMatches, upcoming: upcomingMatches, completed: completedMatches },
    };
  }

  return {
    user: user ? { name: user.name?.trim() || null, telegramUsername: user.telegramUsername?.trim() || null } : null,
    staffContacts,
    regulations,
    faq,
    tournament: tournamentDetails,
    upcomingTournaments: upcomingTournaments.map((tournament) => ({
      id: tournament.id,
      title: tournament.title,
      status: tournament.status,
      startsAt: tournament.startsAt.toISOString(),
      registrationEndsAt: tournament.registrationEndsAt.toISOString(),
    })),
    personalMatch,
  };
}

async function isConfiguredTournamentChat(message: TelegramWebhookMessage) {
  if (!isGroupMessage(message)) return false;
  const chatId = normalizeId(message.chat?.id);
  if (!chatId) return false;

  const tournament = await db.tournament.findFirst({
    where: {
      isTest: false,
      OR: [{ telegramGroupId: chatId }, { telegramChannelId: chatId }, { telegramCommunityId: chatId }],
    },
    select: { id: true },
  });
  return Boolean(tournament);
}

async function sendTournamentModerationWarning(message: TelegramWebhookMessage) {
  const chatId = normalizeId(message.chat?.id);
  const messageId = message.message_id;
  if (!chatId || !messageId) return;

  const username = normalizeTelegramUsername(message.from?.username);
  const displayName = message.from?.first_name?.trim() || message.from?.username?.trim() || "Участник";
  const target = username ? `@${username}` : displayName;
  await sendTelegramMessage({
    chatId,
    text: `${target}, остановитесь. В сообщении обнаружены оскорбления или нецензурная лексика. Обсуждайте матч и спор по фактам и регламенту. Повторные нарушения передаются администрации: возможны мут или бан по правилам платформы.`,
    parseMode: null,
    disableWebPagePreview: true,
    replyParameters: { messageId, allowSendingWithoutReply: true },
    ...(message.message_thread_id !== undefined ? { messageThreadId: message.message_thread_id } : {}),
  });
}

function telegramUserId(message: TelegramWebhookMessage) {
  const id = normalizeId(message.from?.id);
  return id && !id.startsWith("-") ? id : null;
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
  if (!command || !["start", "help", "contacts", "mymatch", "mymatches", "myresults", "deadline", "table", "schedule", "rules"].includes(command)) return;

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

  if (command === "help") {
    const firstName = message.from?.first_name?.trim();
    const greeting = firstName ? `${firstName}, ` : "";
    const draft = infoMessage(
      `${TELEGRAM_AI_NAME} · команды`,
      `${greeting}я понимаю обычные сообщения о турнирах и отвечаю по актуальным данным. Для подробного вопроса используйте /ask ваш вопрос.\n\n/ask ваш вопрос — спросить Роки\n/mymatches — мой ближайший матч\n/myresults — результаты турнира\n/schedule — расписание\n/table — таблица\n/rules — регламент\n/contacts — связь с основателем`,
    );
    await deliverCommandMessage({ message, draft });
    return;
  }

  if (command === "contacts") {
    const url = "https://t.me/Kumyk007";
    await deliverCommandMessage({
      message,
      draft: infoMessage("Основатель eFootball Nexon", "Kumyk · @Kumyk007", { text: "Написать Kumyk", url }),
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
  } else if (command === "mymatch" || command === "mymatches" || command === "deadline") {
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
    if (!Number.isSafeInteger(update.update_id) || (update.update_id ?? -1) < 0) {
      return NextResponse.json({ ok: false, error: "Invalid Telegram update." }, { status: 400 });
    }
    const claimed = await claimTelegramUpdate(update.update_id!).catch((error) => {
      console.error("Failed to claim Telegram update", error);
      return null;
    });
    if (claimed === null) return NextResponse.json({ ok: false }, { status: 503 });
    if (!claimed) return NextResponse.json({ ok: true, duplicate: true });

    await syncTelegramUsernameFromWebhook(update);
    const incomingMessage = update.message ?? update.channel_post;
    if (incomingMessage) {
      await handleCommand(incomingMessage);
      const command = commandName(incomingMessage.text);
      if (!command || command === "ask") {
        const botUsername = process.env.TELEGRAM_BOT_USERNAME ?? process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME;
        const configuredChat = isGroupMessage(incomingMessage)
          ? await isConfiguredTournamentChat(incomingMessage).catch((error) => {
              console.error("Failed to resolve configured tournament chat", error);
              return false;
            })
          : false;
        if (configuredChat && isTelegramAbusiveMessage(incomingMessage)) {
          await sendTournamentModerationWarning(incomingMessage).catch((error) => {
            if (!isTelegramRecipientUnavailableError(error)) console.error("Failed to send Telegram moderation warning", error);
          });
          return NextResponse.json({ ok: true, moderated: true });
        }
        const initiallyRelevant = isTelegramAiRelevantMessage(incomingMessage, botUsername);
        const couldBeTournamentChatQuestion = !initiallyRelevant
          && isTelegramAiRelevantMessage(incomingMessage, botUsername, { tournamentChat: true });
        const tournamentChat = couldBeTournamentChatQuestion
          ? configuredChat
          : false;
        if (initiallyRelevant || tournamentChat) {
          const userId = normalizeId(incomingMessage.from?.id);
          const chatId = normalizeId(incomingMessage.chat?.id);
          if (!userId || !chatId) return NextResponse.json({ ok: true });
          const rateLimit = await consumeTelegramAiRateLimit({ userId, chatId });
          if (!rateLimit.allowed) {
            const firstName = incomingMessage.from?.first_name?.trim();
            await sendTelegramMessage({
              chatId,
              text: `${firstName ? `${firstName}, ` : ""}слишком много вопросов. Повторите через ${rateLimit.retryAfterSeconds} сек.`,
              parseMode: null,
              replyParameters: incomingMessage.message_id
                ? { messageId: incomingMessage.message_id, allowSendingWithoutReply: true }
                : undefined,
            }).catch((error) => {
              if (!isTelegramRecipientUnavailableError(error)) console.error("Failed to send Telegram rate-limit reply", error);
            });
            return NextResponse.json({ ok: true, rateLimited: true });
          }
          const context = await buildTelegramAiContext(incomingMessage).catch((error) => {
            console.error("Failed to build Telegram AI context", error);
            return buildEmptyTelegramAiContext();
          });
          await handleTelegramAiMessage({
            message: incomingMessage,
            context,
            botUsername,
            tournamentChat,
          }).catch((error) => {
            if (isTelegramRecipientUnavailableError(error)) return;
            console.error("Failed to send Telegram AI reply", error);
          });
        }
      }
    }
    if (update.callback_query) await handleCallbackQuery(update.callback_query);
  }

  return NextResponse.json({ ok: true });
}
