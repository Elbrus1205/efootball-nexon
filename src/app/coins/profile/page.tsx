import type { Metadata } from "next";
import { CoinsBottomMenu } from "@/components/coins/coins-bottom-menu";
import { CoinsProfileSidebar } from "@/components/coins/coins-profile-sidebar";
import { requireAuth } from "@/lib/auth/session";
import { getCoinStoreSettings } from "@/lib/coin-services";
import { getCoinsNavigationData } from "@/lib/coins-account";

export const metadata: Metadata = {
  title: "Профиль Coins | eFootball Nexon",
  description: "Профиль и статистика в разделе Coins.",
};

export default async function CoinsProfilePage() {
  const session = await requireAuth();
  const [settings, navigationData] = await Promise.all([
    getCoinStoreSettings(),
    getCoinsNavigationData(session.user.id),
  ]);

  return (
    <main className="page-shell space-y-6 pt-4 sm:pt-6 pb-[calc(8.5rem+env(safe-area-inset-bottom))] sm:pb-[calc(9rem+env(safe-area-inset-bottom))]">
      <div className="max-w-xl">
        <CoinsProfileSidebar
          isSignedIn
          userName={session.user.nickname || session.user.name || session.user.email || undefined}
          isPartner={navigationData.isPartner}
          isExecutor={navigationData.isExecutor}
          buyerOrdersCount={navigationData.buyerOrdersCount}
          buyerActiveOrdersCount={navigationData.buyerActiveOrdersCount}
          executorOrdersCount={navigationData.executorOrdersCount}
          executorActiveOrdersCount={navigationData.executorActiveOrdersCount}
          partnerStats={navigationData.partnerStats}
          hideHeader
          hideNavigation
        />
      </div>

      <CoinsBottomMenu
        isSignedIn
        isPartner={navigationData.isPartner}
        isExecutor={navigationData.isExecutor}
        servicesEnabled={settings.servicesStoreEnabled || settings.coinsStoreEnabled}
        buyerOrdersCount={navigationData.buyerOrdersCount}
        buyerActiveOrdersCount={navigationData.buyerActiveOrdersCount}
        executorActiveOrdersCount={navigationData.executorActiveOrdersCount}
        activeItem="profile"
      />
    </main>
  );
}
