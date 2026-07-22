import { MatchStatus, ParticipantStatus, TournamentFormat, TournamentParticipantMode } from "@prisma/client";
import { getConfiguredSiteBaseUrl } from "@/lib/affiliate";
import { db } from "@/lib/db";
import {
  editTelegramDraftAsText,
  sendTelegramDraftAsText,
  type TelegramSentMessage,
} from "@/lib/telegram-bot";
import { buildTelegramInlineKeyboard } from "@/lib/telegram-format";
import { tgEmoji, tgEmojiId } from "@/lib/telegram-emoji";
import {
  buildCompletionMessage,
  buildResultMessage,
  buildScheduleMessage,
  buildStandingsMessage,
  buildTournamentAnnouncement,
  type TelegramRichMessageDraft,
} from "@/lib/telegram-rich";
import { hashTelegramRichMessage, resolveTelegramPublicationAction } from "@/lib/telegram-publications";

const formatLabels: Record<TournamentFormat, string> = {
  SINGLE_ELIMINATION: "Плей-офф",
  DOUBLE_ELIMINATION: "Double Elimination",
  ROUND_ROBIN: "Круговая система",
  LEAGUE: "Лига",
  GROUPS: "Группы",
  GROUPS_PLAYOFF: "Группы + плей-офф",
  CUSTOM: "Гибкий формат",
};

const participantModeLabels: Record<TournamentParticipantMode, string> = {
  SINGLE: "1x1",
  COOP: "Кооператив",
  TEAM: "Командный",
};

const matchStatusLabels: Record<MatchStatus, string> = {
  PENDING: "Не назначен",
  READY: "Готов к старту",
  RESULT_SUBMITTED: "Ожидает подтверждения",
  CONFIRMED: "Подтверждён",
  REJECTED: "Отклонён",
  FORFEIT: "Технический результат",
  CANCELLED: "Отменён",
  SCHEDULED: "Запланирован",
  LIVE: "Идёт сейчас",
  DISPUTED: "Спорный",
  FINISHED: "Завершён",
};

function playerName(user?: { name?: string | null; telegramUsername?: string | null; email?: string | null } | null) {
  return user?.name?.trim() || (user?.telegramUsername ? `@${user.telegramUsername.replace(/^@/, "")}` : "") || user?.email?.split("@")[0] || "Участник";
}

// "Клуб (Игрок)" when the side has a club, otherwise just the player — makes it
// clear which club each score belongs to in published results.
function sideName(
  entry?: { clubName?: string | null } | null,
  user?: { name?: string | null; telegramUsername?: string | null; email?: string | null } | null,
) {
  const club = entry?.clubName?.trim();
  const name = playerName(user);
  return club ? `${club} (${name})` : name;
}

function escapeTelegramHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function publicationMessageId(result: TelegramSentMessage | true, fallback?: string | null) {
  if (result === true) return fallback ?? null;
  return result.message_id === undefined ? fallback ?? null : String(result.message_id);
}

function shouldRecreatePublication(error: unknown) {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    message.includes("message to edit not found") ||
    message.includes("message can't be edited") ||
    message.includes("message can not be edited") ||
    message.includes("rich message") ||
    message.includes("sendrichmessage")
  );
}

function tournamentUrl(tournamentId: string, tab?: string) {
  const baseUrl = getConfiguredSiteBaseUrl();
  if (!baseUrl) return null;
  const url = new URL(`/tournaments/${tournamentId}`, baseUrl);
  if (tab) url.searchParams.set("tab", tab);
  return url.toString();
}

