import { NotificationType } from "@prisma/client";
import { after } from "next/server";
import type { SecurityContext } from "@/lib/auth/security";
import { detectAndNotifyTwins } from "@/lib/auth/twin-detection";
import { db } from "@/lib/db";
import { createNotification } from "@/lib/services/notifications";

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

const EMAIL_REMINDER_DEDUPE_HOURS = 24;

export async function notifySuccessfulLogin(params: {
  userId: string;
  provider: AuthNotificationProvider;
  context: SecurityContext;
}) {
  after(async () => {
    // Проверка на твинки не зависит от привязки Telegram у самого игрока.
    await detectAndNotifyTwins({ userId: params.userId, context: params.context }).catch((error) => {
      console.error("Twin account detection failed", error);
    });

    const user = await getSecurityNotificationUser(params.userId);
    if (!user) return;

    await Promise.allSettled([
      sendLoginTelegramNotification({ user, provider: params.provider, context: params.context }),
      sendEmailVerificationReminder(user),
    ]);
  });
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
  return createNotification({
    userId: params.user.id,
    type: NotificationType.SYSTEM,
    title: "Вход в аккаунт",
    body: [
      `Способ: ${getProviderLabel(params.provider)}.`,
      `IP: ${params.context.ipAddress || "не определен"}.`,
      `Устройство: ${params.context.device || "не определено"}.`,
      "Если это были не вы, смените пароль и завершите лишние сессии.",
    ].join(" "),
    link: "/dashboard/security",
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
    skipTelegram: false,
  });

  return notification;
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
