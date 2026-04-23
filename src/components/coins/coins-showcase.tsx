"use client";

import Image from "next/image";
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
    artPath: string;
    artClass: string;
    frameClass: string;
    badgeClass: string;
    platformClass: string;
    iconClass: string;
    statClass: string;
    pricePanelClass: string;
    buttonClass: string;
    coinClass: string;
    glowClass: string;
    baseBackground: string;
    overlayBackground: string;
  }
> = {
  android: {
    artPath: "/coins/coins-card-bg.png",
    artClass: "object-right",
    frameClass:
      "border-cyan-300/16 bg-[linear-gradient(180deg,rgba(6,11,18,0.98),rgba(8,12,18,0.94))] shadow-[0_28px_80px_rgba(0,0,0,0.34)]",
    badgeClass: "border-cyan-300/24 bg-cyan-400/12 text-cyan-100",
    platformClass: "border-white/12 bg-black/30 text-zinc-100",
    iconClass: "border-cyan-200/20 bg-cyan-400/10 text-cyan-100",
    statClass: "border-cyan-300/12 bg-slate-950/60 text-white",
    pricePanelClass: "border-cyan-300/14 bg-slate-950/68",
    buttonClass: "bg-gradient-to-r from-cyan-400 via-sky-500 to-blue-600 text-white hover:opacity-95",
    coinClass: "text-white",
    glowClass: "bg-cyan-400/20",
    baseBackground:
      "radial-gradient(circle at 83% 20%, rgba(34,211,238,0.2), transparent 18%), radial-gradient(circle at 90% 72%, rgba(59,130,246,0.18), transparent 22%), linear-gradient(180deg, rgba(4,8,14,0.95), rgba(5,9,15,0.96))",
    overlayBackground:
      "linear-gradient(90deg, rgba(4,8,14,0.96) 0%, rgba(4,8,14,0.93) 42%, rgba(4,8,14,0.66) 60%, rgba(4,8,14,0.18) 78%, rgba(4,8,14,0.48) 100%)",
  },
  ios: {
    artPath: "/coins/coins-card-bg.png",
    artClass: "object-right",
    frameClass:
      "border-sky-100/14 bg-[linear-gradient(180deg,rgba(8,11,18,0.98),rgba(9,11,16,0.94))] shadow-[0_28px_80px_rgba(0,0,0,0.34)]",
    badgeClass: "border-sky-100/22 bg-white/12 text-white",
    platformClass: "border-white/12 bg-black/30 text-zinc-100",
    iconClass: "border-white/14 bg-white/10 text-white",
    statClass: "border-white/12 bg-black/48 text-white",
    pricePanelClass: "border-white/14 bg-black/60",
    buttonClass: "bg-white text-black hover:bg-zinc-200",
    coinClass: "text-white",
    glowClass: "bg-sky-200/16",
    baseBackground:
      "radial-gradient(circle at 83% 20%, rgba(255,255,255,0.14), transparent 18%), radial-gradient(circle at 90% 72%, rgba(56,189,248,0.14), transparent 22%), linear-gradient(180deg, rgba(7,10,16,0.96), rgba(8,10,15,0.96))",
    overlayBackground:
      "linear-gradient(90deg, rgba(7,10,16,0.96) 0%, rgba(7,10,16,0.93) 42%, rgba(7,10,16,0.64) 60%, rgba(7,10,16,0.18) 78%, rgba(7,10,16,0.44) 100%)",
  },
  promo: {
    artPath: "/coins/promo-coins-card-bg.png",
    artClass: "object-right",
    frameClass:
      "border-amber-300/18 bg-[linear-gradient(180deg,rgba(18,12,7,0.98),rgba(12,9,11,0.95))] shadow-[0_28px_84px_rgba(0,0,0,0.36)]",
    badgeClass: "border-amber-300/26 bg-amber-300/14 text-amber-50",
    platformClass: "border-amber-100/18 bg-black/30 text-amber-50",
    iconClass: "border-amber-200/20 bg-amber-300/12 text-amber-100",
    statClass: "border-amber-300/14 bg-black/46 text-white",
    pricePanelClass: "border-amber-300/16 bg-black/58",
    buttonClass: "bg-amber-300 text-black hover:bg-amber-200",
    coinClass: "text-amber-50",
    glowClass: "bg-amber-300/20",
    baseBackground:
      "radial-gradient(circle at 82% 20%, rgba(251,191,36,0.22), transparent 18%), radial-gradient(circle at 88% 72%, rgba(249,115,22,0.16), transparent 24%), linear-gradient(180deg, rgba(13,8,4,0.97), rgba(12,8,6,0.96))",
    overlayBackground:
      "linear-gradient(90deg, rgba(12,8,4,0.97) 0%, rgba(12,8,4,0.93) 42%, rgba(12,8,4,0.62) 60%, rgba(12,8,4,0.16) 78%, rgba(12,8,4,0.44) 100%)",
  },
};