export async function publishTournamentRichDraft(params: {
  tournamentId: string;
  chatId: string;
  kind: string;
  message: TelegramRichMessageDraft;
}) {
  if (!process.env.TELEGRAM_BOT_TOKEN) return { status: "skipped" as const, reason: "bot-not-configured" as const };

  const contentHash = hashTelegramRichMessage(params.message);
  const existing = await db.telegramPublication.findUnique({
    where: {
      tournamentId_chatId_kind: {
        tournamentId: params.tournamentId,
        chatId: params.chatId,
        kind: params.kind,
      },
    },
  });
  const action = resolveTelegramPublicationAction({
    existingMessageId: existing?.messageId,
    existingContentHash: existing?.contentHash,
    nextContentHash: contentHash,
  });

  if (action === "skip") return { status: "skipped" as const, reason: "unchanged" as const, messageId: existing?.messageId };

  const replyMarkup = buildTelegramInlineKeyboard(params.message.buttons ?? []);
  let messageId = existing?.messageId ?? null;

  if (action === "edit" && existing) {
    try {
      const result = await editTelegramDraftAsText({
        chatId: params.chatId,
        messageId: existing.messageId,
        message: params.message,
        replyMarkup,
      });
      messageId = publicationMessageId(result, existing.messageId);
    } catch (error) {
      if (!shouldRecreatePublication(error)) throw error;
      const result = await sendTelegramDraftAsText({
        chatId: params.chatId,
        message: params.message,
        replyMarkup,
      });
      messageId = publicationMessageId(result);
    }
  } else {
    const result = await sendTelegramDraftAsText({
      chatId: params.chatId,
      message: params.message,
      replyMarkup,
    });
    messageId = publicationMessageId(result);
  }

  if (!messageId) throw new Error("Telegram did not return a message ID for a persistent publication");

  await db.telegramPublication.upsert({
    where: {
      tournamentId_chatId_kind: {
        tournamentId: params.tournamentId,
        chatId: params.chatId,
        kind: params.kind,
      },
    },
    create: {
      tournamentId: params.tournamentId,
      chatId: params.chatId,
      kind: params.kind,
      messageId,
      contentHash,
    },
    update: { messageId, contentHash },
  });

  return { status: action === "edit" ? "edited" as const : "sent" as const, messageId };
}

export async function publishTournamentAnnouncement(tournamentId: string) {
  const tournament = await db.tournament.findUnique({
    where: { id: tournamentId },
    include: {
      _count: {
        select: {
          participants: { where: { status: ParticipantStatus.CONFIRMED } },
        },
      },
    },
  });
  const url = tournamentUrl(tournamentId);
  const chatId = tournament?.telegramChannelId || tournament?.telegramGroupId;
  if (!tournament || !url || !chatId || !tournament.telegramAutoPublish || tournament.isTest) {
    return { status: "skipped" as const, reason: "not-configured" as const };
  }

  return publishTournamentRichDraft({
    tournamentId,
    chatId,
    kind: "announcement",
    message: buildTournamentAnnouncement({
      title: tournament.title,
      startsAt: tournament.startsAt,
      registrationEndsAt: tournament.registrationEndsAt,
      formatLabel: formatLabels[tournament.format],
      participantModeLabel: participantModeLabels[tournament.participantMode],
      maxParticipants: tournament.maxParticipants,
      confirmedParticipants: tournament._count.participants,
      prizePool: tournament.prizePool,
      rules: tournament.rules,
      coverImage: tournament.coverImage,
      tournamentUrl: url,
    }),
  });
}

export async function buildTournamentAnnouncementDraft(tournamentId: string) {
  const tournament = await db.tournament.findUnique({
    where: { id: tournamentId },
    include: {
      _count: {
        select: { participants: { where: { status: ParticipantStatus.CONFIRMED } } },
      },
    },
  });
  const url = tournamentUrl(tournamentId);
  if (!tournament || !url) return null;
  return buildTournamentAnnouncement({
    title: tournament.title,
    startsAt: tournament.startsAt,
    registrationEndsAt: tournament.registrationEndsAt,
    formatLabel: formatLabels[tournament.format],
    participantModeLabel: participantModeLabels[tournament.participantMode],
    maxParticipants: tournament.maxParticipants,
    confirmedParticipants: tournament._count.participants,
    prizePool: tournament.prizePool,
    rules: tournament.rules,
    coverImage: tournament.coverImage,
    tournamentUrl: url,
  });
}

