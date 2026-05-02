import type { Metadata } from "next";
import { Briefcase } from "lucide-react";
import { CoinsBottomMenu } from "@/components/coins/coins-bottom-menu";
import { CoinsOrderList } from "@/components/coins/coins-profile";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAuth } from "@/lib/auth/session";
import { getCoinStoreSettings } from "@/lib/coin-services";
import { getCoinsNavigationData } from "@/lib/coins-account";
import { db } from "@/lib/db";

export const metadata: Metadata = {
  title: "Работа Coins | eFootball Nexon",
  description: "Заказы, назначенные исполнителю Coins.",
};

export default async function CoinsWorkPage() {
  const session = await requireAuth();
  const [settings, navigationData, executorOrders] = await Promise.all([
    getCoinStoreSettings(),
    getCoinsNavigationData(session.user.id),
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
      <Card className="rounded-[2rem] border-emerald-300/20 bg-[linear-gradient(180deg,rgba(8,20,17,0.96),rgba(5,10,13,0.98))]">
        <CardHeader className="mb-0">
          <CardTitle className="flex items-center gap-2 text-2xl font-black">
            <Briefcase className="h-6 w-6 text-emerald-200" />
            Работа исполнителя
          </CardTitle>
          <CardDescription>Назначенные заказы, статусы и быстрый переход в чат.</CardDescription>
        </CardHeader>
      </Card>

      {navigationData.isExecutor ? (
        <Card className="rounded-3xl">
          <CardHeader>
            <CardTitle>Мои заказы в работе</CardTitle>
            <CardDescription>Откройте заказ, чтобы написать покупателю или обновить статус.</CardDescription>
          </CardHeader>
          <CoinsOrderList
            orders={executorOrders.map((order) => ({
              id: order.id,
              productTitle: order.productTitle,
              priceKopecks: order.priceKopecks,
              status: order.status,
              createdAt: order.createdAt,
              buyerName: order.buyer?.nickname || order.buyer?.name || order.buyer?.email || undefined,
            }))}
            emptyText="Назначенных заказов пока нет."
          />
        </Card>
      ) : (
        <Card>
          <CardHeader className="mb-0">
            <CardTitle>Панель исполнителя недоступна</CardTitle>
            <CardDescription>Этот аккаунт сейчас не назначен активным исполнителем.</CardDescription>
          </CardHeader>
        </Card>
      )}

      <CoinsBottomMenu
        isSignedIn
        isPartner={navigationData.isPartner}
        isExecutor={navigationData.isExecutor}
        servicesEnabled={settings.servicesStoreEnabled}
        buyerOrdersCount={navigationData.buyerOrdersCount}
        buyerActiveOrdersCount={navigationData.buyerActiveOrdersCount}
        executorActiveOrdersCount={navigationData.executorActiveOrdersCount}
        activeItem="work"
      />
    </main>
  );
}
