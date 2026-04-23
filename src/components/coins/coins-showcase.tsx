"use client";

import { ArrowRight, Coins, CreditCard, Gift, Smartphone, Sparkles, WalletCards } from "lucide-react";
import { Reveal } from "@/components/shared/reveal";
import { StartCheckoutButton } from "@/components/coins/start-checkout-button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  androidCoinPacks,
  formatRubles,
  iosCoinPacks,
  promoBundles,
  promoCoinPacks,
  type CoinsOffer,
  type CoinsPlatform,
} from "@/lib/coins-catalog";

function formatCoins(value: number) {
  return new Intl.NumberFormat("ru-RU").format(value);
}

type OfferTone = "android" | "ios" | "promo";

const toneVisuals: Record<
  OfferTone,
  {
    backgroundPath: string;
    backgroundPosition: string;
    shellClass: string;
    badgeClass: string;
    platformClass: string;
    iconClass: string;
    panelClass: string;
    statClass: string;
    buttonClass: string;
    coinValueClass: string;
    baseLayer: string;
    overlay: string;
    accent: string;
  }
> = {
  android: {
    backgroundPath: "/coins/coins-card-bg.png",
    backgroundPosition: "86% center",
    shellClass:
      "border-cyan-300/15 bg-[linear-gradient(180deg,rgba(7,12,20,0.98),rgba(6,10,17,0.95))] shadow-[0_32px_90px_rgba(0,0,0,0.34)]",
    badgeClass: "border-cyan-300/25 bg-cyan-400/12 text-cyan-50",
    platformClass: "border-white/12 bg-black/25 text-zinc-200",
    iconClass: "border-cyan-200/20 bg-cyan-400/12 text-cyan-100",
    panelClass: "border-cyan-200/14 bg-slate-950/55",
    statClass: "border-cyan-300/14 bg-slate-950/45 text-cyan-50",
    buttonClass: "bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-500 text-white hover:opacity-95",
    coinValueClass: "text-cyan-50",
    baseLayer:
      "radial-gradient(circle at 86% 18%, rgba(34, 211, 238, 0.22), transparent 24%), radial-gradient(circle at 80% 82%, rgba(59, 130, 246, 0.18), transparent 28%), linear-gradient(180deg, rgba(6, 10, 18, 0.64), rgba(6, 10, 18, 0.82))",
    overlay:
      "linear-gradient(111deg, rgba(4, 8, 15, 0.97) 0%, rgba(4, 8, 15, 0.9) 34%, rgba(4, 8, 15, 0.48) 63%, rgba(4, 8, 15, 0.85) 100%)",
    accent: "linear-gradient(90deg, rgba(34,211,238,0), rgba(34,211,238,0.82), rgba(59,130,246,0))",
  },
  ios: {
    backgroundPath: "/coins/coins-card-bg.png",
    backgroundPosition: "86% center",
    shellClass:
      "border-sky-100/14 bg-[linear-gradient(180deg,rgba(11,14,22,0.98),rgba(8,10,16,0.95))] shadow-[0_32px_90px_rgba(0,0,0,0.34)]",
    badgeClass: "border-sky-100/24 bg-white/12 text-white",
    platformClass: "border-white/12 bg-black/25 text-zinc-200",
    iconClass: "border-sky-100/16 bg-white/12 text-white",
    panelClass: "border-white/12 bg-black/45",
    statClass: "border-white/12 bg-black/35 text-white",
    buttonClass: "bg-white text-black hover:bg-zinc-200",
    coinValueClass: "text-white",
    baseLayer:
      "radial-gradient(circle at 86% 18%, rgba(255, 255, 255, 0.16), transparent 22%), radial-gradient(circle at 76% 84%, rgba(56, 189, 248, 0.14), transparent 28%), linear-gradient(180deg, rgba(8, 10, 18, 0.6), rgba(8, 10, 18, 0.82))",
    overlay:
      "linear-gradient(111deg, rgba(9, 11, 17, 0.97) 0%, rgba(9, 11, 17, 0.9) 35%, rgba(9, 11, 17, 0.48) 63%, rgba(9, 11, 17, 0.86) 100%)",
    accent: "linear-gradient(90deg, rgba(255,255,255,0), rgba(255,255,255,0.86), rgba(125,211,252,0))",
  },
  promo: {
    backgroundPath: "/coins/promo-coins-card-bg.png",
    backgroundPosition: "82% center",
    shellClass:
      "border-amber-300/18 bg-[linear-gradient(180deg,rgba(22,14,7,0.98),rgba(13,10,14,0.95))] shadow-[0_32px_90px_rgba(0,0,0,0.36)]",
    badgeClass: "border-amber-300/24 bg-amber-300/14 text-amber-50",
    platformClass: "border-amber-200/18 bg-black/25 text-amber-50/85",
    iconClass: "border-amber-200/20 bg-amber-300/12 text-amber-100",
    panelClass: "border-amber-200/18 bg-black/48",
    statClass: "border-amber-300/14 bg-black/38 text-amber-50",
    buttonClass: "bg-amber-300 text-black hover:bg-amber-200",
    coinValueClass: "text-amber-50",
    baseLayer:
      "radial-gradient(circle at 84% 18%, rgba(251, 191, 36, 0.26), transparent 24%), radial-gradient(circle at 80% 80%, rgba(249, 115, 22, 0.18), transparent 30%), linear-gradient(180deg, rgba(18, 12, 8, 0.62), rgba(18, 12, 8, 0.84))",
    overlay:
      "linear-gradient(111deg, rgba(13, 8, 4, 0.97) 0%, rgba(13, 8, 4, 0.9) 34%, rgba(13, 8, 4, 0.46) 63%, rgba(13, 8, 4, 0.88) 100%)",
    accent: "linear-gradient(90deg, rgba(251,191,36,0), rgba(251,191,36,0.86), rgba(249,115,22,0))",
  },
};

