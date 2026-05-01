import type { Metadata } from "next";
import { CoinsProfile } from "@/components/coins/coins-profile";
import { CoinsPartnerBanner } from "@/components/coins/coins-partner-banner";
import { CoinsProfileSidebar } from "@/components/coins/coins-profile-sidebar";
import { CoinsServicesShowcase } from "@/components/coins/coins-services-showcase";
import { CoinsShowcase } from "@/components/coins/coins-showcase";
import { PartnerDashboard } from "@/components/coins/partner-dashboard";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentSession } from "@/lib/auth/session";
import { getCoinStoreSettings } from "@/lib/coin-services";
import { getCoinsProductOffersByPlatform } from "@/lib/coins-products";
import { db } from "@/lib/db";
import { CoinServiceOrderStatus } from "@prisma/client";

export const metadata: Metadata = {
  title: "Coins | eFootball Nexon",
  description: "Покупка Coins для eFootball Mobile через White Store: Android, iOS и акционные наборы с переходом в Telegram-магазин.",
};

function formatMoney(value: number) {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value / 100);
}

export default async function CoinsPage() {
  const session = await getCurrentSession();
  const settings = await getCoinStoreSettings();
  const sessionUserId = session?.user.id;
  const activeOrderStatuses = [CoinServiceOrderStatus.PENDING_REVIEW, CoinServiceOrderStatus.ACCEPTED, CoinServiceOrderStatus.EXECUTOR_DONE];
  const [partner, serviceProducts, buyerOrders, executorOrders, buyerOrdersCount, buyerActiveOrdersCount, executorOrdersCount, executorActiveOrdersCount, executorProfile, offersByPlatform] = await Promise.all([
    session?.user
      ? db.affiliatePartner.findFirst({
          where: { ownerId: session.user.id },
          include: {
            referrals: true,
            purchases: {
              orderBy: { createdAt: "desc" },
            },
            _count: {
              select: {
                referrals: true,
                purchases: true,
              },
            },
          },
        })
      : null,
    settings.servicesStoreEnabled
      ? db.coinServiceProduct.findMany({
          where: { isActive: true },
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        })
      : [],
    sessionUserId
      ? db.coinServiceOrder.findMany({
          where: { buyerId: sessionUserId },
          include: {
            executor: { select: { nickname: true, name: true, email: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 8,
        })
      : [],
    sessionUserId
      ? db.coinServiceOrder.findMany({
          where: { executorId: sessionUserId },
          include: {
            buyer: { select: { nickname: true, name: true, email: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 8,
        })
      : [],
    sessionUserId ? db.coinServiceOrder.count({ where: { buyerId: sessionUserId } }) : 0,
    sessionUserId ? db.coinServiceOrder.count({ where: { buyerId: sessionUserId, status: { in: activeOrderStatuses } } }) : 0,
    sessionUserId ? db.coinServiceOrder.count({ where: { executorId: sessionUserId } }) : 0,
    sessionUserId ? db.coinServiceOrder.count({ where: { executorId: sessionUserId, status: { in: activeOrderStatuses } } }) : 0,
    sessionUserId ? db.coinServiceExecutor.findUnique({ where: { userId: sessionUserId }, select: { isActive: true } }) : null,
    settings.coinsStoreEnabled ? getCoinsProductOffersByPlatform() : Promise.resolve({ android: [], ios: [], promo: [] }),
  ]);

  const partnerTurnover = partner?.purchases.reduce((sum, purchase) => sum + purchase.paidAmountKopecks, 0) ?? 0;
  const partnerProfit = partner?.purchases.reduce((sum, purchase) => sum + purchase.profitKopecks, 0) ?? 0;
  const partnerEarning = partner?.purchases.reduce((sum, purchase) => sum + purchase.partnerEarningKopecks, 0) ?? 0;

  return (
    <main className="page-shell py-0 pb-12 sm:pb-16">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start">
        <div className="space-y-6">
          <CoinsPartnerBanner />
          {session?.user ? (
            <div id="coins-profile">
              <CoinsProfile
                buyerOrders={buyerOrders.map((order) => ({
                  id: order.id,
                  productTitle: order.productTitle,
                  priceKopecks: order.priceKopecks,
                  status: order.status,
                  createdAt: order.createdAt,
                  executorName: order.executor?.nickname || order.executor?.name || order.executor?.email || undefined,
                }))}
                executorOrders={executorOrders.map((order) => ({
                  id: order.id,
                  productTitle: order.productTitle,
                  priceKopecks: order.priceKopecks,
                  status: order.status,
                  createdAt: order.createdAt,
                  buyerName: order.buyer?.nickname || order.buyer?.name || order.buyer?.email || undefined,
                }))}
              />
            </div>
          ) : null}
          {partner ? (
            <div id="partner-panel">
              <PartnerDashboard
                promoCode={partner.promoCode}
                discountPercent={partner.discountPercent}
                partnerPercent={partner.partnerPercent}
                stats={{
                  referrals: partner._count.referrals,
                  purchases: partner._count.purchases,
                  turnover: formatMoney(partnerTurnover),
                  profit: formatMoney(partnerProfit),
                  earning: formatMoney(partnerEarning),
                }}
                referrals={partner.referrals.map((referral) => referral.displayName || referral.contact || referral.referralKey)}
                purchases={partner.purchases.map((purchase) => ({
                  id: purchase.id,
                  title: purchase.offerTitle,
                  amount: formatMoney(purchase.paidAmountKopecks),
                  earning: formatMoney(purchase.partnerEarningKopecks),
                }))}
              />
            </div>
          ) : null}
          {settings.servicesStoreEnabled ? (
            <div id="services">
              <CoinsServicesShowcase products={serviceProducts} />
            </div>
          ) : null}
          <div id="coins-catalog">
            {settings.coinsStoreEnabled ? (
              <CoinsShowcase offersByPlatform={offersByPlatform} />
            ) : (
              <Card>
                <CardHeader className="mb-0">
                  <CardTitle>Магазин монет выключен</CardTitle>
                  <CardDescription>Администратор временно отключил каталог Coins.</CardDescription>
                </CardHeader>
              </Card>
            )}
          </div>
        </div>

        <aside className="xl:sticky xl:top-24">
          <CoinsProfileSidebar
            isSignedIn={Boolean(session?.user)}
            userName={session?.user.nickname || session?.user.name || session?.user.email || undefined}
            isPartner={Boolean(partner)}
            isExecutor={Boolean(executorProfile?.isActive)}
            buyerOrdersCount={buyerOrdersCount}
            buyerActiveOrdersCount={buyerActiveOrdersCount}
            executorOrdersCount={executorOrdersCount}
            executorActiveOrdersCount={executorActiveOrdersCount}
            partnerStats={
              partner
                ? {
                    referrals: partner._count.referrals,
                    purchases: partner._count.purchases,
                    earning: formatMoney(partnerEarning),
                  }
                : undefined
            }
          />
        </aside>
      </div>
    </main>
  );
}
