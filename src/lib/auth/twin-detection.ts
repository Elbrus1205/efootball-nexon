import { createHash } from "crypto";
import { LoginAttemptStatus, UserRole } from "@prisma/client";
import { getConfiguredSiteBaseUrl } from "@/lib/affiliate";
import type { SecurityContext } from "@/lib/auth/security";
import { db } from "@/lib/db";
import { isTelegramRecipientUnavailableError, sendTelegramMessage } from "@/lib/telegram-bot";
import { buildTelegramInlineKeyboard } from "@/lib/telegram-format";
import { tgEmoji } from "@/lib/telegram-emoji";

const MOSCOW_TIME_ZONE = "Europe/Moscow";
const RENOTIFY_AFTER_HOURS = 24;
const TWIN_ALERT_ROLES: UserRole[] = [UserRole.FOUNDER, UserRole.ORGANIZER];

type TwinAccount = {
  id: string;
  publicId: string;
  name: string | null;
  email: string | null;
  telegramUsername: string | null;
  role: UserRole;
  createdAt: Date;
};

/**
 * Проверяет, входили ли с этого устройства (deviceFingerprint) в другие аккаунты,
 * и, если да, уведомляет владельца/организаторов в Telegram. Дедуп по набору
 * аккаунтов, чтобы не слать одно и то же чаще раза в RENOTIFY_AFTER_HOURS часов.
 *
 * Никогда не бросает — вход не должен зависеть от этой проверки.
 */
export async function detectAndNotifyTwins(params: {
  userId: string;
  context: SecurityContext;
}): Promise<void> {
  const fingerprint = params.context.deviceFingerprint;
  if (!fingerprint) return;

  // Все аккаунты, успешно входившие с этого отпечатка.
  const historyRows = await db.loginHistory.findMany({
    where: {
      deviceFingerprint: fingerprint,
      status: LoginAttemptStatus.SUCCESS,
      userId: { not: null },
    },
    select: { userId: true },
    distinct: ["userId"],
  });

  const userIds = Array.from(
    new Set(
      historyRows
        .map((row) => row.userId)
        .filter((id): id is string => Boolean(id))
        .concat(params.userId),
    ),
  );

  // Меньше двух аккаунтов на устройство — это не твинк.
  if (userIds.length < 2) return;

  const sortedIds = [...userIds].sort();
  const accountsKey = createHash("sha256")
    .update(`${fingerprint}:${sortedIds.join(",")}`)
    .digest("hex");

  // Дедуп: если этот же набор уведомляли недавно — выходим.
  const existing = await db.twinAccountAlert.findUnique({ where: { accountsKey } });
  if (existing) {
    const ageMs = Date.now() - existing.lastNotifiedAt.getTime();
    if (ageMs < RENOTIFY_AFTER_HOURS * 60 * 60 * 1000) return;
  }

  const accounts = (await db.user.findMany({
    where: { id: { in: sortedIds } },
    select: {
      id: true,
      publicId: true,
      name: true,
      email: true,
      telegramUsername: true,
      role: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  })) as TwinAccount[];

  if (accounts.length < 2) return;

  const recipients = await getTwinAlertRecipients();
  if (recipients.length === 0) {
    // Некому слать — всё равно фиксируем факт, чтобы не пересчитывать постоянно.
    await upsertAlert({ accountsKey, fingerprint, userIds: sortedIds });
    return;
  }

  const text = buildTwinAlertMessage({ fingerprint, accounts, context: params.context });
  const replyMarkup = buildAdminButton(accounts[0]);

  await Promise.allSettled(
    recipients.map((chatId) =>
      sendTelegramMessage({ chatId, text, disableWebPagePreview: true, replyMarkup }).catch((error) => {
        if (isTelegramRecipientUnavailableError(error)) {
          console.warn("Twin alert skipped: recipient unavailable", { chatId });
          return;
        }
        console.error("Failed to send twin alert", error);
      }),
    ),
  );

  await upsertAlert({ accountsKey, fingerprint, userIds: sortedIds });
}

export async function getTwinAlertRecipients(): Promise<string[]> {
  if (!process.env.TELEGRAM_BOT_TOKEN) return [];

  const recipients = await db.user.findMany({
    where: {
      role: { in: TWIN_ALERT_ROLES },
      telegramId: { not: null },
      isBanned: false,
    },
    select: { telegramId: true },
  });

  return recipients
    .map((user) => user.telegramId)
    .filter((id): id is string => Boolean(id));
}

async function upsertAlert(params: { accountsKey: string; fingerprint: string; userIds: string[] }) {
  await db.twinAccountAlert.upsert({
    where: { accountsKey: params.accountsKey },
    create: {
      accountsKey: params.accountsKey,
      deviceFingerprint: params.fingerprint,
      userIds: params.userIds,
    },
    update: {
      lastNotifiedAt: new Date(),
      userIds: params.userIds,
    },
  });
}

export function buildTwinAlertMessage(params: {
  fingerprint: string;
  accounts: TwinAccount[];
  context: SecurityContext;
}): string {
  const lines: string[] = [
    `${tgEmoji("search")} <b>Обнаружены связанные аккаунты (твинки)</b>`,
    `<blockquote>${tgEmoji("warning")} С одного устройства входили в несколько разных аккаунтов. Проверьте — возможно, это мультиаккаунты.</blockquote>`,
    "",
    `${tgEmoji("monitor")} <b>Отпечаток устройства:</b> <code>${shortFingerprint(params.fingerprint)}</code>`,
    `${tgEmoji("globe")} IP последнего входа: <code>${escapeTelegramHtml(params.context.ipAddress || "не определён")}</code>`,
    `${tgEmoji("gamepad")} Устройство: ${escapeTelegramHtml(params.context.device || "не определено")}`,
    `${tgEmoji("gear")} Платформа: ${escapeTelegramHtml(params.context.platform || "не определена")}`,
    "",
    `${tgEmoji("crown")} <b>Связанные аккаунты (${params.accounts.length}):</b>`,
  ];

  params.accounts.forEach((account, index) => {
    const name = account.name || account.email || `Игрок #${account.publicId}`;
    const telegram = account.telegramUsername ? ` — @${escapeTelegramHtml(account.telegramUsername)}` : "";
    lines.push(
      `${index + 1}. ${escapeTelegramHtml(name)} — ID <code>${escapeTelegramHtml(account.publicId)}</code>${telegram} — ${escapeTelegramHtml(getRoleLabel(account.role))} — рег. ${escapeTelegramHtml(formatDate(account.createdAt))}`,
    );
  });

  return lines.join("\n");
}

function buildAdminButton(account: TwinAccount) {
  const baseUrl = getConfiguredSiteBaseUrl();
  if (!baseUrl) return undefined;

  const url = new URL(`/admin/users?highlight=${encodeURIComponent(account.id)}`, baseUrl).toString();
  return buildTelegramInlineKeyboard([{ text: "👤 Открыть в админке", url, row: 1 }]);
}

function shortFingerprint(value: string) {
  return value.length > 16 ? `${value.slice(0, 16)}…` : value;
}

function getRoleLabel(role: UserRole) {
  switch (role) {
    case UserRole.FOUNDER:
      return "Основатель";
    case UserRole.ORGANIZER:
      return "Организатор";
    case UserRole.ADMIN:
      return "Админ";
    case UserRole.JUDGE:
      return "Судья";
    case UserRole.TRAINEE:
      return "Стажёр";
    case UserRole.PLAYER:
    default:
      return "Игрок";
  }
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "medium",
    timeZone: MOSCOW_TIME_ZONE,
  }).format(date);
}

function escapeTelegramHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Ежедневная сводка: группирует все успешные входы по отпечатку устройства,
 * находит отпечатки с 2+ разными аккаунтами и отправляет один отчёт получателям.
 * Возвращает статистику для ответа cron-роута.
 */
export async function sendDailyTwinReport(): Promise<{ groups: number; recipients: number; sent: boolean }> {
  const rows = await db.loginHistory.findMany({
    where: {
      status: LoginAttemptStatus.SUCCESS,
      userId: { not: null },
      deviceFingerprint: { not: null },
    },
    select: { userId: true, deviceFingerprint: true },
  });

  // fingerprint -> набор userId
  const byFingerprint = new Map<string, Set<string>>();
  for (const row of rows) {
    if (!row.deviceFingerprint || !row.userId) continue;
    const set = byFingerprint.get(row.deviceFingerprint) ?? new Set<string>();
    set.add(row.userId);
    byFingerprint.set(row.deviceFingerprint, set);
  }

  const twinGroups = Array.from(byFingerprint.entries()).filter(([, ids]) => ids.size >= 2);
  if (twinGroups.length === 0) {
    return { groups: 0, recipients: 0, sent: false };
  }

  const recipients = await getTwinAlertRecipients();
  if (recipients.length === 0) {
    return { groups: twinGroups.length, recipients: 0, sent: false };
  }

  // Профили всех задействованных аккаунтов одним запросом.
  const allIds = Array.from(new Set(twinGroups.flatMap(([, ids]) => Array.from(ids))));
  const users = (await db.user.findMany({
    where: { id: { in: allIds } },
    select: {
      id: true,
      publicId: true,
      name: true,
      email: true,
      telegramUsername: true,
      role: true,
      createdAt: true,
    },
  })) as TwinAccount[];
  const usersById = new Map(users.map((user) => [user.id, user]));

  const text = buildDailyReportMessage(twinGroups, usersById);

  await Promise.allSettled(
    recipients.map((chatId) =>
      sendTelegramMessage({ chatId, text, disableWebPagePreview: true }).catch((error) => {
        if (isTelegramRecipientUnavailableError(error)) return;
        console.error("Failed to send daily twin report", error);
      }),
    ),
  );

  return { groups: twinGroups.length, recipients: recipients.length, sent: true };
}

function buildDailyReportMessage(
  twinGroups: Array<[string, Set<string>]>,
  usersById: Map<string, TwinAccount>,
): string {
  const lines: string[] = [
    `${tgEmoji("search")} <b>Ежедневный отчёт: связанные аккаунты</b>`,
    `<blockquote>${tgEmoji("info")} Найдено групп устройств с несколькими аккаунтами: <b>${twinGroups.length}</b></blockquote>`,
  ];

  // Ограничиваем длину сообщения (лимит Telegram — 4096 символов).
  const MAX_GROUPS = 15;
  twinGroups.slice(0, MAX_GROUPS).forEach(([fingerprint, ids], groupIndex) => {
    lines.push("");
    lines.push(`${tgEmoji("monitor")} <b>Группа ${groupIndex + 1}</b> — <code>${shortFingerprint(fingerprint)}</code>`);
    Array.from(ids).forEach((id) => {
      const account = usersById.get(id);
      if (!account) return;
      const name = account.name || account.email || `Игрок #${account.publicId}`;
      const telegram = account.telegramUsername ? ` — @${escapeTelegramHtml(account.telegramUsername)}` : "";
      lines.push(`• ${escapeTelegramHtml(name)} — ID <code>${escapeTelegramHtml(account.publicId)}</code>${telegram}`);
    });
  });

  if (twinGroups.length > MAX_GROUPS) {
    lines.push("");
    lines.push(`${tgEmoji("info")} …и ещё ${twinGroups.length - MAX_GROUPS} групп(ы). Полный список — в админке.`);
  }

  return lines.join("\n");
}
