import { ShopOrderStatus, ShopPaymentStatus, ShopReviewStatus } from "@prisma/client";
import { db } from "@/lib/db";

export async function getShopAdminDashboard(days = 30) {
  const since = new Date(Date.now() - Math.min(365, Math.max(1, days)) * 24 * 60 * 60_000);
  const [settings, categories, products, promotions, promoCodes, sellers, orders, revenue, completed, payments, refunds, disputes, reviews] = await db.$transaction([
    db.shopSettings.findUnique({ where: { id: "default" } }),
    db.shopCategory.findMany({ where: { deletedAt: null }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    db.shopProduct.findMany({ where: { deletedAt: null }, include: { category: true, images: { orderBy: { sortOrder: "asc" }, take: 1 }, fields: { orderBy: { sortOrder: "asc" } }, variants: { where: { deletedAt: null }, orderBy: { sortOrder: "asc" } } }, orderBy: { createdAt: "desc" }, take: 100 }),
    db.shopPromotion.findMany({ where: { deletedAt: null }, include: { products: { include: { product: { select: { id: true, title: true } } } } }, orderBy: { createdAt: "desc" }, take: 100 }),
    db.shopPromoCode.findMany({ where: { deletedAt: null }, include: { _count: { select: { usages: true } } }, orderBy: { createdAt: "desc" }, take: 100 }),
    db.shopSeller.findMany({ where: { deletedAt: null }, include: { user: { select: { publicId: true, name: true, telegramUsername: true } }, _count: { select: { orders: { where: { status: { in: [ShopOrderStatus.ACCEPTED, ShopOrderStatus.IN_PROGRESS, ShopOrderStatus.WAITING_BUYER_CONFIRMATION, ShopOrderStatus.DISPUTE] } } } } } }, orderBy: { createdAt: "desc" } }),
    db.shopOrder.findMany({ where: { createdAt: { gte: since } }, include: { items: { take: 1 }, buyer: { select: { name: true } }, seller: { include: { user: { select: { name: true } } } } }, orderBy: { createdAt: "desc" }, take: 100 }),
    db.shopOrder.aggregate({ where: { paidAt: { gte: since }, status: { notIn: [ShopOrderStatus.CANCELLED, ShopOrderStatus.EXPIRED] } }, _sum: { totalMinor: true }, _avg: { totalMinor: true }, _count: true }),
    db.shopOrder.count({ where: { completedAt: { gte: since }, status: ShopOrderStatus.COMPLETED } }),
    db.shopPayment.count({ where: { createdAt: { gte: since }, status: ShopPaymentStatus.SUCCEEDED } }),
    db.shopRefund.aggregate({ where: { createdAt: { gte: since } }, _sum: { amountMinor: true }, _count: true }),
    db.shopDispute.count({ where: { createdAt: { gte: since } } }),
    db.shopReview.count({ where: { status: ShopReviewStatus.PENDING } }),
  ]);
  return {
    settings,
    categories,
    products,
    promotions,
    promoCodes,
    sellers,
    orders,
    metrics: {
      revenueMinor: revenue._sum.totalMinor ?? 0,
      orders: revenue._count,
      averageOrderMinor: Math.round(revenue._avg.totalMinor ?? 0),
      completed,
      successfulPayments: payments,
      refunds: refunds._count,
      refundAmountMinor: refunds._sum.amountMinor ?? 0,
      disputes,
      pendingReviews: reviews,
    },
  };
}

export async function recalculateProductRating(productId: string) {
  const aggregate = await db.shopReview.aggregate({
    where: { productId, status: ShopReviewStatus.PUBLISHED, deletedAt: null },
    _avg: { rating: true },
    _count: true,
  });
  return db.shopProduct.update({ where: { id: productId }, data: { ratingAverage: aggregate._avg.rating ?? 0, ratingCount: aggregate._count } });
}
