import type { Metadata } from "next";
import { CoinsBottomMenu } from "@/components/coins/coins-bottom-menu";
import { CoinsServicesShowcase } from "@/components/coins/coins-services-showcase";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentSession } from "@/lib/auth/session";
import { getCoinStoreSettings } from "@/lib/coin-services";
import { getCoinsNavigationData } from "@/lib/coins-account";
import { db } from "@/lib/db";

export const metadata: Metadata = {
  title: "Услуги Coins | eFootball Nexon",
  description: "Услуги для eFootball Mobile в разделе Coins.",
};

export default async function CoinsServicesPage() {
  const session = await getCurrentSession();
  const settings = await getCoinStoreSettings();
  const [navigationData, serviceProducts] = await Promise.all([
    getCoinsNavigationData(session?.user.id),
    settings.servicesStoreEnabled
      ? db.coinServiceProduct.findMany({
          where: { isActive: true },
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        })
      : [],
  ]);

  return (
    <main className="page-shell space-y-6 py-0 pb-[calc(8.5rem+env(safe-area-inset-bottom))] sm:pb-[calc(9rem+env(safe-area-inset-bottom))]">
      {settings.servicesStoreEnabled ? (
        <CoinsServicesShowcase products={serviceProducts} />
      ) : (
        <Card>
          <CardHeader className="mb-0">
            <CardTitle>Магазин услуг выключен</CardTitle>
            <CardDescription>Администратор временно отключил услуги Coins.</CardDescription>
          </CardHeader>
        </Card>
      )}

      <CoinsBottomMenu
        isSignedIn={Boolean(session?.user)}
        isPartner={navigationData.isPartner}
        isExecutor={navigationData.isExecutor}
        servicesEnabled={settings.servicesStoreEnabled}
        buyerOrdersCount={navigationData.buyerOrdersCount}
        buyerActiveOrdersCount={navigationData.buyerActiveOrdersCount}
        executorActiveOrdersCount={navigationData.executorActiveOrdersCount}
        activeItem="services"
      />
    </main>
  );
}
