import { ShopOrderStatus, ShopPaymentStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { canPerformShopAction } from "@/lib/shop/access";
import { decryptShopField } from "@/lib/shop/encryption";
import { ShopError } from "@/lib/shop/errors";
import { getShopPermissionIds } from "@/lib/shop/permissions";

export async function listBuyerShopOrders(userId: string, page = 1, pageSize = 20) {
  const safePage = Math.max(1, page);
  const safeSize = Math.min(50, Math.max(1, pageSize));
  const buyerOrderHistoryWhere = {
    buyerId: userId,
    payments: { some: { status: ShopPaymentStatus.SUCCEEDED } },
  };
  const [total, items] = await db.$transaction([
    db.shopOrder.count({ where: buyerOrderHistoryWhere }),
    db.shopOrder.findMany({
      where: buyerOrderHistoryWhere,
      orderBy: { createdAt: "desc" },
      skip: (safePage - 1) * safeSize,
      take: safeSize,
      include: { items: { take: 1 }, seller: { include: { user: { select: { name: true, image: true } } } } },
    }),
  ]);
  return { items, total, page: safePage, pageSize: safeSize, pageCount: Math.max(1, Math.ceil(total / safeSize)) };
}

export async function listSellerShopOrders(userId: string, page = 1, pageSize = 20) {
  const seller = await db.shopSeller.findFirst({ where: { userId, deletedAt: null } });
  if (!seller) throw new ShopError("SELLER_NOT_FOUND", "Профиль продавца не активен.", 403);
  const safePage = Math.max(1, page);
  const safeSize = Math.min(50, Math.max(1, pageSize));
  const [total, items] = await db.$transaction([
    db.shopOrder.count({ where: { sellerId: seller.id } }),
    db.shopOrder.findMany({
      where: { sellerId: seller.id },
      orderBy: { createdAt: "desc" },
      skip: (safePage - 1) * safeSize,
      take: safeSize,
      include: { items: { take: 1 }, buyer: { select: { name: true, image: true, telegramUsername: true } } },
    }),
  ]);
  return { items, total, page: safePage, pageSize: safeSize, pageCount: Math.max(1, Math.ceil(total / safeSize)) };
}

export async function getShopOrderForUser(orderId: string, userId: string) {
  const order = await db.shopOrder.findUnique({
    where: { id: orderId },
    include: {
      items: true,
      fieldValues: { include: { productField: { select: { key: true, type: true, isSensitive: true } } } },
      statusHistory: { orderBy: { createdAt: "asc" }, include: { actor: { select: { name: true } } } },
      buyer: { select: { id: true, name: true, image: true, telegramUsername: true } },
      seller: { include: { user: { select: { id: true, name: true, image: true, telegramUsername: true } } } },
      payments: { select: { id: true, provider: true, status: true, amountMinor: true, currency: true, checkoutUrl: true, expiresAt: true, paidAt: true } },
      disputes: { orderBy: { createdAt: "desc" }, include: { messages: { where: { isInternal: false }, orderBy: { createdAt: "asc" } } } },
    },
  });
  if (!order) throw new ShopError("ORDER_NOT_FOUND", "Заказ не найден.", 404);
  const permissions = await getShopPermissionIds(userId);
  const allowed = canPerformShopAction("VIEW_ORDER", {
    userId,
    buyerId: order.buyerId,
    sellerUserId: order.seller?.userId,
    isActiveSeller: Boolean(order.seller),
    permissions,
  });
  if (!allowed) throw new ShopError("ORDER_FORBIDDEN", "Заказ принадлежит другому пользователю.", 403);

  const isBuyer = order.buyerId === userId;
  const isSeller = order.seller?.userId === userId;
  const isStaff = permissions.includes("shop.support") || permissions.includes("shop.manage");
  const hiddenFromSeller: ShopOrderStatus[] = [ShopOrderStatus.PENDING_PAYMENT, ShopOrderStatus.PAID];
  const sellerCanSeeFull = isSeller && !hiddenFromSeller.includes(order.status);
  const showFullFields = isBuyer || sellerCanSeeFull || isStaff;
  return {
    ...order,
    fieldValues: order.fieldValues.map((field) => ({
      id: field.id,
      label: field.labelSnapshot,
      key: field.productField.key,
      value: showFullFields ? decryptShopField(field.encryptedValue) : field.maskedValue,
      masked: !showFullFields,
    })),
  };
}
