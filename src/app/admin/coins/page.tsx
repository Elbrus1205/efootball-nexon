import { Coins, Handshake, Percent, Search, Trash2, Users } from "lucide-react";
import { UserRole } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/auth/session";
import { db } from "@/lib/db";

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
  searchParams?: { userQuery?: string; created?: string; deleted?: string; error?: string };
}) {
  await requireRole([UserRole.ADMIN]);

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

  const partners = await db.affiliatePartner.findMany({
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
  });

  return (
    <div className="space-y-6">
      {searchParams?.created ? <Card className="border-emerald-400/20 bg-emerald-500/10 p-4 text-sm text-emerald-100">Партнёрская программа создана.</Card> : null}
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
