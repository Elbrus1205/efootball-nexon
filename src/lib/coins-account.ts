import { CoinServiceOrderStatus } from "@prisma/client";
import { db } from "@/lib/db";

export const activeCoinServiceOrderStatuses = [
  CoinServiceOrderStatus.PENDING_REVIEW,
  CoinServiceOrderStatus.AWAITING_EXECUTOR,
  CoinServiceOrderStatus.ASSIGNED,
  CoinServiceOrderStatus.ACCEPTED,
  CoinServiceOrderStatus.EXECUTOR_DONE,
];

export function formatCoinsMoney(value: number) {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value / 100);
}

export async function getCoinsNavigationData(userId?: string) {
  const [partner, buyerOrdersCount, buyerActiveOrdersCount, executorOrdersCount, executorActiveOrdersCount, executorProfile] = await Promise.all([
    userId
      ? db.affiliatePartner.findFirst({
          where: { ownerId: userId },
          select: {
            id: true,
            _count: {
              select: {
                referrals: true,
                purchases: true,
              },
            },
          },
        })
      : null,
    userId ? db.coinServiceOrder.count({ where: { buyerId: userId } }) : 0,
    userId ? db.coinServiceOrder.count({ where: { buyerId: userId, status: { in: activeCoinServiceOrderStatuses } } }) : 0,
    userId ? db.coinServiceOrder.count({ where: { executorId: userId } }) : 0,
    userId ? db.coinServiceOrder.count({ where: { executorId: userId, status: { in: activeCoinServiceOrderStatuses } } }) : 0,
    userId ? db.coinServiceExecutor.findUnique({ where: { userId }, select: { isActive: true } }) : null,
  ]);

  const partnerEarning = partner
    ? await db.affiliatePurchase.aggregate({
        where: { partnerId: partner.id },
        _sum: { partnerEarningKopecks: true },
      })
    : null;

  return {
    isPartner: Boolean(partner),
    isExecutor: Boolean(executorProfile?.isActive),
    buyerOrdersCount,
    buyerActiveOrdersCount,
    executorOrdersCount,
    executorActiveOrdersCount,
    partnerStats: partner
      ? {
          referrals: partner._count.referrals,
          purchases: partner._count.purchases,
          earning: formatCoinsMoney(partnerEarning?._sum.partnerEarningKopecks ?? 0),
        }
      : undefined,
  };
}
