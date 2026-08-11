import {
  NotificationType,
  Prisma,
  ShopOrderActorType,
  ShopOrderStatus,
  ShopPayoutStatus,
  ShopStockMode,
} from "@prisma/client";
import { db } from "@/lib/db";
import { createNotification } from "@/lib/services/notifications";
import { createCallbackToken, tokenCallback } from "@/lib/services/telegram-callbacks";
import { canPerformShopAction, type ShopAction } from "@/lib/shop/access";
import { ShopError } from "@/lib/shop/errors";
import { formatShopMoney, shopOrderStatusLabels } from "@/lib/shop/format";
import { assertOrderTransition, type ShopOrderActor, type ShopOrderStatusValue } from "@/lib/shop/order-state-machine";
import { getShopPermissionIds } from "@/lib/shop/permissions";
import type { TelegramRichMessageDraft } from "@/lib/telegram-rich";

type LockedOrder = Prisma.ShopOrderGetPayload<{
  include: { seller: true; items: true };
}>;

const activeSellerStatuses = [
  ShopOrderStatus.ACCEPTED,
  ShopOrderStatus.IN_PROGRESS,
  ShopOrderStatus.SELLER_COMPLETED,
  ShopOrderStatus.WAITING_BUYER_CONFIRMATION,
  ShopOrderStatus.DISPUTE,
];

function asState(status: ShopOrderStatus) {
  return status as ShopOrderStatusValue;
}

function actorEnum(actor: ShopOrderActor) {
  return ShopOrderActorType[actor];
}

function timestampUpdate(status: ShopOrderStatus, now: Date) {
  switch (status) {
    case ShopOrderStatus.PAID: return { paidAt: now };
    case ShopOrderStatus.ACCEPTED: return { acceptedAt: now };
    case ShopOrderStatus.IN_PROGRESS: return { startedAt: now };
    case ShopOrderStatus.SELLER_COMPLETED: return { sellerCompletedAt: now };
    case ShopOrderStatus.COMPLETED: return { completedAt: now };
    case ShopOrderStatus.CANCELLED: return { cancelledAt: now };
    case ShopOrderStatus.EXPIRED: return { expiredAt: now };
    default: return {};
  }
}