export async function buildTournamentBulletin(tournamentId: string) {
  const tournament = await db.tournament.findUnique({
    where: { id: tournamentId },
    include: {
      stages: {
        orderBy: { orderIndex: "asc" },
        include: {
          groups: {
            orderBy: { orderIndex: "asc" },
            include: {
              standings: {
                orderBy: [{ rank: "asc" }, { points: "desc" }],
                include: {
                  participant: {
                    include: { user: { select: { name: true, telegramUsername: true, email: true } } },
                  },
                },
              },
            },
          },
          matches: {
            where: { isPenaltyTiebreak: false },
            orderBy: [{ round: "asc" }, { matchNumber: "asc" }],
            include: {
              player1: { select: { name: true, telegramUsername: true, email: true } },
              player2: { select: { name: true, telegramUsername: true, email: true } },
            },
          },
        },
      },
    },
  });
  const url = tournamentUrl(tournamentId);
  if (!tournament || !url) return null;

  const blocks: TelegramRichMessageDraft["blocks"] = [
    { type: "section_heading", text: `${tournament.title} · центр турнира` },
    { type: "paragraph", text: "Актуальные матчи и таблицы обновляются автоматически после подтверждения результатов." },
  ];
  const fallbackParts = [
    `${tgEmoji("crown")} <b>${escapeTelegramHtml(tournament.title)} · центр турнира</b>`,
    `${tgEmoji("refresh")} Матчи и таблицы обновляются после подтверждения результатов.`,
  ];

  const groups = tournament.stages.flatMap((stage) => stage.groups);
  for (const group of groups.slice(0, 4)) {
    const standings = buildStandingsMessage({
      tournamentTitle: tournament.title,
      groupName: group.name,
      rows: group.standings.map((standing, index) => ({
        rank: standing.rank ?? index + 1,
        name: standing.participant.teamName || standing.participant.clubName || playerName(standing.participant.user),
        played: standing.played,
        goalDifference: standing.goalDifference,
        points: standing.points,
      })),
      tournamentUrl: url,
      maxRows: 10,
    });
    blocks.push(...standings.blocks.slice(0, 2), { type: "divider" });
    fallbackParts.push(standings.fallbackText);
  }

  const activeStage = tournament.stages.find((stage) => stage.status === "ACTIVE") ?? tournament.stages.find((stage) => stage.matches.length);
  if (activeStage) {
    const schedule = buildScheduleMessage({
      tournamentTitle: tournament.title,
      stageName: activeStage.name,
      matches: activeStage.matches
        .filter((match) => match.status !== MatchStatus.CANCELLED && match.status !== MatchStatus.FINISHED)
        .slice(0, 12)
        .map((match) => ({
          round: match.round,
          playerOne: playerName(match.player1),
          playerTwo: playerName(match.player2),
          scheduledAt: match.scheduledAt,
          statusLabel: matchStatusLabels[match.status],
        })),
      tournamentUrl: `${url}?tab=matches`,
    });
    blocks.push(...schedule.blocks);
    fallbackParts.push(schedule.fallbackText);
  }

  blocks.push({ type: "footer", text: "eFootball Nexon · официальный турнирный бюллетень" });
  return {
    blocks,
    fallbackText: fallbackParts.join("\n\n"),
    buttons: [
      { text: "Перейти к турниру", url, row: 1, iconCustomEmojiId: tgEmojiId("crown") },
      { text: "Мои матчи", url: `${url}?tab=my-matches`, row: 1, iconCustomEmojiId: tgEmojiId("gamepad") },
    ],
  } satisfies TelegramRichMessageDraft;
}

