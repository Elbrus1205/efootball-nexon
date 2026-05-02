import type { Metadata } from "next";
import { CoinsBottomMenu } from "@/components/coins/coins-bottom-menu";
import { CoinsPartnerBanner } from "@/components/coins/coins-partner-banner";
import { CoinsShowcase } from "@/components/coins/coins-showcase";
import { getCurrentSession } from "@/lib/auth/session";
import { getCoinStoreSettings } from "@/lib/coin-services";
import { getCoinsNavigationData } from "@/lib/coins-account";
import { getCoinsProductOffersByPlatform } from "@/lib/coins-products";

export const metadata: Metadata = {
  title: "Coins | eFootball Nexon",
  description: "Покупка Coins для eFootball Mobile через White Store: Android, iOS и акционные наборы с переходом в Telegram-магазин.",
};

export default async function CoinsPage() {
  const session = await getCurrentSession();
  const settings = await getCoinStoreSettings();
  const sessionUserId = session?.user.id;
  const [navigationData, offersByPlatform] = await Promise.all([
    getCoinsNavigationData(sessionUserId),
    settings.coinsStoreEnabled ? getCoinsProductOffersByPlatform() : Promise.resolve({ android: [], ios: [], promo: [] }),
  ]);

  return (
    <main className="page-shell space-y-6 py-0 pb-[calc(8.5rem+env(safe-area-inset-bottom))] sm:pb-[calc(9rem+env(safe-area-inset-bottom))]">
      <CoinsPartnerBanner />
      {settings.coinsStoreEnabled ? <CoinsShowcase offersByPlatform={offersByPlatform} /> : null}

      <CoinsBottomMenu
        isSignedIn={Boolean(session?.user)}
        isPartner={navigationData.isPartner}
        isExecutor={navigationData.isExecutor}
        servicesEnabled={settings.servicesStoreEnabled}
        buyerOrdersCount={navigationData.buyerOrdersCount}
        buyerActiveOrdersCount={navigationData.buyerActiveOrdersCount}
        executorActiveOrdersCount={navigationData.executorActiveOrdersCount}
        activeItem="purchases"
      />
    </main>
  );
}
