import {
  NotificationType,
  Prisma,
  ShopOrderActorType,
  ShopOrderStatus,
  ShopPayoutStatus,
  ShopStockMode,
} from "@prisma/client";
import { db } from "@/lib/db";
import { deliverNotificationsImmediately } from "@/lib/notifications/delivery-worker";
import { createNotification } from "@/lib/services/notifications";
import { createCallbackToken, tokenCallback } from "@/lib/services/telegram-callbacks";
import { canPerformShopAction, type ShopAction } from "@/lib/shop/access";
import { ShopError } from "@/lib/shop/errors";
import { formatShopMoney, shopOrderStatusLabels } from "@/lib/shop/format";
import { assertOrderTransition, type ShopOrderActor, type ShopOrderStatusValue } from "@/lib/shop/order-state-machine";
import { getShopPermissionIds } from "@/lib/shop/permissions";
import { getShopComplaintExpiresAt, isShopComplaintOpen } from "@/lib/shop/order-policy";
import { getShopSettings } from "@/lib/shop/config";
import type { TelegramRichMessageDraft } from "@/lib/telegram-rich";

const sellerCompleteAction = ["SHOP", "SELLER", "COMPLETE"].join("_");

type LockedOrder = Prisma.ShopOrderGetPayload<{
  include: { seller: true; items: true };
}>;

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
    isActiveSeller: Boolean(order.seller),
    permissions,
  });
  if (!allowed) throw new ShopError("SHOP_ACTION_FORBIDDEN", "Р Р€ Р Р†Р В°РЎРѓ Р Р…Р ВµРЎвЂљ Р С—РЎР‚Р В°Р Р† Р Р…Р В° РЎРЊРЎвЂљР С• Р Т‘Р ВµР в„–РЎРѓРЎвЂљР Р†Р С‘Р Вµ.", 403);
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
    if (!locked) throw new ShopError("ORDER_NOT_FOUND", "Р вЂ”Р В°Р С”Р В°Р В· Р Р…Р Вµ Р Р…Р В°Р в„–Р Т‘Р ВµР Р….", 404);
    if (locked.status !== ShopOrderStatus.WAITING_SELLER) throw new ShopError("ORDER_ALREADY_CLAIMED", "Р вЂ”Р В°Р С”Р В°Р В· РЎС“Р В¶Р Вµ Р С—РЎР‚Р С‘Р Р…РЎРЏРЎвЂљ Р С‘Р В»Р С‘ Р В±Р С•Р В»РЎРЉРЎв‚¬Р Вµ Р Р…Р ВµР Т‘Р С•РЎРѓРЎвЂљРЎС“Р С—Р ВµР Р….", 409);
    const seller = await tx.shopSeller.findFirst({
      where: {
        userId: sellerUserId,
        deletedAt: null,
        user: { telegramUsername: { not: null } },
      },
    });
    if (!seller) throw new ShopError("SELLER_NOT_ELIGIBLE", "Р СџРЎР‚Р С•Р Т‘Р В°Р Р†Р ВµРЎвЂ  Р Р…Р Вµ Р Р…Р В°Р В·Р Р…Р В°РЎвЂЎР ВµР Р… Р Р…Р В° РЎРЊРЎвЂљР С•РЎвЂљ РЎвЂљР С•Р Р†Р В°РЎР‚.", 403);
    if (locked.sellerId && locked.sellerId !== seller.id) throw new ShopError("ORDER_ASSIGNED_TO_ANOTHER_SELLER", "Р вЂ”Р В°Р С”Р В°Р В· Р Р…Р В°Р В·Р Р…Р В°РЎвЂЎР ВµР Р… Р Т‘РЎР‚РЎС“Р С–Р С•Р СРЎС“ Р С—РЎР‚Р С•Р Т‘Р В°Р Р†РЎвЂ РЎС“.", 409);

    const updated = await transitionInTx(tx, {
      order: locked,
      to: ShopOrderStatus.ACCEPTED,
      actor: "SELLER",
      actorUserId: sellerUserId,
      reason: "SELLER_ACCEPTED",
      extraData: {
        seller: { connect: { id: seller.id } },
        commissionMinor: 0,
        sellerEarningMinor: locked.totalMinor,
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
    if (!locked) throw new ShopError("ORDER_NOT_FOUND", "Р вЂ”Р В°Р С”Р В°Р В· Р Р…Р Вµ Р Р…Р В°Р в„–Р Т‘Р ВµР Р….", 404);
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
    if (!locked) throw new ShopError("ORDER_NOT_FOUND", "Р вЂ”Р В°Р С”Р В°Р В· Р Р…Р Вµ Р Р…Р В°Р в„–Р Т‘Р ВµР Р….", 404);
    await ensureAction(locked, sellerUserId, "MARK_SELLER_COMPLETED");
    await transitionInTx(tx, {
      order: locked,
      to: ShopOrderStatus.SELLER_COMPLETED,
      actor: "SELLER",
      actorUserId: sellerUserId,
      reason: "SELLER_MARKED_COMPLETED",
      comment,
    });
    if (!locked.paidAt) throw new ShopError("ORDER_PAYMENT_NOT_CONFIRMED", "РћРїР»Р°С‚Р° Р·Р°РєР°Р·Р° РЅРµ РїРѕРґС‚РІРµСЂР¶РґРµРЅР°.", 409);
    const complaintExpiresAt = getShopComplaintExpiresAt(locked.paidAt);
    const updated = await transitionInTx(tx, {
      order: locked,
      to: ShopOrderStatus.WAITING_BUYER_CONFIRMATION,
      actor: "SYSTEM",
      reason: "BUYER_REVIEW_STARTED",
      extraData: { buyerConfirmationExpiresAt: complaintExpiresAt },
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
    if (!locked) throw new ShopError("ORDER_NOT_FOUND", "Р вЂ”Р В°Р С”Р В°Р В· Р Р…Р Вµ Р Р…Р В°Р в„–Р Т‘Р ВµР Р….", 404);
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
    if (!locked) throw new ShopError("ORDER_NOT_FOUND", "Р вЂ”Р В°Р С”Р В°Р В· Р Р…Р Вµ Р Р…Р В°Р в„–Р Т‘Р ВµР Р….", 404);
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
    if (locked.buyerId === userId && !isShopComplaintOpen(locked.paidAt)) {
      throw new ShopError("SHOP_COMPLAINT_WINDOW_EXPIRED", "РЎСЂРѕРє РїРѕРґР°С‡Рё Р¶Р°Р»РѕР±С‹ РёСЃС‚С‘Рє. Р–Р°Р»РѕР±Сѓ РјРѕР¶РЅРѕ РѕС‚РїСЂР°РІРёС‚СЊ РІ С‚РµС‡РµРЅРёРµ 48 С‡Р°СЃРѕРІ РїРѕСЃР»Рµ РѕРїР»Р°С‚С‹.", 409);
    }
    const actor: ShopOrderActor = locked.buyerId === userId ? "BUYER" : locked.seller?.userId === userId ? "SELLER" : "SUPPORT";
    const updated = await transitionInTx(tx, { order: locked, to: ShopOrderStatus.DISPUTE, actor, actorUserId: userId, reason: "DISPUTE_OPENED", comment: input.description });
    await tx.shopDispute.create({ data: { orderId, openedById: userId, reason: input.reason, description: input.description, desiredResolution: input.desiredResolution } });
    return updated;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15_000 });
  await notifyShopOrderStatus(order.id).catch(() => null);
  return order;
}

export async function runShopTokenAction(action: string, orderId: string, userId: string) {
  if (action === "SHOP_OPEN_DISPUTE") {
    return openShopDispute(orderId, userId, { reason: "OTHER", description: "РџРѕРєСѓРїР°С‚РµР»СЊ РѕС‚РїСЂР°РІРёР» Р¶Р°Р»РѕР±Сѓ С‡РµСЂРµР· Telegram." });
  }
  if (action === "SHOP_CANCEL_ORDER") return cancelShopOrder(orderId, userId);
  if (action === sellerCompleteAction) return sellerCompleteShopOrder(orderId, userId);
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
    throw new ShopError("SHOP_ACTION_FORBIDDEN", "Р СћР С•Р В»РЎРЉР С”Р С• Р С—Р С•Р Т‘Р Т‘Р ВµРЎР‚Р В¶Р С”Р В° Р СР С•Р В¶Р ВµРЎвЂљ РЎР‚Р В°Р В·РЎР‚Р ВµРЎв‚¬Р С‘РЎвЂљРЎРЉ РЎРѓР С—Р С•РЎР‚.", 403);
  }
  const actor: ShopOrderActor = permissions.includes("shop.manage") ? "ADMIN" : "SUPPORT";
  const target = ShopOrderStatus[input.targetStatus];
  const order = await db.$transaction(async (tx) => {
    const locked = await getLockedOrder(tx, input.orderId);
    if (!locked) throw new ShopError("ORDER_NOT_FOUND", "Р вЂ”Р В°Р С”Р В°Р В· Р Р…Р Вµ Р Р…Р В°Р в„–Р Т‘Р ВµР Р….", 404);
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
      if (!payment) throw new ShopError("PAYMENT_NOT_FOUND", "Р вЂќР В»РЎРЏ Р Р†Р С•Р В·Р Р†РЎР‚Р В°РЎвЂљР В° Р Р…Р Вµ Р Р…Р В°Р в„–Р Т‘Р ВµР Р… Р С—Р С•Р Т‘РЎвЂљР Р†Р ВµРЎР‚Р В¶Р Т‘РЎвЂР Р…Р Р…РЎвЂ№Р в„– Р С—Р В»Р В°РЎвЂљРЎвЂР В¶.", 409);
      const amountMinor = input.refundAmountMinor ?? locked.totalMinor;
      if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0 || amountMinor > locked.totalMinor) throw new ShopError("REFUND_AMOUNT_INVALID", "Р СњР ВµР С”Р С•РЎР‚РЎР‚Р ВµР С”РЎвЂљР Р…Р В°РЎРЏ РЎРѓРЎС“Р СР СР В° Р Р†Р С•Р В·Р Р†РЎР‚Р В°РЎвЂљР В°.");
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
    { text: "РћС‚РєСЂС‹С‚СЊ Р·Р°РєР°Р·", url: `${appUrl}/shop/orders/${order.id}`, row: 1 },
  ];
  const contactUsername = recipient === "buyer" ? order.seller?.user.telegramUsername : order.buyer.telegramUsername;
  if (contactUsername && order.paidAt) {
    buttons.push({ text: recipient === "buyer" ? "РЎРІСЏР·Р°С‚СЊСЃСЏ СЃ РёСЃРїРѕР»РЅРёС‚РµР»РµРј" : "РЎРІСЏР·Р°С‚СЊСЃСЏ СЃ РїРѕРєСѓРїР°С‚РµР»РµРј", url: `https://t.me/${contactUsername.replace(/^@/, "")}`, row: 2 });
  }
  const tokenActions: Array<[string, string]> = [];
  if (recipient === "buyer" && (order.status === ShopOrderStatus.IN_PROGRESS || order.status === ShopOrderStatus.WAITING_BUYER_CONFIRMATION) && isShopComplaintOpen(order.paidAt)) {
    tokenActions.push(["РџРѕР¶Р°Р»РѕРІР°С‚СЊСЃСЏ", "SHOP_OPEN_DISPUTE"]);
  }
  if (recipient === "seller" && order.status === ShopOrderStatus.IN_PROGRESS) {
    tokenActions.push(["Р—Р°РєР°Р· РІС‹РїРѕР»РЅРµРЅ", "SHOP_SELLER_COMPLETE"]);
  }
  for (const [index, [text, action]] of tokenActions.entries()) {
    const token = await createCallbackToken({ userId: recipient === "buyer" ? order.buyerId : order.seller!.userId, action, shopOrderId: order.id });
    buttons.push({ text, callbackData: tokenCallback(token), row: index + 3 });
  }
  if (recipient === "buyer" && (order.status === ShopOrderStatus.WAITING_BUYER_CONFIRMATION || order.status === ShopOrderStatus.COMPLETED)) {
    const settings = await getShopSettings();
    if (settings.reviewsTelegramUrl) buttons.push({ text: "РћСЃС‚Р°РІРёС‚СЊ РѕС‚Р·С‹РІ", url: settings.reviewsTelegramUrl, row: 3 });
  }
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
    case ShopOrderStatus.IN_PROGRESS: return `РћРїР»Р°С‚Р° РїРѕРґС‚РІРµСЂР¶РґРµРЅР°. РСЃРїРѕР»РЅРёС‚РµР»СЊ ${sellerName || "РЅР°Р·РЅР°С‡РµРЅ"} СѓР¶Рµ РїРѕР»СѓС‡РёР» Р·Р°РєР°Р·. Р–Р°Р»РѕР±Р° РґРѕСЃС‚СѓРїРЅР° РІ С‚РµС‡РµРЅРёРµ 48 С‡Р°СЃРѕРІ РїРѕСЃР»Рµ РѕРїР»Р°С‚С‹.`;
    case ShopOrderStatus.WAITING_BUYER_CONFIRMATION: return "РСЃРїРѕР»РЅРёС‚РµР»СЊ РѕС‚РјРµС‚РёР» Р·Р°РєР°Р· РІС‹РїРѕР»РЅРµРЅРЅС‹Рј. РџСЂРѕРІРµСЂСЊС‚Рµ СЂРµР·СѓР»СЊС‚Р°С‚ Рё РѕСЃС‚Р°РІСЊС‚Рµ РѕС‚Р·С‹РІ РІ РєРѕРјРјРµРЅС‚Р°СЂРёСЏС… Рє РїРѕСЃС‚Сѓ Telegram.";
    case ShopOrderStatus.COMPLETED: return "Р—Р°РєР°Р· Р·Р°РєСЂС‹С‚ РїРѕСЃР»Рµ 48-С‡Р°СЃРѕРІРѕРіРѕ РїРµСЂРёРѕРґР° Р·Р°С‰РёС‚С‹. РћС‚Р·С‹РІ РјРѕР¶РЅРѕ РѕСЃС‚Р°РІРёС‚СЊ РІ Telegram.";
    default: return `РЎС‚Р°С‚СѓСЃ Р·Р°РєР°Р·Р° РѕР±РЅРѕРІР»С‘РЅ: ${shopOrderStatusLabels[status] ?? status}.`;
  }
}

