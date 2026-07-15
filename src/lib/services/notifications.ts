import { NotificationType } from "@prisma/client";
import { getConfiguredSiteBaseUrl } from "@/lib/affiliate";
import { db } from "@/lib/db";
import { isTelegramRecipientUnavailableError, sendTelegramRichMessageWithFallback } from "@/lib/telegram-bot";
import { buildTelegramInlineKeyboard } from "@/lib/telegram-format";
import { buildNotificationRichMessage, type TelegramRichMessageDraft } from "@/lib/telegram-rich";
import { repairMojibake } from "@/lib/text-encoding";
import { sendWebPushNotification } from "@/lib/services/web-push";

export async function createNotification({
  userId,
  title,
  body,
  type,
  link,
  dedupeKey,
  dedupeWithinHours,
  skipTelegram,
  telegramRichMessage,
}: {
  userId: string;
  title: string;
  body: string;
  type: NotificationType;
  link?: string;
  dedupeKey?: string;
  dedupeWithinHours?: number;
  skipTelegram?: boolean;
  telegramRichMessage?: TelegramRichMessageDraft;
}) {
  const safeTitle = repairMojibake(title);
  const safeBody = repairMojibake(body);

  if (dedupeWithinHours) {
    const existing = await db.notification.findFirst({
      where: {
        userId,
        title: safeTitle,
        body: safeBody,
        link: link ?? null,
        createdAt: {
          gte: new Date(Date.now() - dedupeWithinHours * 60 * 60 * 1000),
        },
      },
      orderBy: { createdAt: "desc" },
    });

    if (existing) {
      return existing;
    }
  }

  const notificationSelect = {
    user: {
      select: {
        telegramId: true,
      },
    },
  };

  let notification = null;
  let shouldDeliver = true;

  if (dedupeKey) {
    const created = await db.notification.createMany({
      data: [{ userId, title: safeTitle, body: safeBody, type, link, dedupeKey }],
      skipDuplicates: true,
    });

    notification = await db.notification.findUnique({
      where: {
        userId_dedupeKey: {
          userId,
          dedupeKey,
        },
      },
      include: notificationSelect,
    });

    shouldDeliver = created.count > 0;
  } else {
    notification = await db.notification.create({
      data: { userId, title: safeTitle, body: safeBody, type, link, dedupeKey },
      include: notificationSelect,
    });
  }

  if (!notification) {
    throw new Error("Failed to create or load notification");
  }

  const payload = {
    id: notification.id,
    userId: notification.userId,
    title: notification.title,
    body: notification.body,
    type: notification.type,
    link: notification.link,
    isRead: notification.isRead,
    createdAt: notification.createdAt,
  };

  if (shouldDeliver) {
    await sendWebPushNotification(userId, {
      title: safeTitle,
      body: safeBody,
      link,
      tag: dedupeKey || notification.id,
    }).catch((error) => {
      console.error("Failed to deliver phone push notification", error);
    });
  }

  if (shouldDeliver && !skipTelegram && notification.user.telegramId && process.env.TELEGRAM_BOT_TOKEN) {
    const absoluteLink = buildAbsoluteNotificationLink(link);
    const richMessage = telegramRichMessage ?? buildNotificationRichMessage({
        title: safeTitle,
        body: safeBody,
        typeLabel: getTelegramNotificationTypeLabel(notification.type),
        url: absoluteLink,
        buttonText: absoluteLink ? getTelegramNotificationButtonText(notification.type) : null,
      });
    await sendTelegramRichMessageWithFallback({
      chatId: notification.user.telegramId,
      message: richMessage,
      replyMarkup: buildTelegramInlineKeyboard(richMessage.buttons ?? []),
    }).catch((error) => {
      if (isTelegramRecipientUnavailableError(error)) {
        if (process.env.TELEGRAM_DEBUG === "true") {
          console.warn("Telegram notification skipped: recipient is unavailable", {
            userId,
            telegramId: notification.user.telegramId,
          });
        }
        return;
      }

      console.error("Failed to send Telegram notification", error);
    });
  }

  return payload;
}

export async function createNotificationsForUsers({
  userIds,
  title,
  body,
  type,
  link,
  dedupeKey,
  dedupeWithinHours,
}: {
  userIds: string[];
  title: string;
  body: string;
  type: NotificationType;
  link?: string;
  dedupeKey?: string;
  dedupeWithinHours?: number;
}) {
  const uniqueUserIds = Array.from(new Set(userIds.filter(Boolean)));

  return Promise.all(
    uniqueUserIds.map((userId) =>
      createNotification({
        userId,
        title,
        body,
        type,
        link,
        dedupeKey,
        dedupeWithinHours,
      }),
    ),
  );
}

export async function createNotificationForAllUsers({
  title,
  body,
  type,
  link,
  dedupeWithinHours,
}: {
  title: string;
  body: string;
  type: NotificationType;
  link?: string;
  dedupeWithinHours?: number;
}) {
  const users = await db.user.findMany({
    where: {
      isBanned: false,
    },
    select: {
      id: true,
    },
  });

  return createNotificationsForUsers({
    userIds: users.map((user) => user.id),
    title,
    body,
    type,
    link,
    dedupeWithinHours,
  });
}

function getTelegramNotificationTypeLabel(type: NotificationType) {
  if (type === NotificationType.TOURNAMENT) return "Турнирное уведомление";
  if (type === NotificationType.MATCH) return "Матчевое уведомление";
  if (type === NotificationType.RESULT) return "Результат матча";
  return "Системное уведомление";
}

function getTelegramNotificationButtonText(type: NotificationType) {
  if (type === NotificationType.TOURNAMENT) return "🏆 Открыть турнир";
  if (type === NotificationType.MATCH) return "🎮 Открыть матч";
  if (type === NotificationType.RESULT) return "📊 Открыть результат";
  return "🌐 Открыть на сайте";
}

function buildAbsoluteNotificationLink(link?: string | null) {
  const appUrl = getConfiguredSiteBaseUrl();
  return link && appUrl ? new URL(link, appUrl).toString() : "";
}
