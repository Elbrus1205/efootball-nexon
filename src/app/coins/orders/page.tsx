import type { Metadata } from "next";
import { CoinsBottomMenu } from "@/components/coins/coins-bottom-menu";
import { CoinsOrdersMenu } from "@/components/coins/coins-orders-menu";
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
      <CoinsOrdersMenu
        title="Мои заказы"
        description="Активные, завершенные и отмененные заказы услуг. В карточке видно номер заказа, статус, сумму и дату оформления."
        personLabel="Исполнитель"
        orders={buyerOrders.map((order) => ({
          id: order.id,
          productTitle: order.productTitle,
          priceKopecks: order.priceKopecks,
          status: order.status,
          createdAt: order.createdAt,
          executorName: order.executor?.nickname || order.executor?.name || order.executor?.email || undefined,
        }))}
      />

      {navigationData.isExecutor || executorOrders.length > 0 ? (
        <CoinsOrdersMenu
          title="Заказы в работе"
          description="Заявки, где вы назначены исполнителем: покупатель, сумма, дата и быстрый переход в чат заказа."
          personLabel="Покупатель"
          orders={executorOrders.map((order) => ({
            id: order.id,
            productTitle: order.productTitle,
            priceKopecks: order.priceKopecks,
            status: order.status,
            createdAt: order.createdAt,
            buyerName: order.buyer?.nickname || order.buyer?.name || order.buyer?.email || undefined,
          }))}
        />
      ) : null}

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
