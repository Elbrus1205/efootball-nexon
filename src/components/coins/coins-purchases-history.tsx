import Link from "next/link";
import { BadgePercent, CalendarDays, CheckCircle2, CircleDollarSign, Coins, ReceiptText, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatKopecks } from "@/lib/coin-services";

export type CoinsPurchaseHistoryItem = {
  id: string;
  offerTitle: string;
  platform: string;
  salePriceKopecks: number;
  discountKopecks: number;
  paidAmountKopecks: number;
  createdAt: Date;
  promoCode?: string | null;
};

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

function platformLabel(platform: string) {
  if (platform === "android") return "Android";
  if (platform === "ios") return "iOS";
  if (platform === "promo") return "Акция";
  return platform;
}

export function CoinsPurchasesHistory({ purchases, isSignedIn }: { purchases: CoinsPurchaseHistoryItem[]; isSignedIn: boolean }) {
  const totalPaid = purchases.reduce((sum, purchase) => sum + purchase.paidAmountKopecks, 0);

  return (
    <section className="space-y-4 rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(14,14,20,0.96),rgba(7,9,14,0.98))] p-3.5 shadow-[0_20px_70px_rgba(0,0,0,0.24)] sm:p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-300/15 bg-amber-300/10 px-3 py-1.5 text-[11px] font-semibold text-amber-100">
            <ShoppingBag className="h-4 w-4" />
            Меню покупок
          </div>
          <h2 className="mt-3 text-2xl font-black leading-tight text-white sm:text-3xl">История покупок</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
            Здесь видно, что куплено, когда оформлен заказ, сколько оплачено и какой статус у покупки.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:flex">
          <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">
            <div className="text-[10px] font-semibold text-zinc-500">Покупок</div>
            <div className="mt-1 text-lg font-black text-white">{purchases.length}</div>
          </div>
          <div className="rounded-xl border border-amber-300/15 bg-amber-300/10 px-3 py-2">
            <div className="text-[10px] font-semibold text-amber-100/60">Оплачено</div>
            <div className="mt-1 text-lg font-black text-amber-100">{formatKopecks(totalPaid)}</div>
          </div>
        </div>
      </div>

      {purchases.length ? (
        <div className="grid gap-2.5">
          {purchases.map((purchase) => (
            <article key={purchase.id} className="rounded-2xl border border-white/10 bg-white/[0.035] p-3.5 sm:p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-yellow-300/20 bg-yellow-300/10 px-2.5 py-1 text-xs font-bold text-yellow-100">
                      <Coins className="h-3.5 w-3.5" />
                      {platformLabel(purchase.platform)}
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/20 bg-emerald-400/10 px-2.5 py-1 text-xs font-bold text-emerald-100">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Оформлено
                    </span>
                  </div>

                  <h3 className="mt-3 line-clamp-2 text-base font-black leading-tight text-white sm:text-lg">{purchase.offerTitle}</h3>

                  <div className="mt-3 grid gap-2 text-xs text-zinc-400 sm:grid-cols-2">
                    <div className="inline-flex items-center gap-2">
                      <ReceiptText className="h-4 w-4 text-zinc-500" />
                      <span>Что куплено: {purchase.offerTitle}</span>
                    </div>
                    <div className="inline-flex items-center gap-2">
                      <CalendarDays className="h-4 w-4 text-zinc-500" />
                      <span>{formatDate(purchase.createdAt)}</span>
                    </div>
                  </div>
                </div>

                <div className="grid gap-2 sm:grid-cols-3 lg:min-w-[320px]">
                  <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">
                    <div className="text-[10px] font-semibold text-zinc-500">Стоимость</div>
                    <div className="mt-1 font-black text-white">{formatKopecks(purchase.salePriceKopecks)}</div>
                  </div>
                  <div className="rounded-xl border border-emerald-300/15 bg-emerald-400/10 px-3 py-2">
                    <div className="text-[10px] font-semibold text-emerald-100/60">Оплачено</div>
                    <div className="mt-1 font-black text-emerald-100">{formatKopecks(purchase.paidAmountKopecks)}</div>
                  </div>
                  <div className="rounded-xl border border-amber-300/15 bg-amber-300/10 px-3 py-2">
                    <div className="text-[10px] font-semibold text-amber-100/60">Скидка</div>
                    <div className="mt-1 font-black text-amber-100">{purchase.discountKopecks ? formatKopecks(purchase.discountKopecks) : "нет"}</div>
                  </div>
                </div>
              </div>

              {purchase.promoCode ? (
                <div className="mt-3 inline-flex items-center gap-2 rounded-xl border border-amber-300/15 bg-amber-300/10 px-3 py-2 text-xs font-semibold text-amber-100">
                  <BadgePercent className="h-4 w-4" />
                  Промокод: {purchase.promoCode}
                </div>
              ) : null}
            </article>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-5 text-sm leading-6 text-zinc-500">
          {isSignedIn ? (
            "Покупок пока нет. Когда вы оформите Coins, здесь появятся товар, дата, сумма оплаты и статус."
          ) : (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span>Войдите в аккаунт, чтобы видеть историю покупок.</span>
              <Button asChild variant="outline" className="rounded-xl">
                <Link href="/login">
                  <CircleDollarSign className="mr-2 h-4 w-4" />
                  Войти
                </Link>
              </Button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
