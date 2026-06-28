import { NotificationType } from "@prisma/client";
import { getConfiguredSiteBaseUrl } from "@/lib/affiliate";
import type { SecurityContext } from "@/lib/auth/security";
import { db } from "@/lib/db";
import { createNotification } from "@/lib/services/notifications";
import { isTelegramRecipientUnavailableError, sendTelegramMessage } from "@/lib/telegram-bot";
import { buildTelegramInlineKeyboard } from "@/lib/telegram-format";
import { tgEmoji } from "@/lib/telegram-emoji";

type AuthNotificationProvider = "email" | "vkid" | "telegram";

type UserForSecurityNotification = {
  id: string;
  publicId: string;
  name: string | null;
  email: string | null;
  emailVerified: Date | null;
  telegramId: string | null;
  telegramUsername: string | null;
  vkId: string | null;
  role: string;
  createdAt: Date;
};

const MOSCOW_TIME_ZONE = "Europe/Moscow";
const EMAIL_REMINDER_DEDUPE_HOURS = 24;

export async function notifySuccessfulLogin(params: {
  userId: string;
  provider: AuthNotificationProvider;
  context: SecurityContext;
}) {
  if (!process.env.TELEGRAM_BOT_TOKEN) {
    await maybeCreateEmailReminder(params.userId);
    return;
  }

  const user = await getSecurityNotificationUser(params.userId);
  if (!user) return;

  await Promise.allSettled([
    sendLoginTelegramNotification({ user, provider: params.provider, context: params.context }),
    sendEmailVerificationReminder(user),
  ]);
}

async function maybeCreateEmailReminder(userId: string) {
  const user = await getSecurityNotificationUser(userId);
  if (!user) return null;
  return sendEmailVerificationReminder(user);
}

export async function sendPendingEmailVerificationReminders() {
  const users = await db.user.findMany({
    where: {
      isBanned: false,
      email: { not: null },
      emailVerified: null,
    },
    select: {
      id: true,
      publicId: true,
      name: true,
      email: true,
      emailVerified: true,
      telegramId: true,
      telegramUsername: true,
      vkId: true,
      role: true,
      createdAt: true,
    },
  });

  const results = await Promise.allSettled(users.map((user) => sendEmailVerificationReminder(user)));
  return {
    checked: users.length,
    sentOrSkipped: results.filter((result) => result.status === "fulfilled").length,
    failed: results.filter((result) => result.status === "rejected").length,
  };
}

async function getSecurityNotificationUser(userId: string) {
  return db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      publicId: true,
      name: true,
      email: true,
      emailVerified: true,
      telegramId: true,
      telegramUsername: true,
      vkId: true,
      role: true,
      createdAt: true,
    },
  });
}

async function sendLoginTelegramNotification(params: {
  user: UserForSecurityNotification;
  provider: AuthNotificationProvider;
  context: SecurityContext;
}) {
  if (!params.user.telegramId) return;

  const profileName = params.user.name || params.user.email || `Игрок #${params.user.publicId}`;
  const text = [
    `${tgEmoji("lock")} <b>Вход в аккаунт</b>`,
    `<blockquote>${tgEmoji("warning")} Если это были не вы — срочно смените пароль и завершите лишние сессии в настройках безопасности.</blockquote>`,
    "",
    `${tgEmoji("smile")} <b>Аккаунт:</b> ${escapeTelegramHtml(profileName)}`,
    `${tgEmoji("bookmark")} <b>ID игрока:</b> <code>${escapeTelegramHtml(params.user.publicId)}</code>`,
    `${tgEmoji("link")} <b>Способ входа:</b> ${escapeTelegramHtml(getProviderLabel(params.provider))}`,
    `${tgEmoji("calendar")} <b>Дата и время:</b> ${escapeTelegramHtml(formatDateTime(new Date()))}`,
    "",
    `${tgEmoji("monitor")} <b>Данные входа</b>`,
    `${tgEmoji("globe")} IP: <code>${escapeTelegramHtml(params.context.ipAddress || "не определен")}</code>`,
    `${tgEmoji("gamepad")} Устройство: ${escapeTelegramHtml(params.context.device || "не определено")}`,
    `${tgEmoji("gear")} Платформа: ${escapeTelegramHtml(params.context.platform || "не определена")}`,
    `${tgEmoji("location")} Локация: ${escapeTelegramHtml(params.context.location || "не определена")}`,
    `${tgEmoji("paperclip")} User-Agent: <code>${escapeTelegramHtml(limitText(params.context.userAgent || "не определен", 700))}</code>`,
    "",
    `${tgEmoji("shield")} <b>Привязки</b>`,
    `${tgEmoji("envelope")} Email: ${escapeTelegramHtml(params.user.email || "не привязан")}`,
    `${params.user.emailVerified ? tgEmoji("check") : tgEmoji("cross")} Email подтвержден: ${params.user.emailVerified ? "да" : "нет"}`,
    `${tgEmoji("speechBubble")} Telegram: ${escapeTelegramHtml(params.user.telegramUsername ? `@${params.user.telegramUsername}` : "привязан")}`,
    `${params.user.vkId ? tgEmoji("check") : tgEmoji("cross")} VK: ${params.user.vkId ? "привязан" : "не привязан"}`,
    `${tgEmoji("crown")} Роль: ${escapeTelegramHtml(params.user.role)}`,
  ].join("\n");

  await sendTelegramMessage({
    chatId: params.user.telegramId,
    text,
    disableWebPagePreview: true,
    replyMarkup: buildTelegramButton("🛡 Открыть безопасность", "/dashboard/security"),
  }).catch((error) => {
    if (isTelegramRecipientUnavailableError(error)) {
      console.warn("Login Telegram notification skipped: recipient is unavailable", {
        userId: params.user.id,
        telegramId: params.user.telegramId,
      });
      return;
    }

    console.error("Failed to send login Telegram notification", error);
  });
}

