import type { Metadata } from "next";
import { Briefcase, CheckCircle2, Clock3, Wallet } from "lucide-react";
import { CoinServiceOrderStatus } from "@prisma/client";
import { CoinsBottomMenu } from "@/components/coins/coins-bottom-menu";
import { CoinsOrderList } from "@/components/coins/coins-profile";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAuth } from "@/lib/auth/session";
import { formatKopecks, getCoinStoreSettings } from "@/lib/coin-services";
import { getCoinsNavigationData } from "@/lib/coins-account";
import { db } from "@/lib/db";

export const metadata: Metadata = {
  title: "Работа Coins | eFootball Nexon",
  description: "Заказы, назначенные исполнителю Coins.",
};

export default async function CoinsWorkPage() {
  const session = await requireAuth();
  const [settings, navigationData, executorOrders, completedEarnings, activeEarnings, completedOrdersCount] = await Promise.all([
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
    db.coinServiceOrder.aggregate({
      where: {
        executorId: session.user.id,
        status: CoinServiceOrderStatus.COMPLETED,
      },
      _sum: { executorEarningKopecks: true },
    }),
    db.coinServiceOrder.aggregate({
      where: {
        executorId: session.user.id,
        status: {
          in: [CoinServiceOrderStatus.ASSIGNED, CoinServiceOrderStatus.ACCEPTED, CoinServiceOrderStatus.EXECUTOR_DONE],
        },
      },
      _sum: { executorEarningKopecks: true },
    }),
    db.coinServiceOrder.count({
      where: {
        executorId: session.user.id,
        status: CoinServiceOrderStatus.COMPLETED,
      },
    }),
  ]);

  const executorActiveOrders = executorOrders.filter(
    (order) =>
      order.status === CoinServiceOrderStatus.ASSIGNED ||
      order.status === CoinServiceOrderStatus.ACCEPTED ||
      order.status === CoinServiceOrderStatus.EXECUTOR_DONE,
  ).length;

  return (
    <main className="page-shell space-y-6 pt-4 sm:pt-6 pb-[calc(8.5rem+env(safe-area-inset-bottom))] sm:pb-[calc(9rem+env(safe-area-inset-bottom))]">
      <Card className="rounded-[2rem] border-emerald-300/20 bg-[linear-gradient(180deg,rgba(8,20,17,0.96),rgba(5,10,13,0.98))] p-4 sm:p-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              label: "Заработано",
              value: formatKopecks(completedEarnings._sum.executorEarningKopecks ?? 0),
              icon: Wallet,
              className: "border-emerald-300/20 bg-emerald-400/10 text-emerald-100",
            },
            {
              label: "Завершено",
              value: completedOrdersCount,
              icon: CheckCircle2,
              className: "border-sky-300/20 bg-sky-400/10 text-sky-100",
            },
            {
              label: "В работе",
              value: executorActiveOrders,
              icon: Briefcase,
              className: "border-primary/20 bg-primary/10 text-blue-100",
            },
            {
              label: "Сумма в работе",
              value: formatKopecks(activeEarnings._sum.executorEarningKopecks ?? 0),
              icon: Clock3,
              className: "border-amber-300/20 bg-amber-300/10 text-amber-100",
            },
          ].map((item) => (
            <div key={item.label} className={`rounded-2xl border p-4 ${item.className}`}>
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em]">
                <item.icon className="h-4 w-4" />
                {item.label}
              </div>
              <div className="mt-2 text-2xl font-black text-white">{item.value}</div>
            </div>
          ))}
        </div>
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
        servicesEnabled={settings.servicesStoreEnabled || settings.coinsStoreEnabled}
        buyerOrdersCount={navigationData.buyerOrdersCount}
        buyerActiveOrdersCount={navigationData.buyerActiveOrdersCount}
        executorActiveOrdersCount={navigationData.executorActiveOrdersCount}
        activeItem="work"
      />
    </main>
  );
}
