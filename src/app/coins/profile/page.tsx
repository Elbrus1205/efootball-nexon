import type { Metadata } from "next";
import { UserCircle } from "lucide-react";
import { CoinsBottomMenu } from "@/components/coins/coins-bottom-menu";
import { CoinsProfileSidebar } from "@/components/coins/coins-profile-sidebar";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
    <main className="page-shell space-y-6 py-0 pb-[calc(8.5rem+env(safe-area-inset-bottom))] sm:pb-[calc(9rem+env(safe-area-inset-bottom))]">
      <Card className="rounded-[2rem] border-primary/15 bg-[linear-gradient(180deg,rgba(9,15,27,0.98),rgba(5,8,14,0.98))]">
        <CardHeader className="mb-0">
          <CardTitle className="flex items-center gap-2 text-2xl font-black">
            <UserCircle className="h-6 w-6 text-primary" />
            Профиль Coins
          </CardTitle>
          <CardDescription>{session.user.nickname || session.user.name || session.user.email || "Игрок"}</CardDescription>
        </CardHeader>
      </Card>

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
        />
      </div>

      <CoinsBottomMenu
        isSignedIn
        isPartner={navigationData.isPartner}
        isExecutor={navigationData.isExecutor}
        servicesEnabled={settings.servicesStoreEnabled}
        buyerOrdersCount={navigationData.buyerOrdersCount}
        buyerActiveOrdersCount={navigationData.buyerActiveOrdersCount}
        executorActiveOrdersCount={navigationData.executorActiveOrdersCount}
        activeItem="profile"
      />
    </main>
  );
}
