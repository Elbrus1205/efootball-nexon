import { Coins, CreditCard, Handshake, PackagePlus, Percent, Search, Settings, Trash2, UserCheck, Users } from "lucide-react";
import { CoinServiceOrderStatus, UserRole } from "@prisma/client";
import { BankLogo } from "@/components/coins/bank-logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { requireRole } from "@/lib/auth/session";
import { coinPaymentBankOptions, getCoinStoreSettings, serviceOrderStatusLabel, serviceOrderStatusTone } from "@/lib/coin-services";
import { db } from "@/lib/db";

function formatMoney(value: number) {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value / 100);
}

function displayUser(user?: { nickname?: string | null; name?: string | null; email?: string | null } | null) {
  return user?.nickname || user?.name || user?.email || "Пользователь";
}

export default async function AdminCoinsPage({
  searchParams,
}: {
  searchParams?: {
    userQuery?: string;
    created?: string;
    deleted?: string;
    productCreated?: string;
    productUpdated?: string;
    productDeleted?: string;
    settingsUpdated?: string;
    serviceProductCreated?: string;
    serviceProductUpdated?: string;
    serviceProductDeleted?: string;
    paymentCardCreated?: string;
    paymentCardUpdated?: string;
    paymentCardDeleted?: string;
    executorCreated?: string;
    executorDeleted?: string;
    orderUpdated?: string;
    error?: string;
  };
}) {
  await requireRole([UserRole.FOUNDER]);

  const userQuery = searchParams?.userQuery?.trim() ?? "";
  const users = userQuery
    ? await db.user.findMany({
        where: {
          OR: [
            { nickname: { contains: userQuery, mode: "insensitive" } },
            { name: { contains: userQuery, mode: "insensitive" } },
            { email: { contains: userQuery, mode: "insensitive" } },
          ],
        },
        orderBy: [{ nickname: "asc" }, { createdAt: "desc" }],
        take: 12,
      })
    : await db.user.findMany({
        orderBy: [{ nickname: "asc" }, { createdAt: "desc" }],
        take: 12,
      });

  const settings = await getCoinStoreSettings();
  const [partners, products, serviceProducts, executorProfiles, paymentCards, serviceOrders] = await Promise.all([
    db.affiliatePartner.findMany({
    include: {
      owner: true,
      referrals: true,
      purchases: {
        orderBy: { createdAt: "desc" },
      },
      _count: {
        select: {
          referrals: true,
          purchases: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    }),
    db.coinProduct.findMany({
      where: { isActive: true },
      orderBy: [{ platform: "asc" }, { coins: "asc" }, { createdAt: "desc" }],
    }),
    db.coinServiceProduct.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    }),
    db.coinServiceExecutor.findMany({
      where: { isActive: true },
      include: {
        user: {
          select: { id: true, nickname: true, name: true, email: true, role: true },
        },
      },
      orderBy: { createdAt: "asc" },
    }),
    db.coinPaymentCard.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    }),
    db.coinServiceOrder.findMany({
      include: {
        buyer: { select: { nickname: true, name: true, email: true } },
        executor: { select: { nickname: true, name: true, email: true } },
        executorAttempts: {
          include: {
            executor: { select: { nickname: true, name: true, email: true } },
          },
          orderBy: { createdAt: "desc" },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
  ]);
  const executorIds = executorProfiles.map((profile) => profile.userId);
  const executorOrderCounts = executorIds.length
    ? await db.coinServiceOrder.groupBy({
        by: ["executorId"],
        where: {
          executorId: { in: executorIds },
          status: { not: CoinServiceOrderStatus.REJECTED },
        },
        _count: { _all: true },
      })
    : [];
  const executorOrderCountById = new Map(executorOrderCounts.map((item) => [item.executorId, item._count._all]));
  const activeExecutorIds = new Set(executorIds);

  return (
    <div className="space-y-6">
      {searchParams?.created ? <Card className="border-emerald-400/20 bg-emerald-500/10 p-4 text-sm text-emerald-100">Партнёрская программа создана.</Card> : null}
      {searchParams?.productCreated ? <Card className="border-emerald-400/20 bg-emerald-500/10 p-4 text-sm text-emerald-100">Товар Coins добавлен.</Card> : null}
      {searchParams?.productUpdated ? <Card className="border-emerald-400/20 bg-emerald-500/10 p-4 text-sm text-emerald-100">Товар Coins обновлен.</Card> : null}
      {searchParams?.productDeleted ? <Card className="border-amber-400/20 bg-amber-500/10 p-4 text-sm text-amber-100">Товар Coins удален.</Card> : null}
      {searchParams?.settingsUpdated ? <Card className="border-emerald-400/20 bg-emerald-500/10 p-4 text-sm text-emerald-100">Настройки магазина сохранены.</Card> : null}
      {searchParams?.serviceProductCreated ? <Card className="border-emerald-400/20 bg-emerald-500/10 p-4 text-sm text-emerald-100">Услуга добавлена.</Card> : null}
      {searchParams?.serviceProductUpdated ? <Card className="border-emerald-400/20 bg-emerald-500/10 p-4 text-sm text-emerald-100">Услуга обновлена.</Card> : null}
      {searchParams?.serviceProductDeleted ? <Card className="border-amber-400/20 bg-amber-500/10 p-4 text-sm text-amber-100">Услуга удалена.</Card> : null}
      {searchParams?.paymentCardCreated ? <Card className="border-emerald-400/20 bg-emerald-500/10 p-4 text-sm text-emerald-100">Карта оплаты добавлена.</Card> : null}
      {searchParams?.paymentCardUpdated ? <Card className="border-emerald-400/20 bg-emerald-500/10 p-4 text-sm text-emerald-100">Карта оплаты обновлена.</Card> : null}
      {searchParams?.paymentCardDeleted ? <Card className="border-amber-400/20 bg-amber-500/10 p-4 text-sm text-amber-100">Карта оплаты удалена.</Card> : null}
      {searchParams?.executorCreated ? <Card className="border-emerald-400/20 bg-emerald-500/10 p-4 text-sm text-emerald-100">Исполнитель добавлен.</Card> : null}
      {searchParams?.executorDeleted ? <Card className="border-amber-400/20 bg-amber-500/10 p-4 text-sm text-amber-100">Исполнитель убран из активных.</Card> : null}
      {searchParams?.orderUpdated ? <Card className="border-emerald-400/20 bg-emerald-500/10 p-4 text-sm text-emerald-100">Заказ обновлён.</Card> : null}
      {searchParams?.deleted ? <Card className="border-amber-400/20 bg-amber-500/10 p-4 text-sm text-amber-100">Партнёрская программа удалена.</Card> : null}
      {searchParams?.error ? <Card className="border-rose-400/25 bg-rose-500/10 p-4 text-sm text-rose-100">{searchParams.error}</Card> : null}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Coins className="h-5 w-5 text-primary" />
            Coins
          </CardTitle>
          <CardDescription>Партнёрская программа работает только через промокоды. Один аккаунт может активировать партнёрский промокод один раз.</CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCheck className="h-5 w-5 text-emerald-300" />
            Исполнители услуг
          </CardTitle>
          <CardDescription>Активные исполнители получают проверенные заказы автоматически и равномерно.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action="/admin/coins" className="grid gap-3 rounded-2xl border border-white/10 bg-black/20 p-4 md:grid-cols-[1fr_auto]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-zinc-500" />
              <input
                name="userQuery"
                defaultValue={userQuery}
                placeholder="Поиск исполнителя по нику, имени или email"
                className="h-11 w-full rounded-xl border border-white/10 bg-white/5 pl-10 pr-4 text-sm text-white outline-none focus:border-primary/40"
              />
            </div>
            <Button variant="outline">Найти</Button>
          </form>

          <form action="/api/admin/coins/executors" method="post" className="grid gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 md:grid-cols-[1fr_auto]">
            <label className="space-y-2">
              <span className="text-sm text-zinc-300">Пользователь</span>
              <select name="userId" required className="h-11 w-full rounded-xl border border-white/10 bg-black/40 px-4 text-sm text-white">
                <option value="">Выберите исполнителя</option>
                {users
                  .filter((user) => !activeExecutorIds.has(user.id))
                  .map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.nickname || user.name || user.email || user.id}
                    </option>
                  ))}
              </select>
            </label>
            <div className="flex items-end">
              <Button>Добавить исполнителя</Button>
            </div>
          </form>

          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {executorProfiles.map((profile) => {
              const userName = profile.user.nickname || profile.user.name || profile.user.email || profile.user.id;

              return (
                <div key={profile.id} className="space-y-3 rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-white">{userName}</div>
                      <div className="mt-1 text-xs text-zinc-500">{profile.user.role}</div>
                    </div>
                    <span className="rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-100">
                      {executorOrderCountById.get(profile.userId) ?? 0} заказов
                    </span>
                  </div>
                  <form action={`/api/admin/coins/executors/${profile.id}`} method="post" className="space-y-2 rounded-xl border border-rose-400/20 bg-rose-500/10 p-3">
                    <input type="hidden" name="_method" value="delete" />
                    <label className="flex items-start gap-2 text-xs leading-4 text-rose-100">
                      <input name="confirmDelete" type="checkbox" className="mt-0.5 h-4 w-4 rounded border-white/20 bg-black/40" />
                      <span>Подтверждаю удаление исполнителя</span>
                    </label>
                    <Button variant="outline" className="w-full border-rose-400/25 bg-rose-500/10 text-rose-100 hover:bg-rose-500/20">
                      <Trash2 className="mr-2 h-4 w-4" />
                      Убрать
                    </Button>
                  </form>
                </div>
              );
            })}
            {!executorProfiles.length ? <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-4 text-sm text-zinc-500">Исполнителей пока нет.</div> : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-primary" />
            Настройки магазина
          </CardTitle>
          <CardDescription>Включайте каталоги и задавайте общий комментарий к переводу.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action="/api/admin/coins/settings" method="post" className="grid gap-4">
            <div className="grid gap-3 md:grid-cols-2">
              <label className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <input name="coinsStoreEnabled" type="checkbox" defaultChecked={settings.coinsStoreEnabled} className="mt-1 h-4 w-4 rounded border-white/20 bg-black/40" />
                <span>
                  <span className="block text-sm font-semibold text-white">Включить магазин монет</span>
                  <span className="mt-1 block text-xs leading-5 text-zinc-500">Если выключить, каталог Coins будет скрыт для игроков.</span>
                </span>
              </label>
              <label className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <input name="servicesStoreEnabled" type="checkbox" defaultChecked={settings.servicesStoreEnabled} className="mt-1 h-4 w-4 rounded border-white/20 bg-black/40" />
                <span>
                  <span className="block text-sm font-semibold text-white">Включить магазин услуг</span>
                  <span className="mt-1 block text-xs leading-5 text-zinc-500">Если выключить, услуги повышения дивизиона будут скрыты.</span>
                </span>
              </label>
            </div>

            <div className="grid gap-3 md:grid-cols-[1fr_auto]">
              <label className="space-y-2">
                <span className="text-sm text-zinc-300">Комментарий к переводу</span>
                <input name="paymentComment" defaultValue={settings.paymentComment} placeholder="Например: NEXON" className="h-11 w-full rounded-xl border border-white/10 bg-black/40 px-4 text-sm text-white" />
              </label>
              <div className="flex items-end">
                <Button>Сохранить настройки</Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCheck className="h-5 w-5 text-emerald-300" />
            Заказы услуг
          </CardTitle>
          <CardDescription>Подтвердите оплату или отмените заказ с причиной. После подтверждения исполнитель назначится автоматически.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3">
            {serviceOrders.map((order) => (
              <div key={order.id} className="grid gap-4 rounded-2xl border border-white/10 bg-black/20 p-4 xl:grid-cols-[minmax(0,1fr)_360px]">
                <div className="min-w-0 space-y-3">
                  {(() => {
                    const lastRejectedAttempt = order.executorAttempts.find((attempt) => attempt.status === "REJECTED" && attempt.reason);

                    return lastRejectedAttempt ? (
                      <div className="rounded-xl border border-rose-400/20 bg-rose-500/10 p-3 text-sm text-rose-100">
                        Отказ: {displayUser(lastRejectedAttempt.executor)} — {lastRejectedAttempt.reason}
                      </div>
                    ) : null;
                  })()}
                  <div className="flex flex-wrap items-center gap-2">
                    <a href={`/coins/orders/${order.id}`} className="truncate text-base font-bold text-white underline-offset-4 hover:text-primary hover:underline">
                      {order.productTitle}
                    </a>
                    <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${serviceOrderStatusTone(order.status)}`}>
                      {serviceOrderStatusLabel(order.status)}
                    </span>
                  </div>
                  <div className="grid gap-2 text-sm text-zinc-400 sm:grid-cols-2 xl:grid-cols-4">
                    <div>
                      <span className="text-zinc-600">Покупатель: </span>
                      <span className="font-medium text-zinc-200">{displayUser(order.buyer)}</span>
                    </div>
                    <div>
                      <span className="text-zinc-600">Исполнитель: </span>
                      <span className="font-medium text-zinc-200">{order.executor ? displayUser(order.executor) : "не назначен"}</span>
                    </div>
                    <div>
                      <span className="text-zinc-600">Сумма: </span>
                      <span className="font-medium text-emerald-100">{formatMoney(order.priceKopecks)}</span>
                    </div>
                    <div>
                      <span className="text-zinc-600">Чек: </span>
                      {order.paymentReceiptUrl ? (
                        <a href={order.paymentReceiptUrl} target="_blank" rel="noreferrer" className="font-medium text-sky-200 underline-offset-4 hover:underline">
                          открыть
                        </a>
                      ) : (
                        <span className="font-medium text-amber-100">нет</span>
                      )}
                    </div>
                  </div>
                  {order.adminComment ? <div className="rounded-xl border border-primary/15 bg-primary/10 p-3 text-sm text-blue-100">{order.adminComment}</div> : null}
                </div>

                {order.status === CoinServiceOrderStatus.PENDING_REVIEW || order.status === CoinServiceOrderStatus.AWAITING_EXECUTOR ? (
                  <div className="grid gap-3">
                    <form action={`/api/admin/coins/service-orders/${order.id}`} method="post" className="space-y-2">
                      <input type="hidden" name="_action" value="accept" />
                      <Textarea name="adminComment" placeholder="Комментарий администратора" className="min-h-[76px] resize-none bg-black/30" />
                      <Button className="w-full rounded-xl bg-emerald-400 text-black hover:bg-emerald-300">
                        {order.status === CoinServiceOrderStatus.AWAITING_EXECUTOR ? "Назначить исполнителя" : "Заказ оплачен"}
                      </Button>
                    </form>

                    <form action={`/api/admin/coins/service-orders/${order.id}`} method="post" className="space-y-2 rounded-xl border border-rose-400/20 bg-rose-500/10 p-3">
                      <input type="hidden" name="_action" value="reject" />
                      <Textarea name="adminComment" required placeholder="Причина отмены" className="min-h-[76px] resize-none bg-black/30" />
                      <Button variant="outline" className="w-full rounded-xl border-rose-400/25 bg-rose-500/10 text-rose-100 hover:bg-rose-500/20">
                        Отменить заказ
                      </Button>
                    </form>
                  </div>
                ) : null}
              </div>
            ))}
            {!serviceOrders.length ? <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-4 text-sm text-zinc-500">Заказов услуг пока нет.</div> : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-emerald-300" />
            Карты для оплаты
          </CardTitle>
          <CardDescription>Добавьте до 10 карт. При оформлении услуги игроку случайно показывается одна активная карта.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action="/api/admin/coins/payment-cards" method="post" className="grid gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 md:grid-cols-2 xl:grid-cols-5">
            <label className="space-y-2">
              <span className="text-sm text-zinc-300">Банк</span>
              <select name="bank" required className="h-11 w-full rounded-xl border border-white/10 bg-black/40 px-4 text-sm text-white">
                {coinPaymentBankOptions.map((bank) => (
                  <option key={bank.value} value={bank.value}>{bank.label}</option>
                ))}
              </select>
            </label>
            <label className="space-y-2">
              <span className="text-sm text-zinc-300">Номер карты</span>
              <input name="cardNumber" required placeholder="0000 0000 0000 0000" className="h-11 w-full rounded-xl border border-white/10 bg-black/40 px-4 text-sm text-white" />
            </label>
            <label className="space-y-2">
              <span className="text-sm text-zinc-300">ФИО получателя</span>
              <input name="recipient" required placeholder="Иванов Иван Иванович" className="h-11 w-full rounded-xl border border-white/10 bg-black/40 px-4 text-sm text-white" />
            </label>
            <label className="space-y-2">
              <span className="text-sm text-zinc-300">Сортировка</span>
              <input name="sortOrder" type="number" min="0" defaultValue="0" className="h-11 w-full rounded-xl border border-white/10 bg-black/40 px-4 text-sm text-white" />
            </label>
            <div className="flex items-end">
              <Button disabled={paymentCards.length >= 10}>Добавить карту</Button>
            </div>
          </form>

          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {paymentCards.map((card) => (
              <div key={card.id} className="space-y-3 rounded-2xl border border-white/10 bg-black/20 p-4">
                <form action={`/api/admin/coins/payment-cards/${card.id}`} method="post" className="grid gap-3">
                  <input type="hidden" name="_method" value="update" />
                  <div className="flex items-center justify-between gap-3">
                    <BankLogo bank={card.bank} />
                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-zinc-400">#{card.sortOrder}</span>
                  </div>
                  <label className="space-y-2">
                    <span className="text-sm text-zinc-300">Банк</span>
                    <select name="bank" defaultValue={card.bank} required className="h-11 w-full rounded-xl border border-white/10 bg-black/40 px-4 text-sm text-white">
                      {coinPaymentBankOptions.map((bank) => (
                        <option key={bank.value} value={bank.value}>{bank.label}</option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm text-zinc-300">Номер карты</span>
                    <input name="cardNumber" required defaultValue={card.cardNumber} className="h-11 w-full rounded-xl border border-white/10 bg-black/40 px-4 text-sm text-white" />
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm text-zinc-300">ФИО получателя</span>
                    <input name="recipient" required defaultValue={card.recipient} className="h-11 w-full rounded-xl border border-white/10 bg-black/40 px-4 text-sm text-white" />
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm text-zinc-300">Сортировка</span>
                    <input name="sortOrder" type="number" min="0" required defaultValue={card.sortOrder} className="h-11 w-full rounded-xl border border-white/10 bg-black/40 px-4 text-sm text-white" />
                  </label>
                  <Button variant="outline" className="w-full">Сохранить</Button>
                </form>

                <form action={`/api/admin/coins/payment-cards/${card.id}`} method="post" className="space-y-2 rounded-xl border border-rose-400/20 bg-rose-500/10 p-3">
                  <input type="hidden" name="_method" value="delete" />
                  <label className="flex items-start gap-2 text-xs leading-4 text-rose-100">
                    <input name="confirmDelete" type="checkbox" className="mt-0.5 h-4 w-4 rounded border-white/20 bg-black/40" />
                    <span>Подтверждаю удаление карты</span>
                  </label>
                  <Button variant="outline" className="w-full border-rose-400/25 bg-rose-500/10 text-rose-100 hover:bg-rose-500/20">
                    <Trash2 className="mr-2 h-4 w-4" />
                    Удалить
                  </Button>
                </form>
              </div>
            ))}
            {!paymentCards.length ? <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-4 text-sm text-zinc-500">Карт пока нет.</div> : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Товары Coins</CardTitle>
          <CardDescription>Добавьте товар в магазин и укажите себестоимость для расчёта профита.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action="/api/admin/coins/products" method="post" className="grid gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 md:grid-cols-2 xl:grid-cols-5">
            <label className="space-y-2">
              <span className="text-sm text-zinc-300">Платформа</span>
              <select name="platform" required className="h-11 w-full rounded-xl border border-white/10 bg-black/40 px-4 text-sm text-white">
                <option value="android">Android</option>
                <option value="ios">iOS</option>
                <option value="promo">Акции</option>
              </select>
            </label>
            <label className="space-y-2">
              <span className="text-sm text-zinc-300">Количество Coins</span>
              <input name="coins" type="number" min="1" required placeholder="300" className="h-11 w-full rounded-xl border border-white/10 bg-black/40 px-4 text-sm text-white" />
            </label>
            <label className="space-y-2">
              <span className="text-sm text-zinc-300">Цена в магазине, ₽</span>
              <input name="priceRubles" inputMode="decimal" required placeholder="104.99" className="h-11 w-full rounded-xl border border-white/10 bg-black/40 px-4 text-sm text-white" />
            </label>
            <label className="space-y-2">
              <span className="text-sm text-zinc-300">Себестоимость, ₽</span>
              <input name="costRubles" inputMode="decimal" required placeholder="70" className="h-11 w-full rounded-xl border border-white/10 bg-black/40 px-4 text-sm text-white" />
            </label>
            <div className="flex items-end">
              <Button>Добавить товар</Button>
            </div>
          </form>

          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {products.map((product) => (
              <div key={product.id} className="space-y-3 rounded-2xl border border-white/10 bg-black/20 p-4">
                <form action={`/api/admin/coins/products/${product.id}`} method="post" className="grid gap-3">
                  <input type="hidden" name="_method" value="update" />
                  <label className="space-y-2">
                    <span className="text-sm text-zinc-300">Платформа</span>
                    <select name="platform" defaultValue={product.platform} required className="h-11 w-full rounded-xl border border-white/10 bg-black/40 px-4 text-sm text-white">
                      <option value="android">Android</option>
                      <option value="ios">iOS</option>
                      <option value="promo">Акции</option>
                    </select>
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm text-zinc-300">Количество Coins</span>
                    <input name="coins" type="number" min="1" required defaultValue={product.coins} className="h-11 w-full rounded-xl border border-white/10 bg-black/40 px-4 text-sm text-white" />
                  </label>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="space-y-2">
                      <span className="text-sm text-zinc-300">Цена, ₽</span>
                      <input name="priceRubles" inputMode="decimal" required defaultValue={product.priceKopecks / 100} className="h-11 w-full rounded-xl border border-white/10 bg-black/40 px-4 text-sm text-white" />
                    </label>
                    <label className="space-y-2">
                      <span className="text-sm text-zinc-300">Себестоимость, ₽</span>
                      <input name="costRubles" inputMode="decimal" required defaultValue={product.costKopecks / 100} className="h-11 w-full rounded-xl border border-white/10 bg-black/40 px-4 text-sm text-white" />
                    </label>
                  </div>
                  <Button variant="outline" className="w-full">Сохранить</Button>
                </form>

                <form action={`/api/admin/coins/products/${product.id}`} method="post" className="space-y-2 rounded-xl border border-rose-400/20 bg-rose-500/10 p-3">
                  <input type="hidden" name="_method" value="delete" />
                  <label className="flex items-start gap-2 text-xs leading-4 text-rose-100">
                    <input name="confirmDelete" type="checkbox" className="mt-0.5 h-4 w-4 rounded border-white/20 bg-black/40" />
                    <span>Подтверждаю удаление товара</span>
                  </label>
                  <Button variant="outline" className="w-full border-rose-400/25 bg-rose-500/10 text-rose-100 hover:bg-rose-500/20">
                    <Trash2 className="mr-2 h-4 w-4" />
                    Удалить
                  </Button>
                </form>
              </div>
            ))}
            {!products.length ? <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-4 text-sm text-zinc-500">Товаров пока нет.</div> : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PackagePlus className="h-5 w-5 text-emerald-300" />
            Товары услуг
          </CardTitle>
          <CardDescription>Добавляйте услуги повышения дивизиона, стоимость и проценты исполнителя/владельца.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action="/api/admin/coins/service-products" method="post" className="grid gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 lg:grid-cols-2 xl:grid-cols-6">
            <label className="space-y-2 xl:col-span-2">
              <span className="text-sm text-zinc-300">Название услуги</span>
              <input
                name="title"
                required
                defaultValue="Повышение в дивизион 1,2,3 eFootball"
                className="h-11 w-full rounded-xl border border-white/10 bg-black/40 px-4 text-sm text-white"
              />
            </label>
            <label className="space-y-2 xl:col-span-2">
              <span className="text-sm text-zinc-300">Описание товара</span>
              <input
                name="description"
                required
                placeholder="Описание услуги, сроки и условия выполнения"
                className="h-11 w-full rounded-xl border border-white/10 bg-black/40 px-4 text-sm text-white"
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm text-zinc-300">Цена, ₽</span>
              <input name="priceRubles" inputMode="decimal" required placeholder="999" className="h-11 w-full rounded-xl border border-white/10 bg-black/40 px-4 text-sm text-white" />
            </label>
            <label className="space-y-2">
              <span className="text-sm text-zinc-300">Сортировка</span>
              <input name="sortOrder" type="number" min="0" defaultValue="0" className="h-11 w-full rounded-xl border border-white/10 bg-black/40 px-4 text-sm text-white" />
            </label>
            <label className="space-y-2">
              <span className="text-sm text-zinc-300">Исполнителю, %</span>
              <input name="executorPercent" type="number" min="0" max="100" defaultValue="70" className="h-11 w-full rounded-xl border border-white/10 bg-black/40 px-4 text-sm text-white" />
            </label>
            <label className="space-y-2">
              <span className="text-sm text-zinc-300">Владельцу, %</span>
              <input name="ownerPercent" type="number" min="0" max="100" defaultValue="30" className="h-11 w-full rounded-xl border border-white/10 bg-black/40 px-4 text-sm text-white" />
            </label>
            <div className="flex items-end xl:col-span-2">
              <Button>Добавить услугу</Button>
            </div>
          </form>

          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {serviceProducts.map((product) => (
              <div key={product.id} className="space-y-3 rounded-2xl border border-white/10 bg-black/20 p-4">
                <form action={`/api/admin/coins/service-products/${product.id}`} method="post" className="grid gap-3">
                  <input type="hidden" name="_method" value="update" />
                  <label className="space-y-2">
                    <span className="text-sm text-zinc-300">Название</span>
                    <input name="title" required defaultValue={product.title} className="h-11 w-full rounded-xl border border-white/10 bg-black/40 px-4 text-sm text-white" />
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm text-zinc-300">Описание</span>
                    <Textarea name="description" required defaultValue={product.description} className="min-h-[110px] bg-black/40" />
                  </label>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="space-y-2">
                      <span className="text-sm text-zinc-300">Цена, ₽</span>
                      <input name="priceRubles" inputMode="decimal" required defaultValue={product.priceKopecks / 100} className="h-11 w-full rounded-xl border border-white/10 bg-black/40 px-4 text-sm text-white" />
                    </label>
                    <label className="space-y-2">
                      <span className="text-sm text-zinc-300">Сортировка</span>
                      <input name="sortOrder" type="number" min="0" required defaultValue={product.sortOrder} className="h-11 w-full rounded-xl border border-white/10 bg-black/40 px-4 text-sm text-white" />
                    </label>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="space-y-2">
                      <span className="text-sm text-zinc-300">Исполнителю, %</span>
                      <input name="executorPercent" type="number" min="0" max="100" required defaultValue={product.executorPercent} className="h-11 w-full rounded-xl border border-white/10 bg-black/40 px-4 text-sm text-white" />
                    </label>
                    <label className="space-y-2">
                      <span className="text-sm text-zinc-300">Владельцу, %</span>
                      <input name="ownerPercent" type="number" min="0" max="100" required defaultValue={product.ownerPercent} className="h-11 w-full rounded-xl border border-white/10 bg-black/40 px-4 text-sm text-white" />
                    </label>
                  </div>
                  <Button variant="outline" className="w-full">Сохранить</Button>
                </form>

                <form action={`/api/admin/coins/service-products/${product.id}`} method="post" className="space-y-2 rounded-xl border border-rose-400/20 bg-rose-500/10 p-3">
                  <input type="hidden" name="_method" value="delete" />
                  <label className="flex items-start gap-2 text-xs leading-4 text-rose-100">
                    <input name="confirmDelete" type="checkbox" className="mt-0.5 h-4 w-4 rounded border-white/20 bg-black/40" />
                    <span>Подтверждаю удаление услуги</span>
                  </label>
                  <Button variant="outline" className="w-full border-rose-400/25 bg-rose-500/10 text-rose-100 hover:bg-rose-500/20">
                    <Trash2 className="mr-2 h-4 w-4" />
                    Удалить
                  </Button>
                </form>
              </div>
            ))}
            {!serviceProducts.length ? <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-4 text-sm text-zinc-500">Услуг пока нет.</div> : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Handshake className="h-5 w-5 text-primary" />
            Создать партнёра
          </CardTitle>
          <CardDescription>Выберите пользователя сайта и настройте его партнёрский промокод.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action="/admin/coins" className="grid gap-3 rounded-2xl border border-white/10 bg-black/20 p-4 md:grid-cols-[1fr_auto]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-zinc-500" />
              <input
                name="userQuery"
                defaultValue={userQuery}
                placeholder="Поиск по нику, имени или email"
                className="h-11 w-full rounded-xl border border-white/10 bg-white/5 pl-10 pr-4 text-sm text-white outline-none focus:border-primary/40"
              />
            </div>
            <Button variant="outline">Найти</Button>
          </form>

          <form action="/api/admin/coins/partners" method="post" className="grid gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 md:grid-cols-2 xl:grid-cols-3">
            <label className="space-y-2">
              <span className="text-sm text-zinc-300">Админка партнёра</span>
              <select name="ownerId" required className="h-11 w-full rounded-xl border border-white/10 bg-black/40 px-4 text-sm text-white">
                <option value="">Выберите пользователя</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.nickname || user.name || user.email || user.id}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2">
              <span className="text-sm text-zinc-300">Промокод</span>
              <input name="promoCode" required placeholder="NEXON20" className="h-11 w-full rounded-xl border border-white/10 bg-black/40 px-4 text-sm uppercase text-white" />
            </label>
            <label className="space-y-2">
              <span className="text-sm text-zinc-300">Скидка, %</span>
              <input name="discountPercent" type="number" min="0" max="100" defaultValue="10" className="h-11 w-full rounded-xl border border-white/10 bg-black/40 px-4 text-sm text-white" />
            </label>
            <label className="space-y-2">
              <span className="text-sm text-zinc-300">Лимит активаций</span>
              <input name="activationLimit" type="number" min="0" defaultValue="100" className="h-11 w-full rounded-xl border border-white/10 bg-black/40 px-4 text-sm text-white" />
            </label>
            <label className="space-y-2">
              <span className="text-sm text-zinc-300">Процент партнёра от профита</span>
              <input name="partnerPercent" type="number" min="0" max="100" defaultValue="20" className="h-11 w-full rounded-xl border border-white/10 bg-black/40 px-4 text-sm text-white" />
            </label>
            <div className="flex items-end">
              <Button>Создать партнёра</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-4">
        {partners.map((partner) => {
          const turnover = partner.purchases.reduce((sum, purchase) => sum + purchase.paidAmountKopecks, 0);
          const cost = partner.purchases.reduce((sum, purchase) => sum + purchase.costKopecks, 0);
          const profit = partner.purchases.reduce((sum, purchase) => sum + purchase.profitKopecks, 0);
          const earning = partner.purchases.reduce((sum, purchase) => sum + purchase.partnerEarningKopecks, 0);

          return (
            <Card key={partner.id} className="overflow-hidden">
              <div className="flex flex-col gap-4 border-b border-white/10 pb-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <CardTitle>{partner.owner.nickname || partner.owner.name || partner.owner.email || "Партнёр"}</CardTitle>
                    <span className="rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-semibold text-blue-100">{partner.partnerPercent}% от профита</span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-zinc-400">
                    <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1">Промокод: {partner.promoCode}</span>
                    <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1">Скидка: {partner.discountPercent}%</span>
                    <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1">
                      Активации: {partner._count.referrals}/{partner.activationLimit || "∞"}
                    </span>
                  </div>
                </div>
                <form action={`/api/admin/coins/partners/${partner.id}`} method="post" className="min-w-[220px] space-y-2 rounded-2xl border border-rose-400/20 bg-rose-500/10 p-3">
                  <input type="hidden" name="_method" value="delete" />
                  <label className="flex items-start gap-2 text-xs leading-4 text-rose-100">
                    <input name="confirmDelete" type="checkbox" className="mt-0.5 h-4 w-4 rounded border-white/20 bg-black/40" />
                    <span>Подтверждаю удаление партнёрки</span>
                  </label>
                  <Button variant="outline" className="w-full border-rose-400/25 bg-rose-500/10 text-rose-100 hover:bg-rose-500/20">
                    <Trash2 className="mr-2 h-4 w-4" />
                    Удалить
                  </Button>
                </form>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {[
                  ["Рефералы", partner._count.referrals],
                  ["Покупки", partner._count.purchases],
                  ["Оборот", formatMoney(turnover)],
                  ["Себестоимость", formatMoney(cost)],
                  ["Профит магазина", formatMoney(profit)],
                  ["Заработок партнёра", formatMoney(earning)],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">{label}</div>
                    <div className="mt-2 text-xl font-bold text-white">{value}</div>
                  </div>
                ))}
              </div>

              <div className="mt-4 grid gap-4 xl:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
                    <Users className="h-4 w-4 text-primary" />
                    Привязанные рефералы
                  </div>
                  <div className="space-y-2">
                    {partner.referrals.slice(0, 6).map((referral) => (
                      <div key={referral.id} className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-zinc-300">
                        {referral.displayName || referral.contact || referral.referralKey}
                      </div>
                    ))}
                    {!partner.referrals.length ? <div className="text-sm text-zinc-500">Рефералов пока нет.</div> : null}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
                    <Percent className="h-4 w-4 text-primary" />
                    Покупки рефералов
                  </div>
                  <div className="space-y-2">
                    {partner.purchases.slice(0, 8).map((purchase) => (
                      <div key={purchase.id} className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm">
                        <div className="font-medium text-white">{purchase.buyerName} • {purchase.offerTitle}</div>
                        <div className="mt-1 text-xs text-zinc-500">
                          оборот {formatMoney(purchase.paidAmountKopecks)} • профит {formatMoney(purchase.profitKopecks)} • партнёру {formatMoney(purchase.partnerEarningKopecks)}
                        </div>
                      </div>
                    ))}
                    {!partner.purchases.length ? <div className="text-sm text-zinc-500">Покупок пока нет.</div> : null}
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
