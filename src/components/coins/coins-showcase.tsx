"use client";

import { ArrowRight, Coins, CreditCard, Gift, Smartphone, Sparkles, WalletCards } from "lucide-react";
import {
  androidCoinPacks,
  formatRubles,
  iosCoinPacks,
  promoBundles,
  promoCoinPacks,
  type CoinsOffer,
  type CoinsPlatform,
} from "@/lib/coins-catalog";
import { Reveal } from "@/components/shared/reveal";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StartCheckoutButton } from "@/components/coins/start-checkout-button";

function formatCoins(value: number) {
  return new Intl.NumberFormat("ru-RU").format(value);
}

function OfferCard({
  offer,
  platform,
  tone,
}: {
  offer: CoinsOffer;
  platform: CoinsPlatform;
  tone: "android" | "ios" | "promo";
}) {
  const Icon = offer.kind === "bundle" ? Gift : Coins;

  const toneClasses =
    tone === "promo"
      ? "from-amber-500/16 via-orange-400/8 to-transparent border-amber-300/15"
      : tone === "ios"
        ? "from-zinc-200/10 via-sky-400/8 to-transparent border-sky-200/10"
        : "from-cyan-400/14 via-blue-500/10 to-transparent border-cyan-300/10";

  const buttonClass =
    tone === "promo"
      ? "bg-amber-300 text-black hover:bg-amber-200"
      : tone === "ios"
        ? "bg-white text-black hover:bg-zinc-200"
        : "bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-500 text-white hover:opacity-95";

  return (
    <div
      className={`group relative overflow-hidden rounded-[1.8rem] border bg-[linear-gradient(180deg,rgba(9,12,18,0.98),rgba(10,14,22,0.92))] p-5 shadow-[0_24px_70px_rgba(0,0,0,0.28)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_34px_90px_rgba(0,0,0,0.36)] ${toneClasses}`}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.08),transparent_30%)] opacity-70" />
      <div className="absolute -right-8 top-6 h-24 w-24 rounded-full bg-white/5 blur-2xl transition duration-300 group-hover:scale-110" />

      <div className="relative flex items-start justify-between gap-3">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-300">
          {offer.badge ?? (platform === "promo" ? "Акция" : platform === "ios" ? "iOS" : "Android")}
        </div>
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
          <Icon className="h-6 w-6" />
        </div>
      </div>

      <div className="relative mt-6">
        <div className="text-sm font-medium uppercase tracking-[0.18em] text-zinc-500">Пакет</div>
        <h3 className="mt-2 text-2xl font-black leading-tight text-white">{offer.title}</h3>
        <div className="mt-4 text-4xl font-black tracking-tight text-amber-300">{formatCoins(offer.coins)}</div>
        <div className="mt-1 text-xs uppercase tracking-[0.3em] text-zinc-500">Coins</div>
      </div>

      <div className="relative mt-5 grid grid-cols-2 gap-3 border-t border-white/10 pt-5 text-sm">
        <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-3">
          <div className="text-xs uppercase tracking-[0.2em] text-zinc-500">Оплаченные</div>
          <div className="mt-2 text-lg font-bold text-white">{formatCoins(offer.paidCoins)}</div>
        </div>
        <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-3">
          <div className="text-xs uppercase tracking-[0.2em] text-zinc-500">Бесплатные</div>
          <div className="mt-2 text-lg font-bold text-white">{formatCoins(offer.freeCoins)}</div>
        </div>
      </div>

      {offer.bonus ? (
        <div className="relative mt-4 rounded-2xl border border-white/8 bg-white/[0.03] p-3 text-sm text-zinc-300">
          <div className="text-xs uppercase tracking-[0.2em] text-zinc-500">Бонус</div>
          <div className="mt-2">{offer.bonus}</div>
        </div>
      ) : null}

      <div className="relative mt-5 flex items-end justify-between gap-4 border-t border-white/10 pt-5">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-zinc-500">Цена</div>
          <div className="mt-2 text-3xl font-black text-white">{formatRubles(offer.priceKopecks)}</div>
        </div>
        <StartCheckoutButton offerId={offer.id} platform={platform} className={`h-12 rounded-full px-5 ${buttonClass}`}>
          К оплате
          <ArrowRight className="ml-2 h-4 w-4" />
        </StartCheckoutButton>
      </div>

      {offer.note ? <p className="relative mt-4 text-sm leading-6 text-zinc-400">{offer.note}</p> : null}
    </div>
  );
}

