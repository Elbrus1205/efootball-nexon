"use client";

import Image from "next/image";
import { ArrowRight, Coins, CreditCard, Gift, Smartphone, Sparkles, WalletCards } from "lucide-react";
import { Reveal } from "@/components/shared/reveal";
import { StartCheckoutButton } from "@/components/coins/start-checkout-button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
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
    pricePanelClass: string;
    buttonClass: string;
    buttonArrowClass: string;
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
    pricePanelClass:
      "border-cyan-300/16 bg-[linear-gradient(135deg,rgba(9,14,22,0.82),rgba(10,33,63,0.62))] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]",
    buttonClass:
      "border border-cyan-100/18 bg-[linear-gradient(135deg,#22d3ee_0%,#2c8dff_58%,#2555d9_100%)] text-white shadow-[0_10px_28px_rgba(37,99,235,0.34)] hover:-translate-y-0.5 hover:brightness-110 hover:shadow-[0_14px_32px_rgba(37,99,235,0.38)]",
    buttonArrowClass: "bg-white/14 text-white",
    coinClass: "text-white",
    glowClass: "bg-cyan-400/20",
    baseBackground:
      "radial-gradient(circle at 83% 20%, rgba(34,211,238,0.2), transparent 18%), radial-gradient(circle at 90% 72%, rgba(59,130,246,0.18), transparent 22%), linear-gradient(180deg, rgba(4,8,14,0.95), rgba(5,9,15,0.96))",
    overlayBackground:
      "linear-gradient(90deg, rgba(4,8,14,0.95) 0%, rgba(4,8,14,0.9) 40%, rgba(4,8,14,0.58) 60%, rgba(4,8,14,0.14) 78%, rgba(4,8,14,0.42) 100%)",
  },
  ios: {
    artPath: "/coins/coins-card-bg.png",
    artClass: "object-right",
    frameClass:
      "border-sky-100/14 bg-[linear-gradient(180deg,rgba(8,11,18,0.98),rgba(9,11,16,0.94))] shadow-[0_28px_80px_rgba(0,0,0,0.34)]",
    badgeClass: "border-sky-100/22 bg-white/12 text-white",
    platformClass: "border-white/12 bg-black/30 text-zinc-100",
    iconClass: "border-white/14 bg-white/10 text-white",
    pricePanelClass:
      "border-white/16 bg-[linear-gradient(135deg,rgba(10,14,24,0.8),rgba(37,48,75,0.58))] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]",
    buttonClass:
      "border border-white/28 bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(219,234,254,0.92))] text-slate-950 shadow-[0_10px_26px_rgba(148,163,184,0.24)] hover:-translate-y-0.5 hover:brightness-105",
    buttonArrowClass: "bg-slate-950/10 text-slate-900",
    coinClass: "text-white",
    glowClass: "bg-sky-200/16",
    baseBackground:
      "radial-gradient(circle at 83% 20%, rgba(255,255,255,0.14), transparent 18%), radial-gradient(circle at 90% 72%, rgba(56,189,248,0.14), transparent 22%), linear-gradient(180deg, rgba(7,10,16,0.96), rgba(8,10,15,0.96))",
    overlayBackground:
      "linear-gradient(90deg, rgba(7,10,16,0.95) 0%, rgba(7,10,16,0.91) 40%, rgba(7,10,16,0.56) 60%, rgba(7,10,16,0.14) 78%, rgba(7,10,16,0.4) 100%)",
  },
  promo: {
    artPath: "/coins/promo-coins-card-bg.png",
    artClass: "object-right",
    frameClass:
      "border-amber-300/18 bg-[linear-gradient(180deg,rgba(18,12,7,0.98),rgba(12,9,11,0.95))] shadow-[0_28px_84px_rgba(0,0,0,0.36)]",
    badgeClass: "border-amber-300/26 bg-amber-300/14 text-amber-50",
    platformClass: "border-amber-100/18 bg-black/30 text-amber-50",
    iconClass: "border-amber-200/20 bg-amber-300/12 text-amber-100",
    pricePanelClass:
      "border-amber-300/16 bg-[linear-gradient(135deg,rgba(18,11,6,0.78),rgba(74,48,10,0.62))] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]",
    buttonClass:
      "border border-amber-50/18 bg-[linear-gradient(135deg,#f8e18a_0%,#f5bf35_58%,#ed9812_100%)] text-[#1d1405] shadow-[0_10px_28px_rgba(245,158,11,0.28)] hover:-translate-y-0.5 hover:brightness-105 hover:shadow-[0_14px_32px_rgba(245,158,11,0.34)]",
    buttonArrowClass: "bg-black/10 text-[#1d1405]",
    coinClass: "text-amber-50",
    glowClass: "bg-amber-300/20",
    baseBackground:
      "radial-gradient(circle at 82% 20%, rgba(251,191,36,0.22), transparent 18%), radial-gradient(circle at 88% 72%, rgba(249,115,22,0.16), transparent 24%), linear-gradient(180deg, rgba(13,8,4,0.97), rgba(12,8,6,0.96))",
    overlayBackground:
      "linear-gradient(90deg, rgba(12,8,4,0.95) 0%, rgba(12,8,4,0.9) 40%, rgba(12,8,4,0.56) 60%, rgba(12,8,4,0.14) 78%, rgba(12,8,4,0.42) 100%)",
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
  const isPromoBundle = tone === "promo" && offer.kind === "bundle";
  const typeLabel = offer.kind === "bundle" ? "Лимитированный набор" : "Пакет монет";
  const summary = getOfferSummary(platform);
  const overlayBackground = isPromoBundle
    ? "linear-gradient(90deg, rgba(12,8,4,0.97) 0%, rgba(12,8,4,0.94) 48%, rgba(12,8,4,0.76) 64%, rgba(12,8,4,0.22) 84%, rgba(12,8,4,0.3) 100%)"
    : visual.overlayBackground;

  return (
    <article
      className={`group relative aspect-[4/3] overflow-hidden rounded-[1.45rem] border transition duration-300 hover:-translate-y-1 hover:shadow-[0_34px_95px_rgba(0,0,0,0.42)] sm:rounded-[1.9rem] ${visual.frameClass}`}
    >
      <div className="absolute inset-0" style={{ background: visual.baseBackground }} />
      <div className={`absolute -right-8 top-6 h-32 w-32 rounded-full blur-3xl sm:top-8 sm:h-40 sm:w-40 ${visual.glowClass}`} />

      <div className={cn("absolute inset-y-0 right-0", isPromoBundle ? "w-[49%] sm:w-[50%]" : "w-[52%] sm:w-[55%]")}>
        <Image
          src={visual.artPath}
          alt=""
          fill
          sizes="(min-width: 1536px) 30vw, (min-width: 1280px) 46vw, (min-width: 768px) 48vw, 100vw"
          className={cn(
            "pointer-events-none select-none object-cover opacity-100 transition duration-500 group-hover:scale-[1.05]",
            isPromoBundle ? "object-[86%_58%] scale-[1.04] group-hover:scale-[1.08]" : visual.artClass,
          )}
        />
      </div>

      <div className="absolute inset-0" style={{ background: overlayBackground }} />
      <div className="absolute inset-x-0 bottom-0 h-28 bg-[linear-gradient(180deg,transparent,rgba(3,6,10,0.14)_20%,rgba(3,6,10,0.84))] sm:h-36" />

      <div className="relative z-10 flex h-full flex-col justify-between p-3.5 sm:p-5">
        <div className="flex items-start justify-between gap-2 sm:gap-3">
          <div className="flex flex-wrap gap-1.5 sm:gap-2">
            <span
              className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.16em] sm:px-3 sm:text-[11px] sm:tracking-[0.22em] ${visual.badgeClass}`}
            >
              {offer.badge ?? typeLabel}
            </span>
            <span
              className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.16em] sm:px-3 sm:text-[11px] sm:tracking-[0.22em] ${visual.platformClass}`}
            >
              {getPlatformPill(platform)}
            </span>
          </div>

          <div
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[0.95rem] border backdrop-blur-md sm:h-10 sm:w-10 sm:rounded-[1rem] ${visual.iconClass}`}
          >
            <Icon className="h-4 w-4 sm:h-[1.1rem] sm:w-[1.1rem]" />
          </div>
        </div>

        <div className={cn("mt-3.5 sm:mt-5", isPromoBundle ? "max-w-[56%] sm:max-w-[58%]" : "max-w-[50%] sm:max-w-[52%]")}>
          {offer.kind === "bundle" ? (
            <h3 className={cn("line-clamp-2 font-black leading-tight text-white", isPromoBundle ? "text-[1rem] sm:text-[1.32rem]" : "text-[1.05rem] sm:text-[1.4rem]")}>
              {offer.title}
            </h3>
          ) : null}

          <div className={`${offer.kind === "bundle" ? "mt-2.5 sm:mt-3.5" : "mt-1.5 sm:mt-2.5"} flex items-end gap-1.5 sm:gap-2`}>
            <div className={`text-[2.05rem] font-black tracking-tight sm:text-[2.65rem] ${visual.coinClass}`}>{formatCoins(offer.coins)}</div>
            <div className="pb-0.5 text-[8px] font-semibold uppercase tracking-[0.22em] text-zinc-400 sm:pb-1 sm:text-[10px] sm:tracking-[0.32em]">
              Coins
            </div>
          </div>
        </div>

        <div>
          <div
            className={cn(
              "rounded-[1.05rem] border px-3 py-2 backdrop-blur-2xl sm:rounded-[1.25rem] sm:px-4 sm:py-3",
              visual.pricePanelClass,
              isPromoBundle && "border-amber-200/18 bg-[linear-gradient(135deg,rgba(21,13,6,0.88),rgba(78,51,11,0.72))]",
            )}
          >
            <div className={cn(isPromoBundle ? "space-y-2.5" : "grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2.5 sm:gap-3")}>
              <div className="min-w-0">
                <div className="text-[8px] font-semibold uppercase tracking-[0.18em] text-zinc-400 sm:text-[10px] sm:tracking-[0.28em]">{summary}</div>
                <div className="mt-1 text-[1.18rem] font-black leading-none text-white sm:text-[1.7rem]">{formatRubles(offer.priceKopecks)}</div>
              </div>

              <StartCheckoutButton
                offerId={offer.id}
                platform={platform}
                className={cn(
                  "min-h-0 shrink-0 font-bold",
                  isPromoBundle
                    ? `h-10 w-full justify-between rounded-[1rem] px-4 text-[14px] sm:h-11 sm:rounded-[1.05rem] sm:px-4.5 sm:text-[15px] ${visual.buttonClass}`
                    : `h-9 min-w-[6.9rem] justify-center gap-2 rounded-[0.95rem] px-3 text-[13px] sm:h-10 sm:min-w-[7.8rem] sm:rounded-[1.05rem] sm:px-4 sm:text-[15px] ${visual.buttonClass}`,
                )}
              >
                <span>Оформить</span>
                <span className={`flex h-5 w-5 items-center justify-center rounded-full sm:h-6 sm:w-6 ${visual.buttonArrowClass}`}>
                  <ArrowRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                </span>
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
  className,
}: {
  offers: CoinsOffer[];
  platform: CoinsPlatform;
  tone: OfferTone;
  className?: string;
}) {
  return (
    <div className={cn("grid gap-4 md:grid-cols-2 xl:grid-cols-3", className)}>
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

        </div>
      </div>

      <Tabs defaultValue="android" className="rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(11,14,23,0.96),rgba(7,10,16,0.96))] p-4 shadow-[0_24px_80px_rgba(0,0,0,0.3)] sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className="text-xs font-semibold uppercase tracking-[0.28em] text-zinc-500">Каталог</div>
            <h3 className="mt-3 text-2xl font-black text-white sm:text-3xl">Обычные пакеты и акционные предложения</h3>
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
            <OfferGrid offers={promoBundles} platform="promo" tone="promo" className="xl:grid-cols-2" />
          </div>
        </TabsContent>
      </Tabs>
    </section>
  );
}
