import { ShopOrderStatus, ShopReviewStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { ShopError } from "@/lib/shop/errors";

export async function createShopReview(input: {
  orderId: string;
  buyerId: string;
  rating: number;
  body: string;
  tags: string[];
  mediaUrls: string[];
}) {
  return db.$transaction(async (tx) => {
    const [order, settings] = await Promise.all([
      tx.shopOrder.findFirst({ where: { id: input.orderId, buyerId: input.buyerId }, include: { items: { take: 1 }, buyer: { select: { name: true } } } }),
      tx.shopSettings.findUnique({ where: { id: "default" } }),
    ]);
    if (!order) throw new ShopError("ORDER_NOT_FOUND", "Заказ не найден.", 404);
    if (order.status !== ShopOrderStatus.COMPLETED) throw new ShopError("REVIEW_NOT_AVAILABLE", "Отзыв можно оставить только после завершения заказа.", 409);
    const item = order.items[0];
    if (!item) throw new ShopError("ORDER_ITEM_NOT_FOUND", "Товар заказа не найден.", 409);
    if (input.mediaUrls.length > 0 && settings?.reviewImagesEnabled === false) throw new ShopError("REVIEW_MEDIA_DISABLED", "Изображения в отзывах отключены.");
    const status = settings?.reviewModerationEnabled === false ? ShopReviewStatus.PUBLISHED : ShopReviewStatus.PENDING;
    const review = await tx.shopReview.create({
      data: {
        orderId: order.id,
        productId: item.productId,
        sellerId: order.sellerId,
        buyerId: order.buyerId,
        buyerName: order.buyer.name?.trim() || "Покупатель",
        rating: input.rating,
        body: input.body,
        tags: input.tags,
        status,
        publishedAt: status === ShopReviewStatus.PUBLISHED ? new Date() : null,
        editableUntil: new Date(Date.now() + (settings?.reviewEditWindowHours ?? 24) * 60 * 60_000),
        media: { create: input.mediaUrls.map((url, index) => ({ url, mimeType: "image/*", sortOrder: index })) },
      },
      include: { media: true },
    });
    if (status === ShopReviewStatus.PUBLISHED) {
      const aggregate = await tx.shopReview.aggregate({ where: { productId: item.productId, status: ShopReviewStatus.PUBLISHED, deletedAt: null }, _avg: { rating: true }, _count: true });
      await tx.shopProduct.update({ where: { id: item.productId }, data: { ratingAverage: aggregate._avg.rating ?? 0, ratingCount: aggregate._count } });
      if (order.sellerId) {
        const sellerAggregate = await tx.shopReview.aggregate({ where: { sellerId: order.sellerId, status: ShopReviewStatus.PUBLISHED, deletedAt: null }, _avg: { rating: true }, _count: true });
        await tx.shopSeller.update({ where: { id: order.sellerId }, data: { ratingAverage: sellerAggregate._avg.rating ?? 0, ratingCount: sellerAggregate._count } });
      }
    }
    return review;
  });
}
