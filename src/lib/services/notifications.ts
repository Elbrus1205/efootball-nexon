import { NotificationType, Prisma } from "@prisma/client";
import { getConfiguredSiteBaseUrl } from "@/lib/affiliate";
import { db } from "@/lib/db";
import type { TelegramRichMessageDraft } from "@/lib/telegram-rich";
import { repairMojibake } from "@/lib/text-encoding";

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

  let notification = null;
  const storedTelegramPayload = telegramRichMessage
    ? (JSON.parse(JSON.stringify(telegramRichMessage)) as Prisma.InputJsonValue)
    : undefined;
  const deliveryData = {
    skipTelegram: Boolean(skipTelegram),
    ...(storedTelegramPayload ? { telegramPayload: storedTelegramPayload } : {}),
  };

  if (dedupeKey) {
    notification = await db.$transaction(async (tx) => {
      const created = await tx.notification.createMany({
        data: [{ userId, title: safeTitle, body: safeBody, type, link, dedupeKey }],
        skipDuplicates: true,
      });
      const stored = await tx.notification.findUnique({
        where: { userId_dedupeKey: { userId, dedupeKey } },
      });
      if (created.count > 0 && stored) {
        await tx.notificationDelivery.create({ data: { notificationId: stored.id, ...deliveryData } });
      }
      return stored;
    });
  } else {
    notification = await db.$transaction(async (tx) => {
      const stored = await tx.notification.create({
        data: { userId, title: safeTitle, body: safeBody, type, link, dedupeKey },
      });
      await tx.notificationDelivery.create({ data: { notificationId: stored.id, ...deliveryData } });
      return stored;
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

  const results = [];
  for (let index = 0; index < uniqueUserIds.length; index += 8) {
    const batch = uniqueUserIds.slice(index, index + 8);
    results.push(...await Promise.all(
      batch.map((userId) =>
        createNotification({ userId, title, body, type, link, dedupeKey, dedupeWithinHours }),
      ),
    ));
  }
  return results;
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

export function getTelegramNotificationTypeLabel(type: NotificationType) {
  if (type === NotificationType.TOURNAMENT) return "Турнирное уведомление";
  if (type === NotificationType.MATCH) return "Матчевое уведомление";
  if (type === NotificationType.RESULT) return "Результат матча";
  return "Системное уведомление";
}

export function getTelegramNotificationButtonText(type: NotificationType, link?: string | null) {
  if (link?.startsWith("/regulations")) return "Посмотреть изменения";
  if (link?.startsWith("/dashboard/security")) return "Проверить безопасность";
  if (link?.startsWith("/admin/users")) return "Проверить аккаунты";
  if (link?.startsWith("/admin/moderation")) return "Открыть спор";
  if (link?.startsWith("/dashboard/edit")) return "Открыть профиль";
  if (link?.startsWith("/dashboard")) return "Открыть профиль";
  if (link?.startsWith("/ratings")) return "Открыть рейтинг";
  if (type === NotificationType.TOURNAMENT) return "Открыть турнир";
  if (type === NotificationType.MATCH) return "Перейти к матчу";
  if (type === NotificationType.RESULT) return "Посмотреть результат";
  return "Открыть на сайте";
}

export function buildAbsoluteNotificationLink(link?: string | null) {
  const appUrl = getConfiguredSiteBaseUrl();
  return link && appUrl ? new URL(link, appUrl).toString() : "";
}
