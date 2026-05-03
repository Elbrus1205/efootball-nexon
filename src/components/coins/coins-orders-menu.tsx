import Link from "next/link";
import type { CoinServiceOrderStatus } from "@prisma/client";
import { ArrowRight, CalendarDays, CheckCircle2, CircleDollarSign, ClipboardList, Clock3, Hash, PackageCheck, ReceiptText, UserRound, XCircle } from "lucide-react";
import { formatKopecks, serviceOrderStatusLabel, serviceOrderStatusTone } from "@/lib/coin-services";
import { cn } from "@/lib/utils";

export type CoinsMenuOrder = {
  id: string;
  productTitle: string;
  priceKopecks: number;
  status: CoinServiceOrderStatus;
  createdAt: Date;
  buyerName?: string;
  executorName?: string;
};

type OrderGroup = {
  key: "active" | "completed" | "cancelled";
  title: string;
  description: string;
  icon: typeof Clock3;
  statuses: CoinServiceOrderStatus[];
  tone: string;
  emptyText: string;
};

const orderGroups: OrderGroup[] = [
  {
    key: "active",
    title: "Активные заказы",
    description: "Ожидают проверки, находятся в работе или ждут подтверждения.",
    icon: Clock3,
    statuses: ["PENDING_REVIEW", "AWAITING_EXECUTOR", "ASSIGNED", "ACCEPTED", "EXECUTOR_DONE"],
    tone: "border-sky-300/20 bg-sky-400/10 text-sky-100",
    emptyText: "Активных заказов сейчас нет.",
  },
  {
    key: "completed",
    title: "Завершенные",
    description: "Выполненные заказы с подтвержденным результатом.",
    icon: CheckCircle2,
    statuses: ["COMPLETED"],
    tone: "border-emerald-300/20 bg-emerald-400/10 text-emerald-100",
    emptyText: "Завершенных заказов пока нет.",
  },
  {
    key: "cancelled",
    title: "Отмененные",
    description: "Отклоненные или отмененные заявки.",
    icon: XCircle,
    statuses: ["REJECTED"],
    tone: "border-rose-300/20 bg-rose-400/10 text-rose-100",
    emptyText: "Отмененных заказов нет.",
  },
];

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

function orderNumber(id: string) {
  return id.slice(-6).toUpperCase();
}

function getOrdersByGroup(orders: CoinsMenuOrder[], group: OrderGroup) {
  return orders.filter((order) => group.statuses.includes(order.status));
}

function OrderCard({ order, personLabel }: { order: CoinsMenuOrder; personLabel: "Исполнитель" | "Покупатель" }) {
  const personName = personLabel === "Исполнитель" ? order.executorName : order.buyerName;

  return (
    <Link
      href={`/coins/orders/${order.id}`}
      className="group block rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.045),rgba(255,255,255,0.02))] p-3.5 transition duration-300 hover:-translate-y-0.5 hover:border-primary/30 hover:bg-white/[0.06] sm:p-4"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
            <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-black/20 px-2.5 py-1 font-semibold text-zinc-300">
              <Hash className="h-3.5 w-3.5" />
              {orderNumber(order.id)}
            </span>
            <span className={cn("rounded-full border px-2.5 py-1 font-semibold", serviceOrderStatusTone(order.status))}>
              {serviceOrderStatusLabel(order.status)}
            </span>
          </div>

          <h3 className="mt-3 line-clamp-2 text-base font-black leading-tight text-white sm:text-lg">{order.productTitle}</h3>

          <div className="mt-3 grid gap-2 text-xs text-zinc-400 sm:grid-cols-2">
            <div className="inline-flex min-w-0 items-center gap-2">
              <CalendarDays className="h-4 w-4 shrink-0 text-zinc-500" />
              <span className="truncate">{formatDate(order.createdAt)}</span>
            </div>
            <div className="inline-flex min-w-0 items-center gap-2">
              <UserRound className="h-4 w-4 shrink-0 text-zinc-500" />
              <span className="truncate">
                {personLabel}: {personName || "не назначен"}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 sm:min-w-[168px] sm:flex-col sm:items-end">
          <div className="rounded-xl border border-emerald-300/15 bg-emerald-400/10 px-3 py-2 text-right">
            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-100/60">Сумма</div>
            <div className="mt-1 text-base font-black leading-none text-emerald-100">{formatKopecks(order.priceKopecks)}</div>
          </div>
          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-sky-100 transition group-hover:text-white">
            Открыть
            <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
          </span>
        </div>
      </div>
    </Link>
  );
}