function getPlatformPill(platform: CoinsPlatform) {
  if (platform === "android") return "Android";
  if (platform === "ios") return "iOS";
  return "Акция";
}

function getOfferSummary(platform: CoinsPlatform) {
  if (platform === "ios") return "Цена для iOS";
  if (platform === "promo") return "Единая цена";
  return "Цена для Android";
}

function getOfferSecondaryLabel(offer: CoinsOffer) {
  return offer.kind === "bundle" ? "Состав" : "Бонус";
}

function getOfferSecondaryValue(offer: CoinsOffer) {
  if (offer.kind === "bundle") {
    return offer.bonus ?? "Спецпредложение";
  }

  if (offer.freeCoins > 0) {
    return `+${formatCoins(offer.freeCoins)} бонусных`;
  }

  return "Без бонуса";
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
  const summary = getOfferSummary(platform);
  const secondaryLabel = getOfferSecondaryLabel(offer);
  const secondaryValue = getOfferSecondaryValue(offer);

  return (
    <article
      className={`group relative aspect-[4/3] overflow-hidden rounded-[2rem] border transition duration-300 hover:-translate-y-1 hover:shadow-[0_34px_95px_rgba(0,0,0,0.42)] ${visual.frameClass}`}
    >
      <div className="absolute inset-0" style={{ background: visual.baseBackground }} />
      <div className={`absolute -right-8 top-10 h-44 w-44 rounded-full blur-3xl ${visual.glowClass}`} />

      <div className="absolute inset-y-0 right-0 w-[56%]">
        <Image
          src={visual.artPath}
          alt=""
          fill
          sizes="(min-width: 1536px) 30vw, (min-width: 1280px) 46vw, (min-width: 768px) 48vw, 100vw"
          className={`pointer-events-none select-none object-cover opacity-100 transition duration-500 group-hover:scale-[1.05] ${visual.artClass}`}
        />
      </div>

      <div className="absolute inset-0" style={{ background: visual.overlayBackground }} />
      <div className="absolute inset-x-0 bottom-0 h-40 bg-[linear-gradient(180deg,transparent,rgba(3,6,10,0.14)_22%,rgba(3,6,10,0.84))]" />

      <div className="relative z-10 flex h-full flex-col justify-between p-5 sm:p-6">
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

        <div className="mt-6 max-w-[54%]">
          <div className="text-[10px] font-semibold uppercase tracking-[0.3em] text-zinc-400">{typeLabel}</div>
          {offer.kind === "bundle" ? (
            <h3 className="mt-2 text-xl font-black leading-tight text-white sm:text-[1.65rem]">{offer.title}</h3>
          ) : null}

          <div className={`${offer.kind === "bundle" ? "mt-4" : "mt-3"} flex items-end gap-2`}>
            <div className={`text-4xl font-black tracking-tight sm:text-[2.8rem] ${visual.coinClass}`}>{formatCoins(offer.coins)}</div>
            <div className="pb-1 text-[10px] font-semibold uppercase tracking-[0.32em] text-zinc-400">Coins</div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <div className={`rounded-[1rem] border px-3 py-2 backdrop-blur-md ${visual.statClass}`}>
              <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-400">Оплаченные</div>
              <div className="mt-1 text-sm font-bold text-white">{formatCoins(offer.paidCoins)}</div>
            </div>
            <div className={`rounded-[1rem] border px-3 py-2 backdrop-blur-md ${visual.statClass}`}>
              <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-400">{secondaryLabel}</div>
              <div className="mt-1 text-sm font-bold text-white">{secondaryValue}</div>
            </div>
          </div>

          <div className={`rounded-[1.35rem] border px-4 py-3 backdrop-blur-xl ${visual.pricePanelClass}`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.28em] text-zinc-400">{summary}</div>
                <div className="mt-1 text-2xl font-black text-white">{formatRubles(offer.priceKopecks)}</div>
              </div>

              <StartCheckoutButton
                offerId={offer.id}
                platform={platform}
                className={`h-11 min-w-[9.25rem] shrink-0 justify-center rounded-full px-5 shadow-[0_16px_38px_rgba(0,0,0,0.3)] ${visual.buttonClass}`}
              >
                Оформить
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
    <div className="grid gap-5 md:grid-cols-2 2xl:grid-cols-3">
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
      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[2rem] border border-white/10 bg-[linear-gradient(135deg,rgba(5,18,34,0.95),rgba(9,13,20,0.96))] p-6 shadow-[0_26px_90px_rgba(0,0,0,0.28)] sm:p-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-400/10 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.26em] text-cyan-200">
            <Coins className="h-4 w-4" />
            Coins Store
          </div>
          <h2 className="mt-5 max-w-3xl font-display text-3xl font-thin leading-tight text-white sm:text-4xl">
            Выбирай платформу, пакет монет или акцию и сразу переходи к оплате
          </h2>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-zinc-300 sm:text-base">
            Карточки оформлены как полноценная витрина: обычные пакеты, отдельный прайс для iOS и акционные предложения с единым
            ценником. Фоновые PNG подставляются прямо в карточку и теперь действительно видны.
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
              <div className="mt-1 text-sm text-zinc-400">спецпредложений</div>
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
                  <div className="font-semibold text-white">2. Выберите пакет</div>
                  <p className="mt-1 text-sm leading-6 text-zinc-400">Каждая карточка показывает цену, состав и бонусы без лишней путаницы.</p>
                </div>
              </div>
            </div>

            <div className="rounded-[1.4rem] border border-white/10 bg-white/[0.04] p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-300/10 text-amber-200">
                  <CreditCard className="h-5 w-5" />
                </div>
                <div>
                  <div className="font-semibold text-white">3. Перейдите к оплате</div>
                  <p className="mt-1 text-sm leading-6 text-zinc-400">Кнопка внутри карточки ведёт на checkout выбранного предложения.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-5 rounded-[1.4rem] border border-emerald-300/20 bg-emerald-400/10 p-4 text-sm leading-6 text-emerald-50/90">
            Внутрь карточек уже подключены твои PNG из `public/coins`, поэтому отдельные обычные и акционные фоны теперь видны прямо в
            сетке товаров.
          </div>
        </div>
      </div>

      <Tabs defaultValue="android" className="rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(11,14,23,0.96),rgba(7,10,16,0.96))] p-4 shadow-[0_24px_80px_rgba(0,0,0,0.3)] sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className="text-xs font-semibold uppercase tracking-[0.28em] text-zinc-500">Каталог</div>
            <h3 className="mt-3 text-2xl font-black text-white sm:text-3xl">Обычные пакеты и акционные предложения</h3>
            <p className="mt-3 text-sm leading-7 text-zinc-400 sm:text-base">
              На широких экранах карточки стали крупнее, а фон с монетами теперь читается сразу. На планшете и мобильных всё остаётся
              аккуратным и адаптивным.
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
            Базовый Android-прайс в рублях. Фон карточек показывает обычные пакеты монет.
          </div>
          <OfferGrid offers={androidCoinPacks} platform="android" tone="android" />
        </TabsContent>

        <TabsContent value="ios" className="space-y-5">
          <div className="rounded-[1.6rem] border border-sky-200/10 bg-white/[0.04] p-4 text-sm leading-7 text-zinc-300">
            Все цены для iOS считаются автоматически как Android + 10%, а визуально карточки получают более светлый премиальный стиль.
          </div>
          <OfferGrid offers={iosCoinPacks} platform="ios" tone="ios" />
        </TabsContent>

        <TabsContent value="promo" className="space-y-8">
          <div className="rounded-[1.6rem] border border-amber-300/15 bg-amber-300/8 p-4 text-sm leading-7 text-amber-50/90">
            Все акционные позиции используют единый прайс для Android и iOS и отдельный золотой фон карточки.
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-300/10 text-amber-200">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <div className="text-sm font-semibold uppercase tracking-[0.22em] text-amber-200/80">Акционные монеты</div>
                <div className="text-lg font-black text-white">Пакеты с усиленным бонусом к обычному номиналу</div>
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
