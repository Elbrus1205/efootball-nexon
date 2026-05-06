import Link from "next/link";
import { CoinServiceOrderStatus, UserRole } from "@prisma/client";
import { ArrowLeft, CheckCircle2, Clock, CreditCard, KeyRound, MessageSquareText, Paperclip, UserRoundCheck, XCircle } from "lucide-react";
import { notFound } from "next/navigation";
import { BankLogo } from "@/components/coins/bank-logo";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { requireAuth } from "@/lib/auth/session";
import { formatKopecks, serviceOrderStatusLabel, serviceOrderStatusTone } from "@/lib/coin-services";
import { db } from "@/lib/db";
import { cn } from "@/lib/utils";

type OrderPageProps = {
  params: { id: string };
  searchParams?: {
    created?: string;
    error?: string;
    messageSent?: string;
    orderUpdated?: string;
  };
};

function displayUser(user?: { nickname?: string | null; name?: string | null; email?: string | null } | null) {
  return user?.nickname || user?.name || user?.email || "Пользователь";
}

function isAdmin(role: UserRole) {
  return role === UserRole.FOUNDER || role === UserRole.ORGANIZER;
}

export default async function CoinServiceOrderPage({ params, searchParams }: OrderPageProps) {
  const session = await requireAuth();
  const order = await db.coinServiceOrder.findUnique({
    where: { id: params.id },
    include: {
      buyer: { select: { id: true, nickname: true, name: true, email: true } },
      executor: { select: { id: true, nickname: true, name: true, email: true } },
      messages: {
        include: {
          sender: { select: { id: true, nickname: true, name: true, email: true } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  const admin = isAdmin(session.user.role);

  if (!order || (!admin && order.buyerId !== session.user.id && order.executorId !== session.user.id)) {
    notFound();
  }

  const canExecutorRespond = order.status === CoinServiceOrderStatus.ASSIGNED && (admin || order.executorId === session.user.id);
  const canExecutorComplete = order.status === CoinServiceOrderStatus.ACCEPTED && order.executorId === session.user.id;
  const canBuyerComplete =
    (order.status === CoinServiceOrderStatus.ACCEPTED || order.status === CoinServiceOrderStatus.EXECUTOR_DONE) && order.buyerId === session.user.id;
  const showPaymentDetails = !order.paidAt;
  const chatOpen = order.status !== CoinServiceOrderStatus.COMPLETED;

  return (
    <main className="page-shell space-y-6 pt-4 sm:pt-6 pb-12 sm:pb-16">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button asChild variant="outline" className="h-11 rounded-full border-white/15 bg-white/[0.04] hover:bg-white/[0.08]">
          <Link href="/coins/orders">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Назад к заказам
          </Link>
        </Button>
        <span className={cn("rounded-full border px-4 py-2 text-sm font-semibold", serviceOrderStatusTone(order.status))}>
          {serviceOrderStatusLabel(order.status)}
        </span>
      </div>

      {searchParams?.created ? <Card className="border-emerald-400/20 bg-emerald-500/10 p-4 text-sm text-emerald-100">Заказ отправлен на проверку вместе с чеком оплаты. После подтверждения админом назначится исполнитель.</Card> : null}
      {searchParams?.error ? <Card className="border-rose-400/25 bg-rose-500/10 p-4 text-sm text-rose-100">{searchParams.error}</Card> : null}
      {searchParams?.orderUpdated ? <Card className="border-emerald-400/20 bg-emerald-500/10 p-4 text-sm text-emerald-100">Статус заказа обновлён.</Card> : null}
      {searchParams?.messageSent ? <Card className="border-sky-400/20 bg-sky-500/10 p-4 text-sm text-sky-100">Сообщение отправлено.</Card> : null}

      <section className={cn("grid gap-4", chatOpen && "xl:grid-cols-[0.95fr_1.05fr]")}>
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{order.productTitle}</CardTitle>
              <CardDescription>{order.productDescription}</CardDescription>
            </CardHeader>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Сумма</div>
                <div className="mt-2 text-2xl font-black text-emerald-100">{formatKopecks(order.priceKopecks)}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Исполнитель</div>
                <div className="mt-2 text-lg font-bold text-white">{order.executor ? displayUser(order.executor) : "Ещё не назначен"}</div>
              </div>
            </div>
          </Card>

          {showPaymentDetails ? (
            <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-emerald-300" />
                Реквизиты оплаты
              </CardTitle>
              <CardDescription>Переведите сумму и укажите комментарий, если он задан администратором.</CardDescription>
            </CardHeader>
            <div className="grid gap-3 text-sm">
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <span className="text-zinc-500">Банк: </span>
                {order.paymentBank ? <BankLogo bank={order.paymentBank} className="ml-1" /> : <span className="font-semibold text-white">не указан</span>}
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <span className="text-zinc-500">Карта: </span>
                <span className="font-semibold text-white">{order.paymentCard || "не указана"}</span>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <span className="text-zinc-500">Получатель: </span>
                <span className="font-semibold text-white">{order.paymentRecipient || "не указан"}</span>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <span className="text-zinc-500">Комментарий: </span>
                <span className="font-semibold text-white">{order.paymentComment || "не указан"}</span>
              </div>
              <div className="rounded-2xl border border-emerald-300/15 bg-emerald-400/10 p-4">
                <span className="text-emerald-100/70">Чек оплаты: </span>
                {order.paymentReceiptUrl ? (
                  <a href={order.paymentReceiptUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 font-semibold text-emerald-100 underline-offset-4 hover:underline">
                    <Paperclip className="h-4 w-4" />
                    открыть чек
                  </a>
                ) : (
                  <span className="font-semibold text-amber-100">не прикреплён</span>
                )}
              </div>
            </div>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <KeyRound className="h-5 w-5 text-amber-300" />
                Данные заказа
              </CardTitle>
              <CardDescription>Доступны покупателю, администратору и назначенному исполнителю.</CardDescription>
            </CardHeader>
            <div className="grid gap-3 text-sm">
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <span className="text-zinc-500">Telegram: </span>
                <span className="font-semibold text-white">{order.buyerTelegram}</span>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <span className="text-zinc-500">Логин Konami ID: </span>
                <span className="font-semibold text-white">{order.konamiLogin}</span>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <span className="text-zinc-500">Пароль Konami ID: </span>
                <span className="font-semibold text-white">{order.konamiPassword}</span>
              </div>
              {order.buyerComment ? <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-zinc-300">{order.buyerComment}</div> : null}
              {order.adminComment ? <div className="rounded-2xl border border-primary/20 bg-primary/10 p-4 text-blue-100">{order.adminComment}</div> : null}
            </div>
          </Card>

          <div className="grid gap-3 sm:grid-cols-2">
            {canExecutorRespond ? (
              <div className="space-y-3 sm:col-span-2">
                <form action={`/api/coins/service-orders/${order.id}/actions`} method="post">
                  <input type="hidden" name="_action" value="executor_accept" />
                  <Button className="w-full rounded-xl bg-emerald-400 text-black hover:bg-emerald-300">
                    <UserRoundCheck className="mr-2 h-4 w-4" />
                    Принять заказ в работу
                  </Button>
                </form>

                <form action={`/api/coins/service-orders/${order.id}/actions`} method="post" className="space-y-2 rounded-2xl border border-rose-400/20 bg-rose-500/10 p-3">
                  <input type="hidden" name="_action" value="executor_reject" />
                  <Textarea name="reason" required placeholder="Причина отказа" className="min-h-[92px] resize-none bg-black/30" />
                  <Button variant="outline" className="w-full rounded-xl border-rose-400/25 bg-rose-500/10 text-rose-100 hover:bg-rose-500/20">
                    <XCircle className="mr-2 h-4 w-4" />
                    Отказаться от заказа
                  </Button>
                </form>
              </div>
            ) : null}

            {canExecutorComplete ? (
              <form action={`/api/coins/service-orders/${order.id}/actions`} method="post" className="sm:col-span-2">
                <input type="hidden" name="_action" value="executor_done" />
                <Button className="w-full rounded-xl bg-sky-400 text-slate-950 hover:bg-sky-300">
                  <UserRoundCheck className="mr-2 h-4 w-4" />
                  Заказ выполнен
                </Button>
              </form>
            ) : null}

            {canBuyerComplete ? (
              <form action={`/api/coins/service-orders/${order.id}/actions`} method="post">
                <input type="hidden" name="_action" value="buyer_complete" />
                <Button className="w-full rounded-xl bg-emerald-400 text-black hover:bg-emerald-300">
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Подтвердить выполнение
                </Button>
              </form>
            ) : null}
          </div>
        </div>

        {chatOpen ? (
          <Card className="flex min-h-[620px] flex-col overflow-hidden rounded-[2rem] border-primary/15 bg-[linear-gradient(180deg,rgba(9,15,27,0.98),rgba(5,8,14,0.98))]">
          <CardHeader className="border-b border-white/10">
            <CardTitle className="flex items-center gap-2">
              <MessageSquareText className="h-5 w-5 text-primary" />
              Чат заказа
            </CardTitle>
            <CardDescription>Покупатель, исполнитель и администратор видят переписку по заказу.</CardDescription>
            <div className="flex flex-wrap gap-2 pt-2 text-xs">
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-zinc-300">Покупатель: {displayUser(order.buyer)}</span>
              <span className="rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-1 text-emerald-100">
                Исполнитель: {order.executor ? displayUser(order.executor) : "ожидает назначения"}
              </span>
            </div>
          </CardHeader>

          <div className="flex-1 space-y-4 overflow-y-auto bg-black/20 p-4">
            {order.messages.map((message) => {
              const own = message.senderId === session.user.id;
              const senderName = displayUser(message.sender);
              const senderRole = message.senderId === order.buyerId ? "Покупатель" : message.senderId === order.executorId ? "Исполнитель" : "Админ";
              const avatar = senderName.slice(0, 1).toUpperCase();

              return (
                <div key={message.id} className={cn("flex gap-3", own ? "justify-end" : "justify-start")}>
                  {!own ? (
                    <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-sm font-bold text-zinc-200">
                      {avatar}
                    </div>
                  ) : null}
                  <div className={cn("max-w-[86%] rounded-2xl border px-4 py-3 shadow-[0_18px_40px_rgba(0,0,0,0.18)]", own ? "border-primary/25 bg-primary/15" : "border-white/10 bg-white/[0.05]")}>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                      <span className="font-semibold text-zinc-200">{senderName}</span>
                      <span className={cn("rounded-full border px-2 py-0.5", own ? "border-primary/20 text-blue-100" : "border-white/10 text-zinc-400")}>{senderRole}</span>
                      <Clock className="h-3.5 w-3.5" />
                      {new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(message.createdAt)}
                    </div>
                    <div className="mt-2 whitespace-pre-wrap text-sm leading-6 text-white">{message.body}</div>
                  </div>
                  {own ? (
                    <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-primary/25 bg-primary/15 text-sm font-bold text-blue-100">
                      {avatar}
                    </div>
                  ) : null}
                </div>
              );
            })}
            {!order.messages.length ? (
              <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] p-5 text-center text-sm text-zinc-500">Сообщений пока нет.</div>
            ) : null}
          </div>

          <form action={`/api/coins/service-orders/${order.id}/messages`} method="post" className="space-y-3 border-t border-white/10 bg-black/25 p-4">
            <Textarea name="body" required placeholder="Напишите сообщение по заказу" className="min-h-[104px] resize-none bg-black/30" />
            <Button className="w-full rounded-xl">
              <MessageSquareText className="mr-2 h-4 w-4" />
              Отправить сообщение
            </Button>
          </form>
          </Card>
        ) : null}
      </section>
    </main>
  );
}
