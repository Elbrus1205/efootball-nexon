import { createHash } from "node:crypto";
import {
  Prisma,
  ShopOrderActorType,
  ShopOrderStatus,
  ShopPaymentStatus,
  ShopStockMode,
} from "@prisma/client";
import { db } from "@/lib/db";
import { ShopError } from "@/lib/shop/errors";
import { getShopComplaintExpiresAt } from "@/lib/shop/order-policy";
import { notifyShopOrderStatus } from "@/lib/shop/order-workflow-service";
import { handlePaymentWebhook, type PaymentProvider, type PaymentWebhookStore, type VerifiedPaymentWebhook } from "@/lib/shop/payments";

export async function beginShopPayment(input: { orderId: string; buyerId: string; provider: PaymentProvider; returnUrl: string }) {
  const order = await db.shopOrder.findFirst({
    where: { id: input.orderId, buyerId: input.buyerId },
    include: { items: { take: 1 } },
  });
  if (!order) throw new ShopError("ORDER_NOT_FOUND", "Заказ не найден.", 404);
  if (order.status !== ShopOrderStatus.PENDING_PAYMENT) throw new ShopError("ORDER_NOT_PAYABLE", "Этот заказ уже нельзя оплатить.", 409);
  if (order.paymentExpiresAt && order.paymentExpiresAt <= new Date()) throw new ShopError("PAYMENT_EXPIRED", "Время оплаты заказа истекло.", 409);
  const sellerCandidates = await db.shopSeller.findMany({
    where: {
      deletedAt: null,
      user: { telegramUsername: { not: null } },
    },
    take: 1,
  });
  if (sellerCandidates.length === 0) {
    throw new ShopError("SELLER_NOT_AVAILABLE", "Сейчас нет доступного исполнителя. Попробуйте позже или обратитесь в поддержку.", 409);
  }

  const idempotencyKey = `shop-order:${order.id}:payment:v1`;
  const existing = await db.shopPayment.findUnique({ where: { idempotencyKey } });
  if (existing?.checkoutUrl) return existing;
  const external = await input.provider.createPayment({
    orderId: order.id,
    orderNumber: order.orderNumber,
    userId: input.buyerId,
    amountMinor: order.totalMinor,
    currency: order.currency,
    returnUrl: input.returnUrl,
    description: order.items[0]?.productTitle ?? order.orderNumber,
    idempotencyKey,
  });
  return db.shopPayment.upsert({
    where: { idempotencyKey },
    create: {
      orderId: order.id,
      provider: input.provider.name,
      externalPaymentId: external.externalPaymentId,
      idempotencyKey,
      amountMinor: order.totalMinor,
      currency: order.currency,
      checkoutUrl: external.checkoutUrl,
      expiresAt: external.expiresAt ?? order.paymentExpiresAt,
    },
    update: {
      externalPaymentId: external.externalPaymentId,
      checkoutUrl: external.checkoutUrl,
      expiresAt: external.expiresAt ?? order.paymentExpiresAt,
    },
  });
}