function getPlatformPill(platform: CoinsPlatform) {
  if (platform === "android") return "Android";
  if (platform === "ios") return "iOS";
  return "Акция";
}

function getOfferSummary(tone: OfferTone) {
  if (tone === "ios") return "Android + 10%";
  if (tone === "promo") return "Одинаковая цена";
  return "Базовый Android";
}

function OfferCard({
  offer,
  platform,
  tone,
}: {
  offer: CoinsOffer;
  platform: CoinsPlatform;
  tone: OfferTone;
}) {
  const Icon = offer.kind === "bundle" ? Gift : Coins;
  const visual = toneVisuals[tone];
  const typeLabel = offer.kind === "bundle" ? "Лимитированный набор" : "Пакет монет";
  const summary = getOfferSummary(tone);
  const secondaryValue =
    offer.kind === "bundle"
      ? offer.bonus ?? "Спецпредложение"
      : `${formatCoins(offer.freeCoins)} бонусных`;

  return (
    <article
      className={`group relative aspect-[4/3] overflow-hidden rounded-[2rem] border transition duration-300 hover:-translate-y-1 hover:shadow-[0_38px_110px_rgba(0,0,0,0.42)] ${visual.shellClass}`}
    >
      <div className="absolute inset-0" style={{ background: visual.baseLayer }} />
      <div
        className="absolute inset-0 scale-[1.02] bg-cover bg-no-repeat opacity-95 transition duration-500 group-hover:scale-[1.06]"
        style={{
          backgroundImage: `url('${visual.backgroundPath}')`,
          backgroundPosition: visual.backgroundPosition,
        }}
      />
      <div className="absolute inset-0" style={{ background: visual.overlay }} />
      <div className="absolute inset-x-6 bottom-[6.15rem] h-px opacity-80" style={{ backgroundImage: visual.accent }} />
      <div className="absolute inset-x-0 bottom-0 h-32 bg-[linear-gradient(180deg,transparent,rgba(3,6,11,0.46)_45%,rgba(3,6,11,0.82))]" />
      <div className="absolute -right-10 top-6 h-32 w-32 rounded-full bg-white/10 blur-3xl transition duration-500 group-hover:scale-110" />

      <div className="relative z-10 flex h-full flex-col p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            <span
              className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] ${visual.badgeClass}`}
            >
              {offer.badge ?? typeLabel}
            </span>
            <span
              className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] ${visual.platformClass}`}
            >
              {getPlatformPill(platform)}
            </span>
          </div>

          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[1.1rem] border backdrop-blur-md ${visual.iconClass}`}
          >
            <Icon className="h-5 w-5" />
          </div>
        </div>

        <div className="mt-auto space-y-4">
          <div className="max-w-[72%]">
            <div className="text-[10px] font-semibold uppercase tracking-[0.28em] text-zinc-400">{typeLabel}</div>
            <h3 className="mt-1.5 text-lg font-black leading-tight text-white sm:text-xl">{offer.title}</h3>
            <div className="mt-3 flex items-end gap-2">
              <div className={`text-3xl font-black tracking-tight sm:text-[2.3rem] ${visual.coinValueClass}`}>
                {formatCoins(offer.coins)}
              </div>
              <div className="pb-1 text-[10px] font-semibold uppercase tracking-[0.34em] text-zinc-400">Coins</div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <div className={`rounded-[1rem] border px-3 py-2 backdrop-blur-md ${visual.statClass}`}>
              <div className="text-[10px] uppercase tracking-[0.22em] text-zinc-400">Оплаченные</div>
              <div className="mt-1 text-sm font-bold text-white">{formatCoins(offer.paidCoins)}</div>
            </div>
            <div className={`rounded-[1rem] border px-3 py-2 backdrop-blur-md ${visual.statClass}`}>
              <div className="text-[10px] uppercase tracking-[0.22em] text-zinc-400">
                {offer.kind === "bundle" ? "Бонус" : "Дополнительно"}
              </div>
              <div className="mt-1 text-sm font-bold text-white">{secondaryValue}</div>
            </div>
          </div>

          <div className={`rounded-[1.35rem] border px-4 py-3 backdrop-blur-xl ${visual.panelClass}`}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.28em] text-zinc-400">{summary}</div>
                <div className="mt-1 text-2xl font-black text-white">{formatRubles(offer.priceKopecks)}</div>
              </div>
              <StartCheckoutButton
                offerId={offer.id}
                platform={platform}
                className={`h-10 shrink-0 rounded-full px-4 shadow-[0_18px_40px_rgba(0,0,0,0.28)] ${visual.buttonClass}`}
              >
                К оплате
                <ArrowRight className="ml-2 h-4 w-4" />
              </StartCheckoutButton>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

function OfferGrid({
  offers,
  platform,
  tone,
}: {
  offers: CoinsOffer[];
  platform: CoinsPlatform;
  tone: OfferTone;
}) {
  return (
    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
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
            Витрина монет и акционных наборов уже готова под красивые карточки и checkout
          </h2>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-zinc-300 sm:text-base">
            Обычные пакеты и акционные предложения теперь можно показывать как полноценные товарные карточки с фоном 4:3.
            Для iOS цена считается автоматически как Android + 10%, а покупка сразу ведёт к оформлению оплаты.
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
                  <p className="mt-1 text-sm leading-6 text-zinc-400">Android, iOS или вкладку с акциями и единым прайсом.</p>
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
                  <p className="mt-1 text-sm leading-6 text-zinc-400">Кнопка покупки переводит на оформление выбранного пакета.</p>
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
                  <p className="mt-1 text-sm leading-6 text-zinc-400">Страница оплаты уже готова, останется только привязать создание платежа.</p>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-5 rounded-[1.4rem] border border-emerald-300/20 bg-emerald-400/10 p-4 text-sm leading-6 text-emerald-50/90">
            Под карточки уже заложены два фоновых PNG формата 4:3: один для обычных монет и один для акционных предложений.
          </div>
        </div>
      </div>

      <Tabs defaultValue="android" className="rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(11,14,23,0.96),rgba(7,10,16,0.96))] p-4 shadow-[0_24px_80px_rgba(0,0,0,0.3)] sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className="text-xs font-semibold uppercase tracking-[0.28em] text-zinc-500">Каталог</div>
            <h3 className="mt-3 text-2xl font-black text-white sm:text-3xl">Обычные пакеты и акционные предложения</h3>
            <p className="mt-3 text-sm leading-7 text-zinc-400 sm:text-base">
              Каждая карточка теперь собрана под фоновый арт 4:3: текст читается с левой стороны, справа остаётся место под монеты
              и визуал пакета.
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
            Базовый Android-прайс в рублях. Карточки используют общий фон для обычных пакетов монет.
          </div>
          <OfferGrid offers={androidCoinPacks} platform="android" tone="android" />
        </TabsContent>

        <TabsContent value="ios" className="space-y-5">
          <div className="rounded-[1.6rem] border border-sky-200/10 bg-white/[0.04] p-4 text-sm leading-7 text-zinc-300">
            Все цены для iOS рассчитываются автоматически как Android + 10%. Визуально карточки совпадают с Android, но имеют
            отдельный стиль и подпись.
          </div>
          <OfferGrid offers={iosCoinPacks} platform="ios" tone="ios" />
        </TabsContent>

        <TabsContent value="promo" className="space-y-8">
          <div className="rounded-[1.6rem] border border-amber-300/15 bg-amber-300/8 p-4 text-sm leading-7 text-amber-50/90">
            Все позиции в акциях используют единый прайс для Android и iOS и получают отдельный золотой фон карточки.
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