async function getLockedOrder(tx: Prisma.TransactionClient, orderId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`shop-order:${orderId}`}))`;
  return tx.shopOrder.findUnique({ where: { id: orderId }, include: { seller: true, items: true } });
}

async function ensureAction(order: LockedOrder, userId: string, action: ShopAction) {
  const permissions = await getShopPermissionIds(userId);
  const allowed = canPerformShopAction(action, {
    userId,
    buyerId: order.buyerId,
    sellerUserId: order.seller?.userId,
    isActiveSeller: order.seller?.isActive,
    permissions,
  });
  if (!allowed) throw new ShopError("SHOP_ACTION_FORBIDDEN", "РЈ РІР°СЃ РЅРµС‚ РїСЂР°РІ РЅР° СЌС‚Рѕ РґРµР№СЃС‚РІРёРµ.", 403);
}

async function transitionInTx(tx: Prisma.TransactionClient, input: {
  order: LockedOrder;
  to: ShopOrderStatus;
  actor: ShopOrderActor;
  actorUserId?: string | null;
  reason: string;
  comment?: string | null;
  technicalInfo?: Prisma.InputJsonValue;
  extraData?: Prisma.ShopOrderUpdateInput;
}) {
  assertOrderTransition({ from: asState(input.order.status), to: asState(input.to), actor: input.actor });
  const now = new Date();
  const updated = await tx.shopOrder.update({
    where: { id: input.order.id },
    data: {
      status: input.to,
      ...timestampUpdate(input.to, now),
      ...input.extraData,
    },
  });
  await tx.shopOrderStatusHistory.create({
    data: {
      orderId: input.order.id,
      actorUserId: input.actorUserId ?? null,
      actorType: actorEnum(input.actor),
      previousStatus: input.order.status,
      newStatus: input.to,
      reason: input.reason,
      comment: input.comment,
      technicalInfoJson: input.technicalInfo,
    },
  });
  input.order.status = input.to;
  return updated;
}

export async function acceptShopOrder(orderId: string, sellerUserId: string) {
  const order = await db.$transaction(async (tx) => {
    const locked = await getLockedOrder(tx, orderId);
    if (!locked) throw new ShopError("ORDER_NOT_FOUND", "Р—Р°РєР°Р· РЅРµ РЅР°Р№РґРµРЅ.", 404);
    if (locked.status !== ShopOrderStatus.WAITING_SELLER) throw new ShopError("ORDER_ALREADY_CLAIMED", "Р—Р°РєР°Р· СѓР¶Рµ РїСЂРёРЅСЏС‚ РёР»Рё Р±РѕР»СЊС€Рµ РЅРµРґРѕСЃС‚СѓРїРµРЅ.", 409);
    const seller = await tx.shopSeller.findFirst({
      where: {
        userId: sellerUserId,
        isActive: true,
        deletedAt: null,
        products: { some: { productId: { in: locked.items.map((item) => item.productId) }, isActive: true } },
        user: { telegramUsername: { not: null } },
      },
    });
    if (!seller) throw new ShopError("SELLER_NOT_ELIGIBLE", "РџСЂРѕРґР°РІРµС† РЅРµ РЅР°Р·РЅР°С‡РµРЅ РЅР° СЌС‚РѕС‚ С‚РѕРІР°СЂ.", 403);
    if (locked.sellerId && locked.sellerId !== seller.id) throw new ShopError("ORDER_ASSIGNED_TO_ANOTHER_SELLER", "Р—Р°РєР°Р· РЅР°Р·РЅР°С‡РµРЅ РґСЂСѓРіРѕРјСѓ РїСЂРѕРґР°РІС†Сѓ.", 409);
    const activeCount = await tx.shopOrder.count({ where: { sellerId: seller.id, status: { in: activeSellerStatuses } } });
    if (activeCount >= seller.maxActiveOrders) throw new ShopError("SELLER_LIMIT", "Р”РѕСЃС‚РёРіРЅСѓС‚ Р»РёРјРёС‚ Р°РєС‚РёРІРЅС‹С… Р·Р°РєР°Р·РѕРІ РїСЂРѕРґР°РІС†Р°.", 409);

    const commissionMinor = Math.floor((locked.totalMinor * seller.commissionBps) / 10_000);
    const updated = await transitionInTx(tx, {
      order: locked,
      to: ShopOrderStatus.ACCEPTED,
      actor: "SELLER",
      actorUserId: sellerUserId,
      reason: "SELLER_ACCEPTED",
      extraData: {
        seller: { connect: { id: seller.id } },
        commissionMinor,
        sellerEarningMinor: locked.totalMinor - commissionMinor,
        fulfillmentExpiresAt: new Date(Date.now() + Math.max(...locked.items.map((item) => item.estimatedMinutes)) * 60_000),
      },
    });
    await tx.shopSeller.update({ where: { id: seller.id }, data: { lastAssignedAt: new Date() } });
    return updated;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15_000 });
  await notifyShopOrderStatus(order.id).catch((error) => console.error("Failed to notify accepted shop order", error));
  return order;
}

async function performActorTransition(input: {
  orderId: string;
  userId: string;
  action: ShopAction;
  to: ShopOrderStatus;
  actor: ShopOrderActor;
  reason: string;
  comment?: string;
  extraData?: Prisma.ShopOrderUpdateInput;
}) {
  const order = await db.$transaction(async (tx) => {
    const locked = await getLockedOrder(tx, input.orderId);
    if (!locked) throw new ShopError("ORDER_NOT_FOUND", "Р—Р°РєР°Р· РЅРµ РЅР°Р№РґРµРЅ.", 404);
    await ensureAction(locked, input.userId, input.action);
    return transitionInTx(tx, {
      order: locked,
      to: input.to,
      actor: input.actor,
      actorUserId: input.userId,
      reason: input.reason,
      comment: input.comment,
      extraData: input.extraData,
    });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15_000 });
  await notifyShopOrderStatus(order.id).catch((error) => console.error("Failed to notify shop order transition", error));
  return order;
}

export function startShopOrder(orderId: string, sellerUserId: string) {
  return performActorTransition({ orderId, userId: sellerUserId, action: "START_ORDER", to: ShopOrderStatus.IN_PROGRESS, actor: "SELLER", reason: "SELLER_STARTED" });
}

export async function sellerCompleteShopOrder(orderId: string, sellerUserId: string, comment?: string) {
  const order = await db.$transaction(async (tx) => {
    const locked = await getLockedOrder(tx, orderId);
    if (!locked) throw new ShopError("ORDER_NOT_FOUND", "Р—Р°РєР°Р· РЅРµ РЅР°Р№РґРµРЅ.", 404);
    await ensureAction(locked, sellerUserId, "MARK_SELLER_COMPLETED");
    await transitionInTx(tx, {
      order: locked,
      to: ShopOrderStatus.SELLER_COMPLETED,
      actor: "SELLER",
      actorUserId: sellerUserId,
      reason: "SELLER_MARKED_COMPLETED",
      comment,
    });
    const settings = await tx.shopSettings.findUnique({ where: { id: "default" } });
    const updated = await transitionInTx(tx, {
      order: locked,
      to: ShopOrderStatus.WAITING_BUYER_CONFIRMATION,
      actor: "SYSTEM",
      reason: "BUYER_REVIEW_STARTED",
      extraData: { buyerConfirmationExpiresAt: new Date(Date.now() + (settings?.buyerConfirmTimeoutMinutes ?? 1_440) * 60_000) },
    });
    await tx.shopJob.createMany({
      data: [{
        type: "AUTO_COMPLETE_ORDER",
        dedupeKey: `auto-complete:${locked.id}`,
        payload: { orderId: locked.id },
        availableAt: updated.buyerConfirmationExpiresAt!,
      }],
      skipDuplicates: true,
    });
    return updated;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15_000 });
  await notifyShopOrderStatus(order.id).catch((error) => console.error("Failed to notify completed shop order", error));
  return order;
}

export async function confirmShopOrder(orderId: string, buyerUserId: string) {
  const order = await db.$transaction(async (tx) => {
    const locked = await getLockedOrder(tx, orderId);
    if (!locked) throw new ShopError("ORDER_NOT_FOUND", "Р—Р°РєР°Р· РЅРµ РЅР°Р№РґРµРЅ.", 404);
    await ensureAction(locked, buyerUserId, "CONFIRM_ORDER");
    const updated = await transitionInTx(tx, {
      order: locked,
      to: ShopOrderStatus.COMPLETED,
      actor: "BUYER",
      actorUserId: buyerUserId,
      reason: "BUYER_CONFIRMED",
    });
    if (locked.sellerId) {
      await tx.shopSeller.update({ where: { id: locked.sellerId }, data: { completedOrders: { increment: 1 } } });
      await tx.shopPayout.upsert({
        where: { orderId: locked.id },
        create: { orderId: locked.id, sellerId: locked.sellerId, amountMinor: locked.sellerEarningMinor, currency: locked.currency, status: ShopPayoutStatus.AVAILABLE, availableAt: new Date() },
        update: { status: ShopPayoutStatus.AVAILABLE, availableAt: new Date() },
      });
    }
    for (const item of locked.items) {
      await tx.shopProduct.update({ where: { id: item.productId }, data: { purchaseCount: { increment: item.quantity } } });
    }
    return updated;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15_000 });
  await notifyShopOrderStatus(order.id).catch((error) => console.error("Failed to notify confirmed shop order", error));
  return order;
}

export async function cancelShopOrder(orderId: string, userId: string, comment?: string, options?: { deleteUnpaid?: boolean }) {
  const order = await db.$transaction(async (tx) => {
    const locked = await getLockedOrder(tx, orderId);
    if (!locked) throw new ShopError("ORDER_NOT_FOUND", "Р—Р°РєР°Р· РЅРµ РЅР°Р№РґРµРЅ.", 404);
    await ensureAction(locked, userId, "VIEW_ORDER");
    const actor: ShopOrderActor = locked.buyerId === userId ? "BUYER" : "ADMIN";
    const previousStatus = locked.status;
    const updated = await transitionInTx(tx, { order: locked, to: ShopOrderStatus.CANCELLED, actor, actorUserId: userId, reason: "ORDER_CANCELLED", comment });
    if (previousStatus === ShopOrderStatus.PENDING_PAYMENT) {
      for (const item of locked.items) {
        const variant = await tx.shopProductVariant.findUnique({ where: { id: item.variantId }, select: { stockMode: true } });
        if (variant?.stockMode === ShopStockMode.FINITE) {
          await tx.shopProductVariant.update({ where: { id: item.variantId }, data: { reservedQuantity: { decrement: item.quantity } } });
        }
      }
      if (options?.deleteUnpaid) {
        await tx.shopOrder.delete({ where: { id: locked.id } });
        return updated;
      }
    }
    return updated;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15_000 });
  await notifyShopOrderStatus(order.id).catch(() => null);
  return order;
}

export async function openShopDispute(orderId: string, userId: string, input: { reason: string; description: string; desiredResolution?: string }) {
  const order = await db.$transaction(async (tx) => {
    const locked = await getLockedOrder(tx, orderId);
    if (!locked) throw new ShopError("ORDER_NOT_FOUND", "Р—Р°РєР°Р· РЅРµ РЅР°Р№РґРµРЅ.", 404);
    await ensureAction(locked, userId, "OPEN_DISPUTE");
    const actor: ShopOrderActor = locked.buyerId === userId ? "BUYER" : locked.seller?.userId === userId ? "SELLER" : "SUPPORT";
    const updated = await transitionInTx(tx, { order: locked, to: ShopOrderStatus.DISPUTE, actor, actorUserId: userId, reason: "DISPUTE_OPENED", comment: input.description });
    await tx.shopDispute.create({ data: { orderId, openedById: userId, reason: input.reason, description: input.description, desiredResolution: input.desiredResolution } });
    return updated;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15_000 });
  await notifyShopOrderStatus(order.id).catch(() => null);
  return order;
}

export async function runShopTokenAction(action: string, orderId: string, userId: string) {
  if (action === "SHOP_ACCEPT_ORDER") return acceptShopOrder(orderId, userId);
  if (action === "SHOP_START_ORDER") return startShopOrder(orderId, userId);
  if (action === "SHOP_SELLER_COMPLETE") return sellerCompleteShopOrder(orderId, userId);
  if (action === "SHOP_BUYER_CONFIRM") return confirmShopOrder(orderId, userId);
  if (action === "SHOP_OPEN_DISPUTE") {
    return openShopDispute(orderId, userId, { reason: "OTHER", description: "РџРѕРєСѓРїР°С‚РµР»СЊ РѕС‚РєСЂС‹Р» СЃРїРѕСЂ С‡РµСЂРµР· Telegram." });
  }
  if (action === "SHOP_CANCEL_ORDER") return cancelShopOrder(orderId, userId);
  throw new ShopError("UNKNOWN_SHOP_ACTION", "РќРµРёР·РІРµСЃС‚РЅРѕРµ РґРµР№СЃС‚РІРёРµ РјР°РіР°Р·РёРЅР°.");
}

export async function resolveShopDispute(input: {
  orderId: string;
  userId: string;
  resolution: string;
  targetStatus: "COMPLETED" | "REFUND_PENDING" | "IN_PROGRESS" | "CANCELLED";
  refundAmountMinor?: number;
}) {
  const permissions = await getShopPermissionIds(input.userId);
  if (!permissions.includes("shop.support") && !permissions.includes("shop.manage")) {
    throw new ShopError("SHOP_ACTION_FORBIDDEN", "РўРѕР»СЊРєРѕ РїРѕРґРґРµСЂР¶РєР° РјРѕР¶РµС‚ СЂР°Р·СЂРµС€РёС‚СЊ СЃРїРѕСЂ.", 403);
  }
  const actor: ShopOrderActor = permissions.includes("shop.manage") ? "ADMIN" : "SUPPORT";
  const target = ShopOrderStatus[input.targetStatus];
  const order = await db.$transaction(async (tx) => {
    const locked = await getLockedOrder(tx, input.orderId);
    if (!locked) throw new ShopError("ORDER_NOT_FOUND", "Р—Р°РєР°Р· РЅРµ РЅР°Р№РґРµРЅ.", 404);
    const updated = await transitionInTx(tx, {
      order: locked,
      to: target,
      actor,
      actorUserId: input.userId,
      reason: "DISPUTE_RESOLVED",
      comment: input.resolution,
    });
    await tx.shopDispute.updateMany({
      where: { orderId: locked.id, status: { in: ["OPEN", "UNDER_REVIEW"] } },
      data: { status: "RESOLVED", resolution: input.resolution, resolutionAmountMinor: input.refundAmountMinor, resolvedById: input.userId, resolvedAt: new Date() },
    });
    if (target === ShopOrderStatus.REFUND_PENDING) {
      const payment = await tx.shopPayment.findFirst({ where: { orderId: locked.id, status: "SUCCEEDED" }, orderBy: { paidAt: "desc" } });
      if (!payment) throw new ShopError("PAYMENT_NOT_FOUND", "Р”Р»СЏ РІРѕР·РІСЂР°С‚Р° РЅРµ РЅР°Р№РґРµРЅ РїРѕРґС‚РІРµСЂР¶РґС‘РЅРЅС‹Р№ РїР»Р°С‚С‘Р¶.", 409);
      const amountMinor = input.refundAmountMinor ?? locked.totalMinor;
      if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0 || amountMinor > locked.totalMinor) throw new ShopError("REFUND_AMOUNT_INVALID", "РќРµРєРѕСЂСЂРµРєС‚РЅР°СЏ СЃСѓРјРјР° РІРѕР·РІСЂР°С‚Р°.");
      await tx.shopRefund.create({
        data: {
          orderId: locked.id,
          paymentId: payment.id,
          idempotencyKey: `shop-refund:${locked.id}:${Date.now()}`,
          amountMinor,
          currency: locked.currency,
          reason: input.resolution,
          requestedById: input.userId,
        },
      });
    }
    return updated;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15_000 });
  await notifyShopOrderStatus(order.id).catch(() => null);
  return order;
}

async function shopButtons(order: Awaited<ReturnType<typeof loadNotificationOrder>>, recipient: "buyer" | "seller") {
  if (!order) return [];
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://efootball-nexon.com";
  const buttons: NonNullable<TelegramRichMessageDraft["buttons"]> = [
    { text: "Открыть заказ", url: `${appUrl}/shop/orders/${order.id}`, row: 1 },
  ];
  const contactUsername = recipient === "buyer" ? order.seller?.user.telegramUsername : order.buyer.telegramUsername;
  const contactHiddenStatuses: ShopOrderStatus[] = [ShopOrderStatus.WAITING_SELLER, ShopOrderStatus.PAID, ShopOrderStatus.PENDING_PAYMENT];
  if (contactUsername && !contactHiddenStatuses.includes(order.status)) {
    buttons.push({ text: recipient === "buyer" ? "Связаться с исполнителем" : "Связаться с покупателем", url: `https://t.me/${contactUsername.replace(/^@/, "")}`, row: 2 });
  }
  const tokenActions = recipient === "seller"
    ? order.status === ShopOrderStatus.WAITING_SELLER ? [["Взяться за работу", "SHOP_ACCEPT_ORDER"]] : order.status === ShopOrderStatus.ACCEPTED ? [["Начать выполнение", "SHOP_START_ORDER"]] : order.status === ShopOrderStatus.IN_PROGRESS ? [["Монеты куплены", "SHOP_SELLER_COMPLETE"]] : []
    : order.status === ShopOrderStatus.WAITING_BUYER_CONFIRMATION ? [["Подтвердить получение", "SHOP_BUYER_CONFIRM"], ["Есть проблема", "SHOP_OPEN_DISPUTE"]] : [];
  for (const [index, [text, action]] of tokenActions.entries()) {
    const token = await createCallbackToken({ userId: recipient === "buyer" ? order.buyerId : order.seller!.userId, action, shopOrderId: order.id });
    buttons.push({ text, callbackData: tokenCallback(token), row: index + 3 });
  }
  if (recipient === "buyer" && order.status === ShopOrderStatus.COMPLETED) buttons.push({ text: "Оставить отзыв", url: `${appUrl}/shop/orders/${order.id}#review`, row: 3 });
  return buttons;
}

