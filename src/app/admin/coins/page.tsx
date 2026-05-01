import Link from "next/link";
import { ClipboardCheck, Coins, Handshake, MessageSquareText, PackagePlus, Percent, Search, Settings, Trash2, UserCheck, Users } from "lucide-react";
import { CoinServiceOrderStatus, UserRole } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { requireRole } from "@/lib/auth/session";
import { formatKopecks, getCoinStoreSettings, serviceOrderStatusLabel, serviceOrderStatusTone } from "@/lib/coin-services";
import { db } from "@/lib/db";
import { cn } from "@/lib/utils";

function formatMoney(value: number) {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value / 100);
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
  const [partners, products, serviceProducts, serviceOrders, executors] = await Promise.all([
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
    db.coinServiceOrder.findMany({
      include: {
        buyer: { select: { nickname: true, name: true, email: true } },
        executor: { select: { id: true, nickname: true, name: true, email: true } },
        _count: { select: { messages: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
    db.user.findMany({
      where: { isBanned: false },
      orderBy: [{ nickname: "asc" }, { name: "asc" }, { createdAt: "desc" }],
      select: { id: true, nickname: true, name: true, email: true, role: true },
      take: 100,
    }),
  ]);

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
            <Settings className="h-5 w-5 text-primary" />
            Настройки магазина
          </CardTitle>
          <CardDescription>Включайте каталоги, задавайте реквизиты оплаты и проценты по услугам.</CardDescription>
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

            <div className="grid gap-3 md:grid-cols-3">
              <label className="space-y-2">
                <span className="text-sm text-zinc-300">Карта для оплаты</span>
                <input name="paymentCard" defaultValue={settings.paymentCard} placeholder="0000 0000 0000 0000" className="h-11 w-full rounded-xl border border-white/10 bg-black/40 px-4 text-sm text-white" />
              </label>
              <label className="space-y-2">
                <span className="text-sm text-zinc-300">ФИО получателя</span>
                <input name="paymentRecipient" defaultValue={settings.paymentRecipient} placeholder="Иванов Иван Иванович" className="h-11 w-full rounded-xl border border-white/10 bg-black/40 px-4 text-sm text-white" />
              </label>
              <label className="space-y-2">
                <span className="text-sm text-zinc-300">Комментарий к переводу</span>
                <input name="paymentComment" defaultValue={settings.paymentComment} placeholder="Например: NEXON" className="h-11 w-full rounded-xl border border-white/10 bg-black/40 px-4 text-sm text-white" />
              </label>
            </div>

            <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
              <label className="space-y-2">
                <span className="text-sm text-zinc-300">Процент исполнителя по умолчанию</span>
                <input name="defaultExecutorPercent" type="number" min="0" max="100" defaultValue={settings.defaultExecutorPercent} className="h-11 w-full rounded-xl border border-white/10 bg-black/40 px-4 text-sm text-white" />
              </label>
              <label className="space-y-2">
                <span className="text-sm text-zinc-300">Процент владельца сайта по умолчанию</span>
                <input name="defaultOwnerPercent" type="number" min="0" max="100" defaultValue={settings.defaultOwnerPercent} className="h-11 w-full rounded-xl border border-white/10 bg-black/40 px-4 text-sm text-white" />
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
              <input name="executorPercent" type="number" min="0" max="100" defaultValue={settings.defaultExecutorPercent} className="h-11 w-full rounded-xl border border-white/10 bg-black/40 px-4 text-sm text-white" />
            </label>
            <label className="space-y-2">
              <span className="text-sm text-zinc-300">Владельцу, %</span>
              <input name="ownerPercent" type="number" min="0" max="100" defaultValue={settings.defaultOwnerPercent} className="h-11 w-full rounded-xl border border-white/10 bg-black/40 px-4 text-sm text-white" />
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
            <ClipboardCheck className="h-5 w-5 text-primary" />
            Заказы услуг
          </CardTitle>
          <CardDescription>Принимайте заказ после оплаты, назначайте исполнителя и открывайте чат заказа.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3">
            {serviceOrders.map((order) => {
              const buyerName = order.buyer.nickname || order.buyer.name || order.buyer.email || "Покупатель";
              const executorName = order.executor?.nickname || order.executor?.name || order.executor?.email || "";

              return (
                <div key={order.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="font-semibold text-white">{order.productTitle}</div>
                        <span className={cn("rounded-full border px-3 py-1 text-xs font-semibold", serviceOrderStatusTone(order.status))}>
                          {serviceOrderStatusLabel(order.status)}
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs text-zinc-500">
                        <span>Покупатель: {buyerName}</span>
                        <span>Сумма: {formatKopecks(order.priceKopecks)}</span>
                        <span>Исполнителю: {formatKopecks(order.executorEarningKopecks)} ({order.executorPercent}%)</span>
                        <span>Владельцу: {formatKopecks(order.ownerEarningKopecks)} ({order.ownerPercent}%)</span>
                        <span>Сообщений: {order._count.messages}</span>
                      </div>
                      {executorName ? <div className="mt-2 text-sm text-emerald-100">Исполнитель: {executorName}</div> : null}
                    </div>
                    <Button asChild variant="outline" className="shrink-0">
                      <Link href={`/coins/orders/${order.id}`}>
                        <MessageSquareText className="mr-2 h-4 w-4" />
                        Открыть чат
                      </Link>
                    </Button>
                  </div>

                  {order.status === CoinServiceOrderStatus.PENDING_REVIEW || order.status === CoinServiceOrderStatus.ACCEPTED ? (
                    <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_auto]">
                      <form action={`/api/admin/coins/service-orders/${order.id}`} method="post" className="grid gap-3 rounded-2xl border border-emerald-400/15 bg-emerald-500/10 p-3 md:grid-cols-[1fr_1fr_auto]">
                        <input type="hidden" name="_action" value="accept" />
                        <label className="space-y-2">
                          <span className="text-sm text-zinc-300">Исполнитель</span>
                          <select name="executorId" required defaultValue={order.executor?.id ?? ""} className="h-11 w-full rounded-xl border border-white/10 bg-black/40 px-4 text-sm text-white">
                            <option value="">Выберите исполнителя</option>
                            {executors.map((user) => (
                              <option key={user.id} value={user.id}>
                                {user.nickname || user.name || user.email || user.id} • {user.role}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="space-y-2">
                          <span className="text-sm text-zinc-300">Комментарий админа</span>
                          <input name="adminComment" defaultValue={order.adminComment ?? ""} placeholder="Опционально" className="h-11 w-full rounded-xl border border-white/10 bg-black/40 px-4 text-sm text-white" />
                        </label>
                        <div className="flex items-end">
                          <Button className="w-full bg-emerald-400 text-black hover:bg-emerald-300">
                            <UserCheck className="mr-2 h-4 w-4" />
                            {order.status === CoinServiceOrderStatus.PENDING_REVIEW ? "Принять" : "Назначить"}
                          </Button>
                        </div>
                      </form>

                      {order.status === CoinServiceOrderStatus.PENDING_REVIEW ? (
                        <form action={`/api/admin/coins/service-orders/${order.id}`} method="post" className="grid gap-3 rounded-2xl border border-rose-400/20 bg-rose-500/10 p-3">
                          <input type="hidden" name="_action" value="reject" />
                          <input name="adminComment" placeholder="Причина отклонения" className="h-11 w-full rounded-xl border border-white/10 bg-black/40 px-4 text-sm text-white" />
                          <Button variant="outline" className="border-rose-400/25 bg-rose-500/10 text-rose-100 hover:bg-rose-500/20">Отклонить</Button>
                        </form>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              );
            })}
            {!serviceOrders.length ? <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-4 text-sm text-zinc-500">Заказов услуг пока нет.</div> : null}
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
