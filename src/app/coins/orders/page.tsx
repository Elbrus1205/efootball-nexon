import type { Metadata } from "next";
import { ClipboardList } from "lucide-react";
import { CoinsBottomMenu } from "@/components/coins/coins-bottom-menu";
import { CoinsProfile } from "@/components/coins/coins-profile";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAuth } from "@/lib/auth/session";
import { getCoinStoreSettings } from "@/lib/coin-services";
import { getCoinsNavigationData } from "@/lib/coins-account";
import { db } from "@/lib/db";

export const metadata: Metadata = {
  title: "Заказы Coins | eFootball Nexon",
  description: "Заказы услуг Coins и статусы выполнения.",
};

export default async function CoinsOrdersPage() {
  const session = await requireAuth();
  const [settings, navigationData, buyerOrders, executorOrders] = await Promise.all([
    getCoinStoreSettings(),
    getCoinsNavigationData(session.user.id),
    db.coinServiceOrder.findMany({
      where: { buyerId: session.user.id },
      include: {
        executor: { select: { nickname: true, name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    db.coinServiceOrder.findMany({
      where: { executorId: session.user.id },
      include: {
        buyer: { select: { nickname: true, name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);

  return (
    <main className="page-shell space-y-6 py-0 pb-[calc(8.5rem+env(safe-area-inset-bottom))] sm:pb-[calc(9rem+env(safe-area-inset-bottom))]">
      <Card className="rounded-[2rem] border-primary/15 bg-[linear-gradient(180deg,rgba(9,15,27,0.98),rgba(5,8,14,0.98))]">
        <CardHeader className="mb-0">
          <CardTitle className="flex items-center gap-2 text-2xl font-black">
            <ClipboardList className="h-6 w-6 text-primary" />
            Заказы Coins
          </CardTitle>
          <CardDescription>Покупки услуг, назначенные заказы и переход в чат заказа.</CardDescription>
        </CardHeader>
      </Card>

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

      <CoinsBottomMenu
        isSignedIn
        isPartner={navigationData.isPartner}
        isExecutor={navigationData.isExecutor}
        servicesEnabled={settings.servicesStoreEnabled}
        buyerOrdersCount={navigationData.buyerOrdersCount}
        buyerActiveOrdersCount={navigationData.buyerActiveOrdersCount}
        executorActiveOrdersCount={navigationData.executorActiveOrdersCount}
        activeItem="orders"
      />
    </main>
  );
}
