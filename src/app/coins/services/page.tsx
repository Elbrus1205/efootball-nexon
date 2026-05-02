import type { Metadata } from "next";
import { CoinsBottomMenu } from "@/components/coins/coins-bottom-menu";
import { CoinsPartnerBanner } from "@/components/coins/coins-partner-banner";
import { CoinsServicesShowcase } from "@/components/coins/coins-services-showcase";
import { CoinsShowcase } from "@/components/coins/coins-showcase";
import { getCurrentSession } from "@/lib/auth/session";
import { getCoinStoreSettings } from "@/lib/coin-services";
import { getCoinsNavigationData } from "@/lib/coins-account";
import { getCoinsProductOffersByPlatform } from "@/lib/coins-products";
import { db } from "@/lib/db";

export const metadata: Metadata = {
  title: "Услуги Coins | eFootball Nexon",
  description: "Услуги для eFootball Mobile в разделе Coins.",
};

export default async function CoinsServicesPage() {
  const session = await getCurrentSession();
  const settings = await getCoinStoreSettings();
  const [navigationData, offersByPlatform, serviceProducts] = await Promise.all([
    getCoinsNavigationData(session?.user.id),
    settings.coinsStoreEnabled ? getCoinsProductOffersByPlatform() : Promise.resolve({ android: [], ios: [], promo: [] }),
    settings.servicesStoreEnabled
      ? db.coinServiceProduct.findMany({
          where: { isActive: true },
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        })
      : [],
  ]);

  return (
    <main className="page-shell space-y-3 py-0 pb-[calc(8.5rem+env(safe-area-inset-bottom))] sm:space-y-6 sm:pb-[calc(9rem+env(safe-area-inset-bottom))]">
      {settings.coinsStoreEnabled ? <CoinsPartnerBanner /> : null}
      {settings.coinsStoreEnabled ? <CoinsShowcase offersByPlatform={offersByPlatform} /> : null}
      {settings.servicesStoreEnabled ? <CoinsServicesShowcase products={serviceProducts} /> : null}

      <CoinsBottomMenu
        isSignedIn={Boolean(session?.user)}
        isPartner={navigationData.isPartner}
        isExecutor={navigationData.isExecutor}
        servicesEnabled={settings.servicesStoreEnabled || settings.coinsStoreEnabled}
        buyerOrdersCount={navigationData.buyerOrdersCount}
        buyerActiveOrdersCount={navigationData.buyerActiveOrdersCount}
        executorActiveOrdersCount={navigationData.executorActiveOrdersCount}
        activeItem="services"
      />
    </main>
  );
}
