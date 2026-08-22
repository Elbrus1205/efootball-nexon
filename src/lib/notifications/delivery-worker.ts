import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import {
  isTelegramRecipientUnavailableError,
  getTelegramRetryAfterMs,
  sendTelegramDraftAsText,
} from "@/lib/telegram-bot";
import { buildTelegramInlineKeyboard } from "@/lib/telegram-format";
import { buildNotificationRichMessage, type TelegramRichMessageDraft } from "@/lib/telegram-rich";
import { getNotificationRetryDelayMs } from "@/lib/notifications/delivery-retry";
import {
  buildAbsoluteNotificationLink,
  getTelegramNotificationButtonText,
  getTelegramNotificationTypeLabel,
} from "@/lib/services/notifications";
import { sendWebPushNotification } from "@/lib/services/web-push";

const LOCK_TIMEOUT_MS = 5 * 60_000;
const DELIVERY_CONCURRENCY = 8;
const MAX_DELIVERY_RUNTIME_MS = 20_000;
const DEFAULT_DELIVERY_LIMIT = 8;
const MAX_DELIVERY_ATTEMPTS = 12;

async function claimDeliveries(limit: number, notificationIds?: string[]) {
  const now = new Date();
  const staleLock = new Date(now.getTime() - LOCK_TIMEOUT_MS);
  const candidates = await db.notificationDelivery.findMany({
    where: {
      ...(notificationIds?.length ? { notificationId: { in: notificationIds } } : {}),
      deliveredAt: null,
      availableAt: { lte: now },
      OR: [{ lockedAt: null }, { lockedAt: { lt: staleLock } }],
    },
    select: { id: true },
    orderBy: { availableAt: "asc" },
    take: limit,
  });
  if (!candidates.length) return [];

  const lockToken = randomUUID();
  await db.notificationDelivery.updateMany({
    where: {
      id: { in: candidates.map((candidate) => candidate.id) },
      deliveredAt: null,
      OR: [{ lockedAt: null }, { lockedAt: { lt: staleLock } }],
    },
    data: { lockedAt: now, lockToken },
  });

  return db.notificationDelivery.findMany({
    where: { lockToken },
    include: {
      notification: {
        include: { user: { select: { telegramId: true } } },
      },
    },
  });
}

async function deliverOne(delivery: Awaited<ReturnType<typeof claimDeliveries>>[number]) {
  const notification = delivery.notification;
  let retryAfterMs: number | undefined;

  try {
    let pushDelivered = Boolean(delivery.pushDeliveredAt);
    let telegramDelivered = Boolean(delivery.telegramDeliveredAt);
    const channelErrors: string[] = [];

    // Telegram is intentionally delivered before web push so a slow push provider
    // cannot delay time-sensitive order messages.
    if (!telegramDelivered) {
      try {
        if (!delivery.skipTelegram && notification.user.telegramId && process.env.TELEGRAM_BOT_TOKEN) {
          const absoluteLink = buildAbsoluteNotificationLink(notification.link);
          const storedMessage = delivery.telegramPayload as unknown as TelegramRichMessageDraft | null;
          const richMessage = storedMessage ?? buildNotificationRichMessage({
            title: notification.title,
            body: notification.body,
            typeLabel: getTelegramNotificationTypeLabel(notification.type),
            url: absoluteLink,
            buttonText: absoluteLink ? getTelegramNotificationButtonText(notification.type, notification.link) : null,
          });

          try {
            await sendTelegramDraftAsText({
              chatId: notification.user.telegramId,
              message: richMessage,
              replyMarkup: buildTelegramInlineKeyboard(richMessage.buttons ?? []),
            });
          } catch (error) {
            retryAfterMs = getTelegramRetryAfterMs(error);
            if (!isTelegramRecipientUnavailableError(error)) throw error;
          }
        }

        const marked = await db.notificationDelivery.updateMany({
          where: { id: delivery.id, lockToken: delivery.lockToken, telegramDeliveredAt: null },
          data: { telegramDeliveredAt: new Date() },
        });
        if (marked.count !== 1) throw new Error("notification-delivery-lock-lost");
        telegramDelivered = true;
      } catch (error) {
        channelErrors.push(`telegram:${error instanceof Error ? error.message : "unknown-error"}`);
      }
    }

    if (!pushDelivered) {
      try {
        await sendWebPushNotification(notification.userId, {
          title: notification.title,
          body: notification.body,
          link: notification.link,
          tag: notification.dedupeKey || notification.id,
        });
        const marked = await db.notificationDelivery.updateMany({
          where: { id: delivery.id, lockToken: delivery.lockToken, pushDeliveredAt: null },
          data: { pushDeliveredAt: new Date() },
        });
        if (marked.count !== 1) throw new Error("notification-delivery-lock-lost");
        pushDelivered = true;
      } catch (error) {
        channelErrors.push(`push:${error instanceof Error ? error.message : "unknown-error"}`);
      }
    }

    if (channelErrors.length) throw new Error(channelErrors.join(";"));
    if (!pushDelivered || !telegramDelivered) throw new Error("notification-delivery-incomplete");
    await db.notificationDelivery.updateMany({
      where: { id: delivery.id, lockToken: delivery.lockToken },
      data: { deliveredAt: new Date(), lockedAt: null, lockToken: null, lastError: null },
    });
    return true;
  } catch (error) {
    const attempts = delivery.attempts + 1;
    const message = error instanceof Error ? error.message.slice(0, 1_000) : "unknown-error";
    await db.notificationDelivery.updateMany({
      where: { id: delivery.id, lockToken: delivery.lockToken },
      data: {
        attempts,
        ...(attempts >= MAX_DELIVERY_ATTEMPTS
          ? {
              // Keep permanent failures out of the hot queue without requiring a new schema migration.
              availableAt: new Date("9999-12-31T23:59:59.999Z"),
              lastError: `permanent:${message}`,
            }
          : { availableAt: new Date(Date.now() + getNotificationRetryDelayMs(attempts, retryAfterMs)) }),
        lockedAt: null,
        lockToken: null,
        ...(attempts >= MAX_DELIVERY_ATTEMPTS ? {} : { lastError: message }),
      },
    });
    return false;
  }
}

async function deliverClaimedNotifications(limit: number, notificationIds?: string[]) {
  const deliveries = await claimDeliveries(Math.max(1, Math.min(DEFAULT_DELIVERY_LIMIT, limit)), notificationIds);
  let delivered = 0;
  const startedAt = Date.now();

  for (let index = 0; index < deliveries.length; index += DELIVERY_CONCURRENCY) {
    if (Date.now() - startedAt >= MAX_DELIVERY_RUNTIME_MS) {
      await db.notificationDelivery.updateMany({
        where: {
          id: { in: deliveries.slice(index).map((delivery) => delivery.id) },
          lockToken: deliveries[index]?.lockToken,
        },
        data: { lockedAt: null, lockToken: null },
      });
      break;
    }
    const results = await Promise.all(deliveries.slice(index, index + DELIVERY_CONCURRENCY).map(deliverOne));
    delivered += results.filter(Boolean).length;
  }

  return { claimed: deliveries.length, delivered, failed: deliveries.length - delivered };
}

export function deliverNotificationOutbox(limit = DEFAULT_DELIVERY_LIMIT) {
  return deliverClaimedNotifications(limit);
}

export async function deliverNotificationsImmediately(notificationIds: string[]) {
  if (!notificationIds.length) return { claimed: 0, delivered: 0, failed: 0 };
  return deliverClaimedNotifications(notificationIds.length, notificationIds);
}
