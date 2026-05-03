import Pusher from "pusher";
import { NotificationType } from "@prisma/client";
import { getConfiguredSiteBaseUrl } from "@/lib/affiliate";
import { db } from "@/lib/db";
import { sendTelegramMessage } from "@/lib/telegram-bot";
import { buildTelegramInlineKeyboard } from "@/lib/telegram-format";
import { repairMojibake } from "@/lib/text-encoding";

const pusher =
  process.env.PUSHER_APP_ID && process.env.PUSHER_KEY && process.env.PUSHER_SECRET && process.env.PUSHER_CLUSTER
    ? new Pusher({
        appId: process.env.PUSHER_APP_ID,
        key: process.env.PUSHER_KEY,
        secret: process.env.PUSHER_SECRET,
        cluster: process.env.PUSHER_CLUSTER,
        useTLS: true,
      })
    : null;

export async function createNotification({
  userId,
  title,
  body,
  type,
  link,
  dedupeWithinHours,
}: {
  userId: string;
  title: string;
  body: string;
  type: NotificationType;
  link?: string;
  dedupeWithinHours?: number;
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

  const notification = await db.notification.create({
    data: { userId, title: safeTitle, body: safeBody, type, link },
    include: {
      user: {
        select: {
          telegramId: true,
        },
      },
    },
  });

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

  if (pusher) {
    await pusher.trigger(`user-${userId}`, "notification:new", payload).catch((error) => {
      console.error("Failed to push notification", error);
    });
  }

  if (notification.user.telegramId && process.env.TELEGRAM_BOT_TOKEN) {
    const absoluteLink = buildAbsoluteNotificationLink(link);
    await sendTelegramMessage({
      chatId: notification.user.telegramId,
      text: buildTelegramNotificationText(safeTitle, safeBody),
      disableWebPagePreview: true,
      replyMarkup: absoluteLink
        ? buildTelegramInlineKeyboard([
            {
              text: "Открыть на сайте",
              url: absoluteLink,
              row: 1,
            },
          ])
        : undefined,
    }).catch((error) => {
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
  dedupeWithinHours,
}: {
  userIds: string[];
  title: string;
  body: string;
  type: NotificationType;
  link?: string;
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

function buildTelegramNotificationText(title: string, body: string) {
  const safeTitle = escapeTelegramHtml(title);
  const safeBody = escapeTelegramHtml(body);

  if (!safeBody) {
    return `<b>${safeTitle}</b>`;
  }

  return [`<b>${safeTitle}</b>`, `<blockquote>${safeBody}</blockquote>`].join("\n\n");
}

function buildAbsoluteNotificationLink(link?: string | null) {
  const appUrl = getConfiguredSiteBaseUrl();
  return link && appUrl ? new URL(link, appUrl).toString() : "";
}

function escapeTelegramHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
