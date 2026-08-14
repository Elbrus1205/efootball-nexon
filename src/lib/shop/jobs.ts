import { randomUUID } from "node:crypto";
import {
  Prisma,
  ShopJobStatus,
  ShopOrderActorType,
  ShopOrderStatus,
  ShopPayoutStatus,
  ShopStockMode,
} from "@prisma/client";
import { db } from "@/lib/db";
import { notifyShopOrderStatus } from "@/lib/shop/order-workflow-service";

type JobPayload = { orderId?: string; attempt?: number };

async function expireUnpaidOrder(orderId: string) {
  const changed = await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`shop-order:${orderId}`}))`;
    const order = await tx.shopOrder.findUnique({ where: { id: orderId }, include: { items: true } });
    if (!order || order.status !== ShopOrderStatus.PENDING_PAYMENT || !order.paymentExpiresAt || order.paymentExpiresAt > new Date()) return false;
    await tx.shopOrder.update({ where: { id: order.id }, data: { status: ShopOrderStatus.EXPIRED, expiredAt: new Date() } });
    await tx.shopOrderStatusHistory.create({
      data: {
        orderId: order.id,
        actorType: ShopOrderActorType.SYSTEM,
        previousStatus: ShopOrderStatus.PENDING_PAYMENT,
        newStatus: ShopOrderStatus.EXPIRED,
        reason: "PAYMENT_TIMEOUT",
      },
    });
    for (const item of order.items) {
      const variant = await tx.shopProductVariant.findUnique({ where: { id: item.variantId }, select: { stockMode: true, reservedQuantity: true } });
      if (variant?.stockMode === ShopStockMode.FINITE && variant.reservedQuantity >= item.quantity) {
        await tx.shopProductVariant.update({ where: { id: item.variantId }, data: { reservedQuantity: { decrement: item.quantity } } });
      }
    }
    return true;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15_000 });
  if (changed) await notifyShopOrderStatus(orderId).catch(() => null);
}

async function autoCompleteOrder(orderId: string) {
  const changed = await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`shop-order:${orderId}`}))`;
    const order = await tx.shopOrder.findUnique({ where: { id: orderId }, include: { seller: true, items: true } });
    if (!order || (order.status !== ShopOrderStatus.IN_PROGRESS && order.status !== ShopOrderStatus.WAITING_BUYER_CONFIRMATION) || !order.buyerConfirmationExpiresAt || order.buyerConfirmationExpiresAt > new Date()) return false;
    await tx.shopOrder.update({ where: { id: order.id }, data: { status: ShopOrderStatus.COMPLETED, completedAt: new Date() } });
    await tx.shopOrderStatusHistory.create({
      data: {
        orderId: order.id,
        actorType: ShopOrderActorType.SYSTEM,
        previousStatus: order.status,
        newStatus: ShopOrderStatus.COMPLETED,
        reason: "AUTO_COMPLETED_AFTER_COMPLAINT_WINDOW",
      },
    });
    if (order.sellerId) {
      await tx.shopSeller.update({ where: { id: order.sellerId }, data: { completedOrders: { increment: 1 } } });
      await tx.shopPayout.upsert({
        where: { orderId: order.id },
        create: { orderId: order.id, sellerId: order.sellerId, amountMinor: order.sellerEarningMinor, currency: order.currency, status: ShopPayoutStatus.AVAILABLE, availableAt: new Date() },
        update: { status: ShopPayoutStatus.AVAILABLE, availableAt: new Date() },
      });
    }
    for (const item of order.items) {
      await tx.shopProduct.update({ where: { id: item.productId }, data: { purchaseCount: { increment: item.quantity } } });
    }
    return true;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15_000 });
  if (changed) await notifyShopOrderStatus(orderId).catch(() => null);
}

async function executeJob(job: { type: string; payload: Prisma.JsonValue }) {
  const payload = (job.payload ?? {}) as JobPayload;
  if (!payload.orderId) throw new Error("Shop job does not contain orderId");
  if (job.type === "EXPIRE_UNPAID_ORDER") return expireUnpaidOrder(payload.orderId);
  if (job.type === "AUTO_COMPLETE_ORDER") return autoCompleteOrder(payload.orderId);
  throw new Error(`Unknown shop job type: ${job.type}`);
}

export async function runShopJobs(limit = 20) {
  const lockToken = randomUUID();
  const jobs = await db.$transaction(async (tx) => {
    const available = await tx.shopJob.findMany({
      where: { status: ShopJobStatus.PENDING, availableAt: { lte: new Date() } },
      orderBy: { availableAt: "asc" },
      take: Math.min(100, Math.max(1, limit)),
    });
    if (available.length === 0) return [];
    await tx.shopJob.updateMany({
      where: { id: { in: available.map((job) => job.id) }, status: ShopJobStatus.PENDING },
      data: { status: ShopJobStatus.PROCESSING, lockedAt: new Date(), lockToken, attempts: { increment: 1 } },
    });
    return tx.shopJob.findMany({ where: { lockToken, status: ShopJobStatus.PROCESSING } });
  });

  let completed = 0;
  let failed = 0;
  for (const job of jobs) {
    try {
      await executeJob(job);
      await db.shopJob.update({ where: { id: job.id }, data: { status: ShopJobStatus.COMPLETED, completedAt: new Date(), lockToken: null, lockedAt: null } });
      completed += 1;
    } catch (error) {
      const retry = job.attempts < 5;
      await db.shopJob.update({
        where: { id: job.id },
        data: {
          status: retry ? ShopJobStatus.PENDING : ShopJobStatus.FAILED,
          availableAt: new Date(Date.now() + Math.min(60, 2 ** job.attempts) * 60_000),
          lastError: error instanceof Error ? error.message : String(error),
          lockToken: null,
          lockedAt: null,
        },
      });
      failed += 1;
    }
  }
  return { claimed: jobs.length, completed, failed };
}
