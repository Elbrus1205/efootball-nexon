import { randomBytes } from "node:crypto";
import { NotificationType, ParticipantStatus, Prisma, TeamInviteStatus, TournamentStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { createNotification } from "@/lib/services/notifications";
import { syncTournamentLifecycleStatus, syncTournamentPreviewGroups } from "@/lib/services/tournaments";
import { tgEmoji, tgEmojiId } from "@/lib/telegram-emoji";
import type { TelegramRichMessageDraft } from "@/lib/telegram-rich";

// Telegram limits callback_data to 64 bytes. We keep the payload tiny: a short
// verb plus, for stateless actions, an id — or an opaque one-time token for
// sensitive actions (score confirmation) whose details live in the DB.
export const CALLBACK_ACTIONS = {
  inviteAccept: "inv_acc",
  inviteDecline: "inv_dec",
  remindLater: "rem_1h",
  token: "tok",
} as const;

// Token-backed action verbs (stored in TelegramCallbackToken.action).
export const TOKEN_ACTIONS = {
  confirmScore: "confirm_score",
} as const;

const REMIND_LATER_DELAY_MS = 60 * 60 * 1000;
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

export type CallbackActionResult = {
  // Short toast shown on the tapped button.
  toast: string;
  // When true, the message's inline keyboard is cleared so the action can't be re-tapped.
  clearKeyboard?: boolean;
  showAlert?: boolean;
};

function buildCallbackData(action: string, arg?: string) {
  const data = arg ? `${action}:${arg}` : action;
  // Guard the 64-byte Telegram limit; ids are cuids (~25 chars) so this is headroom, not a real cap.
  return data.length <= 64 ? data : data.slice(0, 64);
}

export function inviteAcceptCallback(tournamentId: string) {
  return buildCallbackData(CALLBACK_ACTIONS.inviteAccept, tournamentId);
}

export function inviteDeclineCallback(tournamentId: string) {
  return buildCallbackData(CALLBACK_ACTIONS.inviteDecline, tournamentId);
}

export function remindLaterCallback(matchId: string) {
  return buildCallbackData(CALLBACK_ACTIONS.remindLater, matchId);
}

export function tokenCallback(token: string) {
  return buildCallbackData(CALLBACK_ACTIONS.token, token);
}

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function formatScore(player1Score: number, player2Score: number, penalty1?: number, penalty2?: number) {
  const base = `${player1Score}:${player2Score}`;
  return penalty1 !== undefined && penalty2 !== undefined ? `${base} (пен. ${penalty1}:${penalty2})` : base;
}

/**
 * Builds the "opponent submitted a result" message with a one-time
 * "Подтвердить счёт X:Y" callback button. The token binds the confirmation to
 * this exact score, this match, and the confirming user; tapping it re-submits
 * the identical score on their behalf so the two submissions match and the match
 * is confirmed. Single-use, so a double-tap is a no-op.
 */
export async function buildScoreConfirmMessage(input: {
  opponentUserId: string;
  matchId: string;
  tournamentId: string;
  tournamentTitle: string;
  // Human-readable label for each side, e.g. "Реал Мадрид (Иван)". player1Score
  // belongs to side1Label, player2Score to side2Label.
  side1Label: string;
  side2Label: string;
  player1Score: number;
  player2Score: number;
  player1PenaltyScore?: number;
  player2PenaltyScore?: number;
  matchUrl: string | null;
}): Promise<TelegramRichMessageDraft> {
  const scoreLabel = formatScore(input.player1Score, input.player2Score, input.player1PenaltyScore, input.player2PenaltyScore);
  const hasPenalty = input.player1PenaltyScore !== undefined && input.player2PenaltyScore !== undefined;
  const side1Score = hasPenalty ? `${input.player1Score} (пен. ${input.player1PenaltyScore})` : String(input.player1Score);
  const side2Score = hasPenalty ? `${input.player2Score} (пен. ${input.player2PenaltyScore})` : String(input.player2Score);
  const token = await createCallbackToken({
    userId: input.opponentUserId,
    action: TOKEN_ACTIONS.confirmScore,
    matchId: input.matchId,
    tournamentId: input.tournamentId,
    payload: {
      player1Score: input.player1Score,
      player2Score: input.player2Score,
      ...(input.player1PenaltyScore !== undefined ? { player1PenaltyScore: input.player1PenaltyScore } : {}),
      ...(input.player2PenaltyScore !== undefined ? { player2PenaltyScore: input.player2PenaltyScore } : {}),
    },
  });

  const buttons: TelegramRichMessageDraft["buttons"] = [
    // Keep the button compact (callback_data is capped at 64 bytes and long club
    // names would bloat it); the club-to-score mapping is spelled out in the body.
    { text: `Подтвердить счёт ${scoreLabel}`, callbackData: tokenCallback(token), row: 1 },
  ];
  if (input.matchUrl) {
    buttons.push({ text: "Открыть матч", url: input.matchUrl, row: 2, iconCustomEmojiId: tgEmojiId("gamepad") });
  }

  return {
    blocks: [
      { type: "section_heading", text: "Соперник отправил результат" },
      { type: "blockquote", text: `${input.tournamentTitle}: соперник указал такой счёт. Проверьте, за какой клуб он записан, и подтвердите, если согласны.` },
      {
        type: "table",
        columns: ["Клуб (игрок)", "Голы"],
        rows: [
          [input.side1Label, side1Score],
          [input.side2Label, side2Score],
        ],
      },
      { type: "footer", text: "Если счёт неверный — откройте матч и введите свой вариант." },
    ],
    fallbackText: [
      `${tgEmoji("gamepad")} <b>Соперник отправил результат</b>`,
      `${tgEmoji("crown")} ${escapeHtml(input.tournamentTitle)}`,
      "",
      `${tgEmoji("chart")} <b>${escapeHtml(input.side1Label)}</b> — ${escapeHtml(side1Score)}`,
      `${tgEmoji("chart")} <b>${escapeHtml(input.side2Label)}</b> — ${escapeHtml(side2Score)}`,
      "",
      `${tgEmoji("info")} Проверьте, за какой клуб счёт, и подтвердите — или откройте матч и введите свой вариант.`,
    ].join("\n"),
    buttons,
  };
}

/**
 * Appends a "Напомнить через час" callback button to an existing match draft,
 * placed on a new row below whatever link button the draft already carries.
 */
export function withRemindLaterButton(draft: TelegramRichMessageDraft, matchId: string): TelegramRichMessageDraft {
  const existing = draft.buttons ?? [];
  const nextRow = existing.reduce((max, button) => Math.max(max, button.row), 0) + 1;
  return {
    ...draft,
    buttons: [...existing, { text: "Напомнить через час", callbackData: remindLaterCallback(matchId), row: nextRow }],
  };
}

/**
 * Roster invitation message with interactive Accept / Decline callback buttons,
 * plus a link button to open the tournament on the site.
 */
export function buildRosterInviteMessage(input: {
  tournamentId: string;
  tournamentTitle: string;
  tournamentUrl: string | null;
}): TelegramRichMessageDraft {
  const buttons: TelegramRichMessageDraft["buttons"] = [
    { text: "Принять", callbackData: inviteAcceptCallback(input.tournamentId), row: 1 },
    { text: "Отклонить", callbackData: inviteDeclineCallback(input.tournamentId), row: 1 },
  ];
  if (input.tournamentUrl) {
    buttons.push({ text: "Открыть турнир", url: input.tournamentUrl, row: 2, iconCustomEmojiId: tgEmojiId("crown") });
  }

  return {
    blocks: [
      { type: "section_heading", text: "Приглашение в состав" },
      { type: "blockquote", text: `${input.tournamentTitle}: капитан приглашает вас в состав команды.` },
      { type: "footer", text: "Ответьте прямо здесь или откройте турнир на платформе." },
    ],
    fallbackText: [
      `${tgEmoji("crown")} <b>Приглашение в состав</b>`,
      "",
      `${tgEmoji("gamepad")} ${escapeHtml(input.tournamentTitle)}: капитан приглашает вас в состав команды.`,
    ].join("\n"),
    buttons,
  };
}

/**
 * Mints a single-use token for a sensitive callback action (e.g. score
 * confirmation). The button only carries the token; all details live in the row.
 */
export async function createCallbackToken(params: {
  userId: string;
  action: string;
  matchId?: string;
  tournamentId?: string;
  payload?: Prisma.InputJsonValue;
  ttlMs?: number;
}) {
  const token = randomBytes(18).toString("base64url");
  await db.telegramCallbackToken.create({
    data: {
      token,
      userId: params.userId,
      action: params.action,
      matchId: params.matchId ?? null,
      tournamentId: params.tournamentId ?? null,
      payload: params.payload,
      expiresAt: new Date(Date.now() + (params.ttlMs ?? TOKEN_TTL_MS)),
    },
  });
  return token;
}

// --- Reusable invitation logic (no session; keyed by userId for Telegram) ---

class InviteActionError extends Error {}

async function respondToRosterInvite(userId: string, tournamentId: string, action: "accept" | "decline"): Promise<CallbackActionResult> {
  const invite = await db.tournamentRegistrationMember.findFirst({
    where: { tournamentId, userId, status: TeamInviteStatus.PENDING },
    include: {
      tournament: { select: { id: true, title: true, status: true, rosterSize: true, notificationsEnabled: true } },
      registration: { select: { id: true, userId: true } },
    },
  });

  if (!invite) return { toast: "Активное приглашение не найдено." };
  if (invite.tournament.status !== TournamentStatus.REGISTRATION_OPEN) {
    return { toast: "Приглашение уже недоступно.", clearKeyboard: true };
  }

  if (action === "decline") {
    const declined = await db.tournamentRegistrationMember.updateMany({
      where: { id: invite.id, status: TeamInviteStatus.PENDING },
      data: { status: TeamInviteStatus.DECLINED, respondedAt: new Date() },
    });
    return declined.count === 1
      ? { toast: "Вы отклонили приглашение.", clearKeyboard: true }
      : { toast: "Приглашение уже обработано.", clearKeyboard: true };
  }

  try {
    await db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`tournament-roster:${invite.registrationId}`}))`;

      const current = await tx.tournamentRegistrationMember.findUnique({
        where: { id: invite.id },
        select: { status: true, registrationId: true, tournament: { select: { status: true, rosterSize: true } } },
      });
      if (!current || current.status !== TeamInviteStatus.PENDING) throw new InviteActionError("Приглашение уже обработано.");
      if (current.tournament.status !== TournamentStatus.REGISTRATION_OPEN) throw new InviteActionError("Регистрация уже закрыта.");

      const acceptedBefore = await tx.tournamentRegistrationMember.count({
        where: { registrationId: current.registrationId, status: TeamInviteStatus.ACCEPTED },
      });
      if (acceptedBefore >= current.tournament.rosterSize) throw new InviteActionError("В составе уже нет свободных мест.");

      const accepted = await tx.tournamentRegistrationMember.updateMany({
        where: { id: invite.id, status: TeamInviteStatus.PENDING },
        data: { status: TeamInviteStatus.ACCEPTED, respondedAt: new Date() },
      });
      if (accepted.count !== 1) throw new InviteActionError("Приглашение уже обработано.");

      await tx.tournamentRegistration.update({
        where: { id: current.registrationId },
        data: {
          status: acceptedBefore + 1 >= current.tournament.rosterSize ? ParticipantStatus.CONFIRMED : ParticipantStatus.PENDING,
        },
      });
    });
  } catch (error) {
    if (error instanceof InviteActionError) return { toast: error.message, clearKeyboard: true };
    throw error;
  }

  await syncTournamentPreviewGroups(tournamentId).catch(() => null);
  await syncTournamentLifecycleStatus(tournamentId).catch(() => null);

  if (invite.tournament.notificationsEnabled) {
    await createNotification({
      userId: invite.registration.userId,
      title: "Игрок принял приглашение",
      body: `${invite.tournament.title}: игрок присоединился к составу.`,
      type: NotificationType.TOURNAMENT,
      link: `/tournaments/${invite.tournament.id}`,
      dedupeWithinHours: 1,
    }).catch(() => null);
  }

  return { toast: "Вы приняли приглашение в состав.", clearKeyboard: true };
}

async function scheduleMatchReminderLater(userId: string, matchId: string): Promise<CallbackActionResult> {
  const match = await db.match.findUnique({
    where: { id: matchId },
    select: { id: true, player1Id: true, player2Id: true, tournament: { select: { id: true, title: true, notificationsEnabled: true } } },
  });
  if (!match) return { toast: "Матч не найден." };
  if (match.player1Id !== userId && match.player2Id !== userId) return { toast: "Это не ваш матч." };
  if (!match.tournament.notificationsEnabled) return { toast: "Уведомления для турнира отключены.", clearKeyboard: true };

  // A delayed notification: the outbox delivers it once availableAt passes.
  await createNotification({
    userId,
    title: "Напоминание о матче",
    body: `${match.tournament.title}: не забудьте сыграть матч и отправить результат.`,
    type: NotificationType.MATCH,
    link: `/tournaments/${match.tournament.id}?tab=my-matches`,
    dedupeKey: `remind-later:${matchId}:${userId}:${Math.floor(Date.now() / REMIND_LATER_DELAY_MS)}`,
    availableInMs: REMIND_LATER_DELAY_MS,
  }).catch(() => null);

  return { toast: "Напомним через час.", clearKeyboard: true };
}

async function consumeTokenAction(userId: string, token: string): Promise<CallbackActionResult> {
  // Atomically claim the token so a double-tap can't run the action twice.
  const now = new Date();
  const claim = await db.telegramCallbackToken.updateMany({
    where: { token, userId, usedAt: null, expiresAt: { gt: now } },
    data: { usedAt: now },
  });
  if (claim.count !== 1) return { toast: "Действие уже выполнено или срок истёк.", clearKeyboard: true };

  const record = await db.telegramCallbackToken.findUnique({ where: { token } });
  if (!record) return { toast: "Действие недоступно.", clearKeyboard: true };

  if (record.action === TOKEN_ACTIONS.confirmScore) {
    return confirmScoreFromToken(userId, record);
  }

  return { toast: "Действие принято.", clearKeyboard: true };
}

async function confirmScoreFromToken(
  userId: string,
  record: { matchId: string | null; payload: Prisma.JsonValue },
): Promise<CallbackActionResult> {
  if (!record.matchId) return { toast: "Матч не найден.", clearKeyboard: true };

  const payload = (record.payload ?? {}) as {
    player1Score?: number;
    player2Score?: number;
    player1PenaltyScore?: number;
    player2PenaltyScore?: number;
  };
  if (typeof payload.player1Score !== "number" || typeof payload.player2Score !== "number") {
    return { toast: "Счёт недоступен.", clearKeyboard: true };
  }

  const match = await db.match.findUnique({
    where: { id: record.matchId },
    select: {
      id: true,
      player1Id: true,
      player2Id: true,
      tournamentId: true,
      tournament: { select: { title: true, notificationsEnabled: true } },
    },
  });
  if (!match) return { toast: "Матч не найден.", clearKeyboard: true };
  if (match.player1Id !== userId && match.player2Id !== userId) {
    return { toast: "Это не ваш матч.", clearKeyboard: true };
  }

  // Deferred imports keep this sensitive module out of the top-level import cycle
  // (finalize -> tournaments -> telegram-callbacks) and off the hot path.
  const { submitMatchResultAtomically, MatchSubmissionWriteError } = await import("@/lib/tournaments/submit-match-result");
  const { finalizeConfirmedMatch } = await import("@/lib/tournaments/finalize-confirmed-match");

  let outcome;
  try {
    outcome = await submitMatchResultAtomically(match.id, userId, {
      player1Score: payload.player1Score,
      player2Score: payload.player2Score,
      player1PenaltyScore: payload.player1PenaltyScore,
      player2PenaltyScore: payload.player2PenaltyScore,
    });
  } catch (error) {
    if (error instanceof MatchSubmissionWriteError) return { toast: error.message, clearKeyboard: true };
    throw error;
  }

  if (outcome.state === "confirmed") {
    await finalizeConfirmedMatch({
      match,
      winnerId: outcome.winnerId,
      player1Score: outcome.player1Score,
      player2Score: outcome.player2Score,
    });
    return { toast: "Счёт подтверждён. Результат матча зафиксирован.", clearKeyboard: true };
  }

  if (outcome.state === "disputed") {
    return { toast: "Счёт не совпал — матч передан администратору.", clearKeyboard: true };
  }

  if (outcome.state === "retry") {
    return { toast: "Счёт не совпал. Откройте матч и введите свой вариант.", clearKeyboard: true };
  }

  return { toast: "Результат сохранён.", clearKeyboard: true };
}

/**
 * Routes a decoded callback_data string to its handler. `userId` is the platform
 * user resolved from the Telegram sender. Returns a toast + whether to clear the
 * message keyboard. Throws only on unexpected DB errors (caller answers the query).
 */
export async function handleTelegramCallbackAction(params: {
  userId: string;
  data: string;
}): Promise<CallbackActionResult> {
  const [action, arg] = params.data.split(":");

  switch (action) {
    case CALLBACK_ACTIONS.inviteAccept:
      return arg ? respondToRosterInvite(params.userId, arg, "accept") : { toast: "Некорректное действие." };
    case CALLBACK_ACTIONS.inviteDecline:
      return arg ? respondToRosterInvite(params.userId, arg, "decline") : { toast: "Некорректное действие." };
    case CALLBACK_ACTIONS.remindLater:
      return arg ? scheduleMatchReminderLater(params.userId, arg) : { toast: "Некорректное действие." };
    case CALLBACK_ACTIONS.token:
      return arg ? consumeTokenAction(params.userId, arg) : { toast: "Некорректное действие." };
    default:
      return { toast: "Неизвестное действие." };
  }
}
