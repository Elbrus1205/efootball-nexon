import Link from "next/link";
import { ClipboardList, UserCheck } from "lucide-react";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatKopecks, serviceOrderStatusLabel, serviceOrderStatusTone } from "@/lib/coin-services";
import { cn } from "@/lib/utils";
import type { CoinServiceOrderStatus } from "@prisma/client";

type ProfileOrder = {
  id: string;
  productTitle: string;
  priceKopecks: number;
  status: CoinServiceOrderStatus;
  createdAt: Date;
  buyerName?: string;
  executorName?: string;
};

function OrderList({ orders, emptyText }: { orders: ProfileOrder[]; emptyText: string }) {
  if (!orders.length) {
    return <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-4 text-sm text-zinc-500">{emptyText}</div>;
  }

  return (
    <div className="grid gap-2">
      {orders.map((order) => (
        <Link key={order.id} href={`/coins/orders/${order.id}`} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition hover:border-primary/25 hover:bg-white/[0.06]">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate font-semibold text-white">{order.productTitle}</div>
              <div className="mt-1 text-xs text-zinc-500">
                {new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(order.createdAt)}
                {order.executorName ? ` • исполнитель: ${order.executorName}` : ""}
                {order.buyerName ? ` • покупатель: ${order.buyerName}` : ""}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className={cn("rounded-full border px-3 py-1 text-xs font-semibold", serviceOrderStatusTone(order.status))}>
                {serviceOrderStatusLabel(order.status)}
              </span>
              <span className="text-sm font-bold text-emerald-100">{formatKopecks(order.priceKopecks)}</span>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}

export function CoinsProfile({ buyerOrders, executorOrders }: { buyerOrders: ProfileOrder[]; executorOrders: ProfileOrder[] }) {
  return (
    <section className="grid gap-4 xl:grid-cols-2">
      <Card id="buyer-orders" className="scroll-mt-28 rounded-3xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-primary" />
            Профиль покупателя
          </CardTitle>
          <CardDescription>Ваши заказы услуг и чат с исполнителем.</CardDescription>
        </CardHeader>
        <OrderList orders={buyerOrders} emptyText="Покупок услуг пока нет." />
      </Card>

      <Card id="executor-orders" className="scroll-mt-28 rounded-3xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCheck className="h-5 w-5 text-emerald-300" />
            Профиль исполнителя
          </CardTitle>
          <CardDescription>Заказы, где вы назначены исполнителем.</CardDescription>
        </CardHeader>
        <OrderList orders={executorOrders} emptyText="Назначенных заказов пока нет." />
      </Card>
    </section>
  );
}
