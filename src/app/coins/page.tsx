import type { Metadata } from "next";
import { CoinsBottomMenu } from "@/components/coins/coins-bottom-menu";
import { CoinsPartnerBanner } from "@/components/coins/coins-partner-banner";
import { CoinsProfileSidebar } from "@/components/coins/coins-profile-sidebar";
import { CoinsShowcase } from "@/components/coins/coins-showcase";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
    <main className="page-shell py-0 pb-[calc(8.5rem+env(safe-area-inset-bottom))] sm:pb-[calc(9rem+env(safe-area-inset-bottom))]">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start">
        <div className="space-y-6">
          <CoinsPartnerBanner />
          <div>
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
            isPartner={navigationData.isPartner}
            isExecutor={navigationData.isExecutor}
            buyerOrdersCount={navigationData.buyerOrdersCount}
            buyerActiveOrdersCount={navigationData.buyerActiveOrdersCount}
            executorOrdersCount={navigationData.executorOrdersCount}
            executorActiveOrdersCount={navigationData.executorActiveOrdersCount}
            partnerStats={navigationData.partnerStats}
          />
        </aside>
      </div>

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