function createPrismaWebhookStore(providerName: string): PaymentWebhookStore {
  return {
    async claimEvent(eventId: string, event?: VerifiedPaymentWebhook) {
      const payloadHash = createHash("sha256").update(JSON.stringify(event ?? { eventId })).digest("hex");
      const created = await db.shopPaymentWebhookEvent.createMany({
        data: [{ provider: providerName, eventId, payloadHash }],
        skipDuplicates: true,
      });
      return created.count === 1;
    },
    async getPaymentByExternalId(externalPaymentId: string) {
      return db.shopPayment.findUnique({
        where: { externalPaymentId },
        select: { id: true, orderId: true, amountMinor: true, currency: true, status: true },
      });
    },
    async confirmPayment(input) {
      await db.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`shop-order:${input.orderId}`}))`;
        const payment = await tx.shopPayment.findUnique({ where: { id: input.paymentId } });
        const order = await tx.shopOrder.findUnique({ where: { id: input.orderId }, include: { items: true } });
        if (!payment || !order) throw new ShopError("PAYMENT_ORDER_NOT_FOUND", "Заказ платежа не найден.", 404);
        if (payment.status === ShopPaymentStatus.SUCCEEDED) return;
        if (order.status !== ShopOrderStatus.PENDING_PAYMENT) throw new ShopError("ORDER_PAYMENT_STATE_INVALID", "Заказ не ожидает оплату.", 409);

        const sellers = await tx.shopSeller.findMany({
          where: {
            deletedAt: null,
            user: { telegramUsername: { not: null } },
          },
          orderBy: [{ lastAssignedAt: "asc" }, { createdAt: "asc" }],
          take: 20,
        });
        const seller = sellers[0];
        if (!seller) throw new ShopError("SELLER_NOT_AVAILABLE", "Сейчас нет свободного исполнителя для оплаченного товара. Обратитесь в поддержку.", 409);
        const complaintExpiresAt = getShopComplaintExpiresAt(input.occurredAt);

        await tx.shopPayment.update({
          where: { id: payment.id },
          data: { status: ShopPaymentStatus.SUCCEEDED, paidAt: input.occurredAt },
        });
        await tx.shopOrder.update({
          where: { id: order.id },
          data: {
            status: ShopOrderStatus.IN_PROGRESS,
            sellerId: seller.id,
            paidAt: input.occurredAt,
            acceptedAt: input.occurredAt,
            startedAt: input.occurredAt,
            sellerAcceptExpiresAt: null,
            buyerConfirmationExpiresAt: complaintExpiresAt,
            fulfillmentExpiresAt: complaintExpiresAt,
            commissionMinor: 0,
            sellerEarningMinor: order.totalMinor,
          },
        });
        await tx.shopOrderStatusHistory.createMany({
          data: [
            {
              orderId: order.id,
              actorType: ShopOrderActorType.SYSTEM,
              previousStatus: ShopOrderStatus.PENDING_PAYMENT,
              newStatus: ShopOrderStatus.PAID,
              reason: "PAYMENT_WEBHOOK_CONFIRMED",
              technicalInfoJson: { eventId: input.eventId, paymentId: payment.id },
            },
            {
              orderId: order.id,
              actorType: ShopOrderActorType.SYSTEM,
              previousStatus: ShopOrderStatus.PAID,
              newStatus: ShopOrderStatus.IN_PROGRESS,
              reason: "SELLER_AUTO_ASSIGNED_AND_STARTED",
              technicalInfoJson: { sellerId: seller.id, complaintExpiresAt: complaintExpiresAt.toISOString() },
            },
          ],
        });
        for (const item of order.items) {
          const variant = await tx.shopProductVariant.findUnique({ where: { id: item.variantId }, select: { stockMode: true, reservedQuantity: true, stockQuantity: true } });
          if (variant?.stockMode === ShopStockMode.FINITE) {
            if (variant.reservedQuantity < item.quantity || variant.stockQuantity < item.quantity) {
              throw new ShopError("STOCK_RESERVATION_INVALID", "Резерв товара повреждён; оплата требует ручной проверки.", 409);
            }
            await tx.shopProductVariant.update({
              where: { id: item.variantId },
              data: { reservedQuantity: { decrement: item.quantity }, stockQuantity: { decrement: item.quantity } },
            });
          }
        }
        await tx.shopPaymentWebhookEvent.update({
          where: { provider_eventId: { provider: providerName, eventId: input.eventId } },
          data: { status: "PROCESSED", processedAt: new Date() },
        });
        await tx.shopSeller.update({ where: { id: seller.id }, data: { lastAssignedAt: input.occurredAt } });
        await tx.shopJob.createMany({
          data: [{
            type: "AUTO_COMPLETE_ORDER",
            dedupeKey: `auto-complete:${order.id}`,
            payload: { orderId: order.id },
            availableAt: complaintExpiresAt,
          }],
          skipDuplicates: true,
        });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15_000 });
    },
    async cancelPayment(input) {
      await db.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`shop-order:${input.orderId}`}))`;
        const payment = await tx.shopPayment.findUnique({ where: { id: input.paymentId } });
        const order = await tx.shopOrder.findUnique({ where: { id: input.orderId }, include: { items: true } });
        if (!payment || !order) throw new ShopError("PAYMENT_ORDER_NOT_FOUND", "Заказ платежа не найден.", 404);
        if (payment.status === ShopPaymentStatus.SUCCEEDED) return;

        await tx.shopPayment.update({
          where: { id: payment.id },
          data: { status: ShopPaymentStatus[input.status], failedAt: input.occurredAt },
        });
        if (order.status === ShopOrderStatus.PENDING_PAYMENT) {
          await tx.shopOrder.update({
            where: { id: order.id },
            data: { status: ShopOrderStatus.CANCELLED, cancelledAt: input.occurredAt },
          });
          await tx.shopOrderStatusHistory.create({
            data: {
              orderId: order.id,
              actorType: ShopOrderActorType.SYSTEM,
              previousStatus: ShopOrderStatus.PENDING_PAYMENT,
              newStatus: ShopOrderStatus.CANCELLED,
              reason: input.status === "CANCELLED" ? "PAYMENT_CANCELLED" : "PAYMENT_FAILED",
              technicalInfoJson: { eventId: input.eventId, paymentId: payment.id },
            },
          });
          for (const item of order.items) {
            const variant = await tx.shopProductVariant.findUnique({ where: { id: item.variantId }, select: { stockMode: true } });
            if (variant?.stockMode === ShopStockMode.FINITE) {
              await tx.shopProductVariant.update({ where: { id: item.variantId }, data: { reservedQuantity: { decrement: item.quantity } } });
            }
          }
        }
        await tx.shopPaymentWebhookEvent.update({
          where: { provider_eventId: { provider: providerName, eventId: input.eventId } },
          data: { status: "PROCESSED", processedAt: new Date() },
        });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15_000 });
    },
    async failEvent(eventId, reason) {
      await db.shopPaymentWebhookEvent.updateMany({
        where: { provider: providerName, eventId },
        data: { status: "FAILED", error: reason, processedAt: new Date() },
      });
    },
  };
}

export async function assignShopOrderSeller(orderId: string) {
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`shop-order:${orderId}`}))`;
    const order = await tx.shopOrder.findUnique({ where: { id: orderId }, include: { items: true } });
    if (!order || order.status !== ShopOrderStatus.WAITING_SELLER || order.sellerId) return order;
    const sellers = await tx.shopSeller.findMany({
      where: {
        deletedAt: null,
        user: { telegramUsername: { not: null } },
      },
      orderBy: [{ lastAssignedAt: "asc" }, { createdAt: "asc" }],
      take: 20,
    });
    const seller = sellers[0];
    if (!seller) return order;
    await tx.shopSeller.update({ where: { id: seller.id }, data: { lastAssignedAt: new Date() } });
    return tx.shopOrder.update({ where: { id: order.id }, data: { sellerId: seller.id } });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15_000 });
}

export async function processShopPaymentWebhook(input: { provider: PaymentProvider; headers: Headers; body: string }) {
  const result = await handlePaymentWebhook({
    provider: input.provider,
    store: createPrismaWebhookStore(input.provider.name),
    headers: input.headers,
    body: input.body,
  });
  if (!result.duplicate && result.orderId && result.status === "SUCCEEDED") {
    await notifyShopOrderStatus(result.orderId).catch((error) => console.error("Failed to notify paid shop order", error));
  }
  return result;
}