function OfferGrid({
  offers,
  platform,
  tone,
}: {
  offers: CoinsOffer[];
  platform: CoinsPlatform;
  tone: "android" | "ios" | "promo";
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {offers.map((offer, index) => (
        <Reveal key={offer.id} delay={index * 70}>
          <OfferCard offer={offer} platform={platform} tone={tone} />
        </Reveal>
      ))}
    </div>
  );
}

export function CoinsShowcase() {
  const promoOffersCount = promoCoinPacks.length + promoBundles.length;

  return (
    <section className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-[2rem] border border-white/10 bg-[linear-gradient(135deg,rgba(5,18,34,0.95),rgba(9,13,20,0.96))] p-6 shadow-[0_26px_90px_rgba(0,0,0,0.28)] sm:p-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-400/10 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.26em] text-cyan-200">
            <Coins className="h-4 w-4" />
            Coins Store
          </div>
          <h2 className="mt-5 max-w-3xl font-display text-3xl font-thin leading-tight text-white sm:text-4xl">
            Выбирай платформу, пакет монет и переходи к оформлению оплаты
          </h2>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-zinc-300 sm:text-base">
            Каталог уже подготовлен под online checkout: цены показаны в рублях, для iOS они считаются на 10% выше Android, а нажатие
            на кнопку покупки открывает отдельную страницу оформления. Позже сюда подключается ЮKassa.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <div className="rounded-[1.4rem] border border-white/10 bg-white/[0.04] p-4">
              <div className="text-xs uppercase tracking-[0.22em] text-zinc-500">Android</div>
              <div className="mt-2 text-2xl font-black text-white">{androidCoinPacks.length}</div>
              <div className="mt-1 text-sm text-zinc-400">обычных пакетов</div>
            </div>
            <div className="rounded-[1.4rem] border border-white/10 bg-white/[0.04] p-4">
              <div className="text-xs uppercase tracking-[0.22em] text-zinc-500">iOS</div>
              <div className="mt-2 text-2xl font-black text-white">{iosCoinPacks.length}</div>
              <div className="mt-1 text-sm text-zinc-400">пакетов с +10%</div>
            </div>
            <div className="rounded-[1.4rem] border border-white/10 bg-white/[0.04] p-4">
              <div className="text-xs uppercase tracking-[0.22em] text-zinc-500">Акции</div>
              <div className="mt-2 text-2xl font-black text-white">{promoOffersCount}</div>
              <div className="mt-1 text-sm text-zinc-400">единых предложений</div>
            </div>
          </div>
        </div>

        <div className="rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(18,12,8,0.98),rgba(13,11,18,0.94))] p-6 shadow-[0_26px_90px_rgba(0,0,0,0.28)] sm:p-8">
          <div className="text-xs font-semibold uppercase tracking-[0.28em] text-amber-200/80">Как это работает</div>
          <div className="mt-5 space-y-3">
            <div className="rounded-[1.4rem] border border-white/10 bg-white/[0.04] p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-300/10 text-amber-200">
                  <Smartphone className="h-5 w-5" />
                </div>
                <div>
                  <div className="font-semibold text-white">1. Выберите платформу</div>
                  <p className="mt-1 text-sm leading-6 text-zinc-400">Открой Android, iOS или вкладку акций с единым прайсом.</p>
                </div>
              </div>
            </div>
            <div className="rounded-[1.4rem] border border-white/10 bg-white/[0.04] p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-300/10 text-amber-200">
                  <WalletCards className="h-5 w-5" />
                </div>
                <div>
                  <div className="font-semibold text-white">2. Откройте checkout</div>
                  <p className="mt-1 text-sm leading-6 text-zinc-400">Кнопка покупки переводит на страницу оформления выбранного пакета.</p>
                </div>
              </div>
            </div>
            <div className="rounded-[1.4rem] border border-white/10 bg-white/[0.04] p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-300/10 text-amber-200">
                  <CreditCard className="h-5 w-5" />
                </div>
                <div>
                  <div className="font-semibold text-white">3. Подключите ЮKassa позже</div>
                  <p className="mt-1 text-sm leading-6 text-zinc-400">
                    Страница оформления уже готова. Позже останется привязать создание платежа к финальной кнопке оплаты.
                  </p>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-5 rounded-[1.4rem] border border-emerald-300/20 bg-emerald-400/10 p-4 text-sm leading-6 text-emerald-50/90">
            Поток покупки уже перестроен под оплату, а не под Telegram. Для iOS все цены автоматически выше Android на 10%.
          </div>
        </div>
      </div>

      <Tabs defaultValue="android" className="rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(11,14,23,0.96),rgba(7,10,16,0.96))] p-4 shadow-[0_24px_80px_rgba(0,0,0,0.3)] sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className="text-xs font-semibold uppercase tracking-[0.28em] text-zinc-500">Каталог</div>
            <h3 className="mt-3 text-2xl font-black text-white sm:text-3xl">Обычные пакеты и акционные предложения</h3>
            <p className="mt-3 text-sm leading-7 text-zinc-400 sm:text-base">
              На Android показывается базовая цена, на iOS каждый пакет автоматически дороже на 10%, а акции вынесены отдельно с
              одинаковой стоимостью для обеих платформ.
            </p>
          </div>

          <TabsList className="w-full overflow-x-auto p-1 sm:w-auto">
            <TabsTrigger value="android" className="min-w-[8.5rem] flex-1 sm:flex-none">
              Android
            </TabsTrigger>
            <TabsTrigger value="ios" className="min-w-[8.5rem] flex-1 sm:flex-none">
              iOS
            </TabsTrigger>
            <TabsTrigger value="promo" className="min-w-[8.5rem] flex-1 sm:flex-none">
              Акции
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="android" className="space-y-5">
          <div className="rounded-[1.6rem] border border-cyan-300/10 bg-cyan-400/5 p-4 text-sm leading-7 text-cyan-100/90">
            Базовый Android-прайс уже переведён в рубли. Нажатие на кнопку открывает checkout выбранного пакета.
          </div>
          <OfferGrid offers={androidCoinPacks} platform="android" tone="android" />
        </TabsContent>

        <TabsContent value="ios" className="space-y-5">
          <div className="rounded-[1.6rem] border border-sky-200/10 bg-white/[0.04] p-4 text-sm leading-7 text-zinc-300">
            Все цены для iOS рассчитываются автоматически как Android + 10%. Это правило уже зашито в каталог и будет работать дальше
            без ручного пересчёта.
          </div>
          <OfferGrid offers={iosCoinPacks} platform="ios" tone="ios" />
        </TabsContent>

        <TabsContent value="promo" className="space-y-8">
          <div className="rounded-[1.6rem] border border-amber-300/15 bg-amber-300/8 p-4 text-sm leading-7 text-amber-50/90">
            Все акционные позиции на этой вкладке стоят одинаково для Android и iOS. Здесь собраны бонусные монеты и лимитированные
            наборы.
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-300/10 text-amber-200">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <div className="text-sm font-semibold uppercase tracking-[0.22em] text-amber-200/80">Акционные монеты</div>
                <div className="text-lg font-black text-white">Усиленные пакеты с бонусом к обычному номиналу</div>
              </div>
            </div>
            <OfferGrid offers={promoCoinPacks} platform="promo" tone="promo" />
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-300/10 text-amber-200">
                <Gift className="h-5 w-5" />
              </div>
              <div>
                <div className="text-sm font-semibold uppercase tracking-[0.22em] text-amber-200/80">Акционные наборы</div>
                <div className="text-lg font-black text-white">Стартовые комплекты и лимитированные предложения</div>
              </div>
            </div>
            <OfferGrid offers={promoBundles} platform="promo" tone="promo" />
          </div>
        </TabsContent>
      </Tabs>
    </section>
  );
}