function OrdersGroup({ group, orders, personLabel }: { group: OrderGroup; orders: CoinsMenuOrder[]; personLabel: "Исполнитель" | "Покупатель" }) {
  const Icon = group.icon;

  return (
    <section className="rounded-2xl border border-white/10 bg-black/20 p-3.5 sm:p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border", group.tone)}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-black leading-tight text-white sm:text-lg">{group.title}</h2>
            <p className="mt-1 text-xs leading-5 text-zinc-500 sm:text-sm">{group.description}</p>
          </div>
        </div>
        <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-black text-zinc-200">{orders.length}</span>
      </div>

      {orders.length ? (
        <div className="grid gap-2.5">
          {orders.map((order) => (
            <OrderCard key={order.id} order={order} personLabel={personLabel} />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.03] p-4 text-sm text-zinc-500">{group.emptyText}</div>
      )}
    </section>
  );
}

function OrdersSummary({ orders }: { orders: CoinsMenuOrder[] }) {
  const active = getOrdersByGroup(orders, orderGroups[0]).length;
  const completed = getOrdersByGroup(orders, orderGroups[1]).length;
  const cancelled = getOrdersByGroup(orders, orderGroups[2]).length;
  const totalAmount = orders.reduce((sum, order) => sum + order.priceKopecks, 0);

  const stats = [
    { label: "Активные", value: active, icon: Clock3, tone: "text-sky-100 bg-sky-400/10 border-sky-300/20" },
    { label: "Выполнено", value: completed, icon: PackageCheck, tone: "text-emerald-100 bg-emerald-400/10 border-emerald-300/20" },
    { label: "Отменено", value: cancelled, icon: XCircle, tone: "text-rose-100 bg-rose-400/10 border-rose-300/20" },
    { label: "Сумма заказов", value: formatKopecks(totalAmount), icon: CircleDollarSign, tone: "text-amber-100 bg-amber-400/10 border-amber-300/20" },
  ];

  return (
    <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
      {stats.map((stat) => {
        const Icon = stat.icon;

        return (
          <div key={stat.label} className="rounded-2xl border border-white/10 bg-white/[0.035] p-3.5">
            <div className={cn("mb-3 flex h-9 w-9 items-center justify-center rounded-xl border", stat.tone)}>
              <Icon className="h-[18px] w-[18px]" />
            </div>
            <div className="text-[11px] font-semibold text-zinc-500">{stat.label}</div>
            <div className="mt-1 text-lg font-black leading-tight text-white sm:text-xl">{stat.value}</div>
          </div>
        );
      })}
    </div>
  );
}

export function CoinsOrdersMenu({
  title,
  description,
  orders,
  personLabel,
}: {
  title: string;
  description: string;
  orders: CoinsMenuOrder[];
  personLabel: "Исполнитель" | "Покупатель";
}) {
  return (
    <section className="space-y-4 rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(10,14,22,0.96),rgba(5,8,13,0.98))] p-3.5 shadow-[0_20px_70px_rgba(0,0,0,0.24)] sm:p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] font-semibold text-zinc-300">
            <ClipboardList className="h-4 w-4 text-sky-300" />
            Меню заказов
          </div>
          <h1 className="mt-3 text-2xl font-black leading-tight text-white sm:text-3xl">{title}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">{description}</p>
        </div>
        <div className="inline-flex w-fit items-center gap-2 rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-xs font-semibold text-zinc-300">
          <ReceiptText className="h-4 w-4 text-amber-200" />
          Всего: {orders.length}
        </div>
      </div>

      <OrdersSummary orders={orders} />

      <div className="grid gap-3">
        {orderGroups.map((group) => (
          <OrdersGroup key={group.key} group={group} orders={getOrdersByGroup(orders, group)} personLabel={personLabel} />
        ))}
      </div>
    </section>
  );
}