function loadNotificationOrder(orderId: string) {
  return db.shopOrder.findUnique({
    where: { id: orderId },
    include: {
      buyer: { select: { id: true, name: true, telegramUsername: true } },
      seller: { include: { user: { select: { id: true, name: true, telegramUsername: true } } } },
      items: true,
    },
  });
}

function buyerStatusMessage(status: ShopOrderStatus, sellerName?: string | null) {
  switch (status) {
    case ShopOrderStatus.WAITING_SELLER: return "Оплата подтверждена. Ищем исполнителя для вашего заказа.";
    case ShopOrderStatus.ACCEPTED: return `${sellerName || "Исполнитель"} взялся за ваш заказ. Теперь вы можете связаться в Telegram.`;
    case ShopOrderStatus.IN_PROGRESS: return "Исполнитель начал работу. Следующее уведомление придёт, когда монеты будут куплены.";
    case ShopOrderStatus.WAITING_BUYER_CONFIRMATION: return "Монеты куплены. Зайдите в аккаунт, проверьте результат и подтвердите получение.";
    case ShopOrderStatus.COMPLETED: return "��аказ успешно закрыт. Спасибо за покупку — пожалуйста, оставьте отзыв.";
    default: return `Статус заказа обновлён: ${shopOrderStatusLabels[status] ?? status}.`;
  }
}