function sellerStatusMessage(status: ShopOrderStatus, buyerName?: string | null) {
  switch (status) {
    case ShopOrderStatus.IN_PROGRESS: return `Р’Р°Рј Р°РІС‚РѕРјР°С‚РёС‡РµСЃРєРё РЅР°Р·РЅР°С‡РµРЅ РѕРїР»Р°С‡РµРЅРЅС‹Р№ Р·Р°РєР°Р· РёРіСЂРѕРєР° ${buyerName || "РџРѕРєСѓРїР°С‚РµР»СЊ"}. РњРѕР¶РЅРѕ СЃСЂР°Р·Сѓ РЅР°РїРёСЃР°С‚СЊ РїРѕРєСѓРїР°С‚РµР»СЋ РІ Telegram Рё РІС‹РїРѕР»РЅРёС‚СЊ Р·Р°РєР°Р·.`;
    case ShopOrderStatus.WAITING_BUYER_CONFIRMATION: return "Р’С‹ РѕС‚РјРµС‚РёР»Рё Р·Р°РєР°Р· РІС‹РїРѕР»РЅРµРЅРЅС‹Рј. РџРѕРєСѓРїР°С‚РµР»СЋ РѕС‚РїСЂР°РІР»РµРЅР° СЃСЃС‹Р»РєР° РЅР° РѕС‚Р·С‹РІС‹ РІ Telegram.";
    case ShopOrderStatus.COMPLETED: return "48-С‡Р°СЃРѕРІРѕР№ РїРµСЂРёРѕРґ Р·Р°С‰РёС‚С‹ Р·Р°РІРµСЂС€С‘РЅ. Р—Р°РєР°Р· СѓСЃРїРµС€РЅРѕ Р·Р°РєСЂС‹С‚.";
    default: return `РЎС‚Р°С‚СѓСЃ Р·Р°РєР°Р·Р° РѕР±РЅРѕРІР»С‘РЅ: ${shopOrderStatusLabels[status] ?? status}.`;
  }
}