export async function syncTournamentBulletin(tournamentId: string) {
  const tournament = await db.tournament.findUnique({
    where: { id: tournamentId },
    select: { telegramChannelId: true, telegramGroupId: true, telegramAutoPublish: true, isTest: true },
  });
  const chatId = tournament?.telegramChannelId || tournament?.telegramGroupId;
  if (!tournament || !chatId || !tournament.telegramAutoPublish || tournament.isTest) {
    return { status: "skipped" as const, reason: "not-configured" as const };
  }
  const message = await buildTournamentBulletin(tournamentId);
  if (!message) return { status: "skipped" as const, reason: "not-found" as const };
  return publishTournamentRichDraft({ tournamentId, chatId, kind: "bulletin", message });
}

export async function publishTournamentResult(matchId: string) {
  const match = await db.match.findUnique({
    where: { id: matchId },
    include: {
      tournament: true,
      stage: { select: { name: true } },
      player1: { select: { name: true, telegramUsername: true, email: true } },
      player2: { select: { name: true, telegramUsername: true, email: true } },
      winner: { select: { name: true, telegramUsername: true, email: true } },
      participant1Entry: { select: { clubName: true } },
      participant2Entry: { select: { clubName: true } },
      winningEntry: { select: { clubName: true } },
    },
  });
  const url = match ? tournamentUrl(match.tournamentId) : null;
  const chatId = match?.tournament.telegramChannelId || match?.tournament.telegramGroupId;
  if (
    !match || !url || !chatId || !match.tournament.telegramAutoPublish || match.tournament.isTest ||
    match.player1Score === null || match.player2Score === null
  ) {
    return { status: "skipped" as const, reason: "not-configured" as const };
  }

  const penaltyScore = match.player1PenaltyScore !== null && match.player2PenaltyScore !== null
    ? `${match.player1PenaltyScore}:${match.player2PenaltyScore}`
    : null;
  return publishTournamentRichDraft({
    tournamentId: match.tournamentId,
    chatId,
    kind: `result:${match.id}`,
    message: buildResultMessage({
      tournamentTitle: match.tournament.title,
      stageName: match.stage?.name,
      round: match.round,
      playerOne: sideName(match.participant1Entry, match.player1),
      playerTwo: sideName(match.participant2Entry, match.player2),
      playerOneScore: match.player1Score,
      playerTwoScore: match.player2Score,
      penaltyScore,
      winnerName: match.winner ? sideName(match.winningEntry, match.winner) : null,
      coverImage: match.tournament.coverImage,
      tournamentUrl: url,
    }),
  });
}

export async function publishTournamentCompletion(tournamentId: string) {
  const tournament = await db.tournament.findUnique({
    where: { id: tournamentId },
    include: {
      participants: { where: { status: ParticipantStatus.CONFIRMED }, select: { id: true } },
      matches: {
        where: { status: { in: [MatchStatus.CONFIRMED, MatchStatus.FINISHED] } },
        orderBy: [{ round: "desc" }, { updatedAt: "desc" }],
        include: { winner: { select: { name: true, telegramUsername: true, email: true } } },
      },
    },
  });
  const url = tournamentUrl(tournamentId);
  const chatId = tournament?.telegramChannelId || tournament?.telegramGroupId;
  if (!tournament || !url || !chatId || !tournament.telegramAutoPublish || tournament.isTest) {
    return { status: "skipped" as const, reason: "not-configured" as const };
  }
  const final = tournament.matches.find((match) => !match.isThirdPlaceMatch && match.winnerId) ?? null;
  return publishTournamentRichDraft({
    tournamentId,
    chatId,
    kind: "completion",
    message: buildCompletionMessage({
      tournamentTitle: tournament.title,
      winnerName: final?.winner ? playerName(final.winner) : null,
      participantsCount: tournament.participants.length,
      matchesCount: tournament.matches.length,
      coverImage: tournament.coverImage,
      tournamentUrl: url,
    }),
  });
}