export async function sendEmailVerificationReminder(user: UserForSecurityNotification) {
  if (!user.email || user.emailVerified) return null;

  const notification = await createNotification({
    userId: user.id,
    type: NotificationType.SYSTEM,
    title: "Подтвердите email",
    body: "Ради безопасности аккаунта подтвердите email. Так вы сможете восстановить доступ и получать важные уведомления.",
    link: "/dashboard/security",
    dedupeWithinHours: EMAIL_REMINDER_DEDUPE_HOURS,
    skipTelegram: true,
  });

  if (!user.telegramId || !process.env.TELEGRAM_BOT_TOKEN) return notification;

  const createdAt = "createdAt" in notification ? new Date(notification.createdAt) : new Date();
  const wasJustCreated = Date.now() - createdAt.getTime() < 60_000;
  if (!wasJustCreated) return notification;

  await sendTelegramMessage({
    chatId: user.telegramId,
    text: [
      `${tgEmoji("shield")} <b>Подтвердите email</b>`,
      `<blockquote>${tgEmoji("bulb")} Ради безопасности аккаунта подтвердите email. Это поможет восстановить доступ и получать важные сообщения.</blockquote>`,
      "",
      `${tgEmoji("envelope")} <b>Email:</b> ${escapeTelegramHtml(user.email)}`,
      `${tgEmoji("hourglass")} <b>Напоминание:</b> не чаще 1 раза в 24 часа`,
    ].join("\n"),
    disableWebPagePreview: true,
    replyMarkup: buildTelegramButton("✉️ Подтвердить email", "/dashboard/security"),
  }).catch((error) => {
    if (isTelegramRecipientUnavailableError(error)) {
      console.warn("Email verification Telegram reminder skipped: recipient is unavailable", {
        userId: user.id,
        telegramId: user.telegramId,
      });
      return;
    }

    console.error("Failed to send email verification Telegram reminder", error);
  });

  return notification;
}

function buildTelegramButton(text: string, path: string) {
  const url = buildAbsoluteUrl(path);
  if (!url) return undefined;

  return buildTelegramInlineKeyboard([{ text, url, row: 1 }]);
}

function buildAbsoluteUrl(path: string) {
  const baseUrl = getConfiguredSiteBaseUrl();
  return baseUrl ? new URL(path, baseUrl).toString() : null;
}

function getProviderLabel(provider: AuthNotificationProvider) {
  switch (provider) {
    case "email":
      return "Email и пароль";
    case "vkid":
      return "VK ID";
    case "telegram":
      return "Telegram";
  }
}

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "long",
    timeStyle: "medium",
    timeZone: MOSCOW_TIME_ZONE,
  }).format(date);
}

function limitText(value: string, maxLength: number) {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value;
}

function escapeTelegramHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
