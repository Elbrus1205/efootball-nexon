import type { Metadata } from "next";
import { CoinsBottomMenu } from "@/components/coins/coins-bottom-menu";
import { CoinsPurchasesHistory } from "@/components/coins/coins-purchases-history";
import { getCurrentSession } from "@/lib/auth/session";
import { getCoinStoreSettings } from "@/lib/coin-services";
import { getCoinsNavigationData } from "@/lib/coins-account";
import { db } from "@/lib/db";

export const metadata: Metadata = {
  title: "Покупки Coins | eFootball Nexon",
  description: "Каталог Coins для eFootball Mobile.",
};

export default async function CoinsPurchasesPage() {
  const session = await getCurrentSession();
  const settings = await getCoinStoreSettings();
  const [navigationData, purchaseHistory] = await Promise.all([
    getCoinsNavigationData(session?.user.id),
    session?.user.id
      ? db.affiliatePurchase.findMany({
          where: { buyerUserId: session.user.id },
          orderBy: { createdAt: "desc" },
          take: 50,
          select: {
            id: true,
            offerTitle: true,
            platform: true,
            salePriceKopecks: true,
            discountKopecks: true,
            paidAmountKopecks: true,
            createdAt: true,
            promoCode: true,
          },
        })
      : Promise.resolve([]),
  ]);

  return (
    <main className="page-shell space-y-6 pt-4 sm:pt-6 pb-[calc(8.5rem+env(safe-area-inset-bottom))] sm:pb-[calc(9rem+env(safe-area-inset-bottom))]">
      <CoinsPurchasesHistory purchases={purchaseHistory} isSignedIn={Boolean(session?.user)} />

      <CoinsBottomMenu
        isSignedIn={Boolean(session?.user)}
        isPartner={navigationData.isPartner}
        isExecutor={navigationData.isExecutor}
        servicesEnabled={settings.servicesStoreEnabled || settings.coinsStoreEnabled}
        buyerOrdersCount={navigationData.buyerOrdersCount}
        buyerActiveOrdersCount={navigationData.buyerActiveOrdersCount}
        executorActiveOrdersCount={navigationData.executorActiveOrdersCount}
        activeItem="purchases"
      />
    </main>
  );
}