function sellerStatusMessage(status: ShopOrderStatus, buyerName?: string | null) {
  switch (status) {
    case ShopOrderStatus.WAITING_SELLER: return "Новый оплаченный заказ доступен вам. Возьмитесь за работу, если готовы выполнить его вовремя.";
    case ShopOrderStatus.ACCEPTED: return `Вы взялись за заказ игрока ${buyerName || "Покупатель"}. Связь доступна в Telegram.`;
    case ShopOrderStatus.IN_PROGRESS: return "Заказ в работе. После покупки монет нажмите «Монеты куплены».";
    case ShopOrderStatus.WAITING_BUYER_CONFIRMATION: return "Покупатель получил уведомление и должен подтвердить результат.";
    case ShopOrderStatus.COMPLETED: return "Покупатель подтвердил получение. Заказ успешно завершён.";
    default: return `Статус заказа обновлён: ${shopOrderStatusLabels[status] ?? status}.`;
  }
}

export async function notifyShopOrderStatus(orderId: string) {
  const order = await loadNotificationOrder(orderId);
  if (!order) return;
  const item = order.items[0];
  const status = shopOrderStatusLabels[order.status] ?? order.status;
  const body = `${order.orderNumber}: ${item?.productTitle ?? "заказ"} — ${status}.`;
  const orderRows = [["Заказ", order.orderNumber], ["Товар", item?.productTitle ?? "Заказ"], ["Вариант", item?.variantName ?? "—"], ["Количество", String(item?.quantity ?? 1)], ["Сумма", formatShopMoney(order.totalMinor, order.currency)], ["Статус", status]];
  const buyerDraft: TelegramRichMessageDraft = {
    blocks: [{ type: "section_heading", text: status }, { type: "table", columns: ["Заказ", "Данные"], rows: orderRows }, { type: "paragraph", text: buyerStatusMessage(order.status, order.seller?.user.name) }, { type: "footer", text: "eFootball Nexon · магазин" }],
    fallbackText: `<b>${status}</b>\n\n${body}`,
    buttons: await shopButtons(order, "buyer"),
  };
  await createNotification({ userId: order.buyerId, title: status, body, type: NotificationType.SYSTEM, link: `/shop/orders/${order.id}`, dedupeKey: `shop:${order.id}:${order.status}:buyer`, telegramRichMessage: buyerDraft });
  if (order.seller?.userId) {
    const sellerDraft: TelegramRichMessageDraft = {
      blocks: [{ type: "section_heading", text: status }, { type: "table", columns: ["Заказ", "Данные"], rows: orderRows }, { type: "paragraph", text: sellerStatusMessage(order.status, order.buyer.name) }, { type: "footer", text: "Полные игровые данные доступны только на защищённой странице заказа." }],
      fallbackText: `<b>${status}</b>\n\n${body}`,
      buttons: await shopButtons(order, "seller"),
    };
    await createNotification({ userId: order.seller.userId, title: status, body, type: NotificationType.SYSTEM, link: `/shop/orders/${order.id}`, dedupeKey: `shop:${order.id}:${order.status}:seller`, telegramRichMessage: sellerDraft });
  }
}
