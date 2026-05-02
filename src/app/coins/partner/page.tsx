import type { Metadata } from "next";
import { CoinsBottomMenu } from "@/components/coins/coins-bottom-menu";
import { PartnerDashboard } from "@/components/coins/partner-dashboard";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAuth } from "@/lib/auth/session";
import { getCoinStoreSettings } from "@/lib/coin-services";
import { formatCoinsMoney, getCoinsNavigationData } from "@/lib/coins-account";
import { db } from "@/lib/db";

export const metadata: Metadata = {
  title: "Партнёрка Coins | eFootball Nexon",
  description: "Партнёрская статистика Coins.",
};

export default async function CoinsPartnerPage() {
  const session = await requireAuth();
  const [settings, navigationData, partner] = await Promise.all([
    getCoinStoreSettings(),
    getCoinsNavigationData(session.user.id),
    db.affiliatePartner.findFirst({
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
    }),
  ]);

  const partnerTurnover = partner?.purchases.reduce((sum, purchase) => sum + purchase.paidAmountKopecks, 0) ?? 0;
  const partnerProfit = partner?.purchases.reduce((sum, purchase) => sum + purchase.profitKopecks, 0) ?? 0;
  const partnerEarning = partner?.purchases.reduce((sum, purchase) => sum + purchase.partnerEarningKopecks, 0) ?? 0;

  return (
    <main className="page-shell space-y-6 py-0 pb-[calc(8.5rem+env(safe-area-inset-bottom))] sm:pb-[calc(9rem+env(safe-area-inset-bottom))]">
      {partner ? (
        <PartnerDashboard
          defaultOpen
          promoCode={partner.promoCode}
          discountPercent={partner.discountPercent}
          partnerPercent={partner.partnerPercent}
          stats={{
            referrals: partner._count.referrals,
            purchases: partner._count.purchases,
            turnover: formatCoinsMoney(partnerTurnover),
            profit: formatCoinsMoney(partnerProfit),
            earning: formatCoinsMoney(partnerEarning),
          }}
          referrals={partner.referrals.map((referral) => referral.displayName || referral.contact || referral.referralKey)}
          purchases={partner.purchases.map((purchase) => ({
            id: purchase.id,
            title: purchase.offerTitle,
            amount: formatCoinsMoney(purchase.paidAmountKopecks),
            earning: formatCoinsMoney(purchase.partnerEarningKopecks),
          }))}
        />
      ) : (
        <Card>
          <CardHeader className="mb-0">
            <CardTitle>Партнёрская панель недоступна</CardTitle>
            <CardDescription>Для этого аккаунта партнёрка пока не подключена.</CardDescription>
          </CardHeader>
        </Card>
      )}

      <CoinsBottomMenu
        isSignedIn
        isPartner={navigationData.isPartner}
        isExecutor={navigationData.isExecutor}
        servicesEnabled={settings.servicesStoreEnabled || settings.coinsStoreEnabled}
        buyerOrdersCount={navigationData.buyerOrdersCount}
        buyerActiveOrdersCount={navigationData.buyerActiveOrdersCount}
        executorActiveOrdersCount={navigationData.executorActiveOrdersCount}
        activeItem="partner"
      />
    </main>
  );
}