export async function notifyShopOrderStatus(orderId: string) {
  const order = await loadNotificationOrder(orderId);
  if (!order) return;
  const item = order.items[0];
  const status = shopOrderStatusLabels[order.status] ?? order.status;
  const body = `${order.orderNumber}: ${item?.productTitle ?? "Р·Р°РєР°Р·"} вЂ” ${status}.`;
  const orderRows = [["Р—Р°РєР°Р·", order.orderNumber], ["РўРѕРІР°СЂ", item?.productTitle ?? "Р—Р°РєР°Р·"], ["Р’Р°СЂРёР°РЅС‚", item?.variantName ?? "вЂ”"], ["РљРѕР»РёС‡РµСЃС‚РІРѕ", String(item?.quantity ?? 1)], ["РЎСѓРјРјР°", formatShopMoney(order.totalMinor, order.currency)], ["РЎС‚Р°С‚СѓСЃ", status]];
  const buyerDraft: TelegramRichMessageDraft = {
    blocks: [{ type: "section_heading", text: status }, { type: "table", columns: ["Р—Р°РєР°Р·", "Р”Р°РЅРЅС‹Рµ"], rows: orderRows }, { type: "paragraph", text: buyerStatusMessage(order.status, order.seller?.user.name) }, { type: "footer", text: "eFootball Nexon В· РјР°РіР°Р·РёРЅ" }],
    fallbackText: `<b>${status}</b>\n\n${body}`,
    buttons: await shopButtons(order, "buyer"),
  };
  const notificationIds: string[] = [];
  const buyerNotification = await createNotification({ userId: order.buyerId, title: status, body, type: NotificationType.SYSTEM, link: `/shop/orders/${order.id}`, dedupeKey: `shop:${order.id}:${order.status}:buyer`, telegramRichMessage: buyerDraft });
  notificationIds.push(buyerNotification.id);
  if (order.seller?.userId) {
    const sellerDraft: TelegramRichMessageDraft = {
      blocks: [{ type: "section_heading", text: status }, { type: "table", columns: ["Р—Р°РєР°Р·", "Р”Р°РЅРЅС‹Рµ"], rows: orderRows }, { type: "paragraph", text: sellerStatusMessage(order.status, order.buyer.name) }, { type: "footer", text: "РџРѕР»РЅС‹Рµ РёРіСЂРѕРІС‹Рµ РґР°РЅРЅС‹Рµ РґРѕСЃС‚СѓРїРЅС‹ С‚РѕР»СЊРєРѕ РЅР° Р·Р°С‰РёС‰С‘РЅРЅРѕР№ СЃС‚СЂР°РЅРёС†Рµ Р·Р°РєР°Р·Р°." }],
      fallbackText: `<b>${status}</b>\n\n${body}`,
      buttons: await shopButtons(order, "seller"),
    };
    const sellerNotification = await createNotification({ userId: order.seller.userId, title: status, body, type: NotificationType.SYSTEM, link: `/shop/orders/${order.id}`, dedupeKey: `shop:${order.id}:${order.status}:seller`, telegramRichMessage: sellerDraft });
    notificationIds.push(sellerNotification.id);
  }
  await deliverNotificationsImmediately(notificationIds).catch((error) => console.error("Immediate shop notification delivery failed", error));
}

