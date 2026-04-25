"use client";

import { ArrowRight, Coins, Gift, Sparkles } from "lucide-react";
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

const toneClasses = {
  android: {
    card: "border-sky-300/18 bg-[linear-gradient(180deg,rgba(8,15,27,0.96),rgba(5,9,16,0.98))]",
    icon: "border-sky-300/20 bg-sky-400/10 text-sky-100",
    accent: "text-sky-200",
    pill: "border-sky-300/20 bg-sky-400/10 text-sky-100",
    button: "bg-sky-400 text-slate-950 hover:bg-sky-300",
  },
  ios: {
    card: "border-white/14 bg-[linear-gradient(180deg,rgba(15,18,26,0.96),rgba(7,9,15,0.98))]",
    icon: "border-white/15 bg-white/10 text-white",
    accent: "text-zinc-100",
    pill: "border-white/15 bg-white/10 text-zinc-100",
    button: "bg-white text-slate-950 hover:bg-zinc-200",
  },
  promo: {
    card: "border-amber-300/20 bg-[linear-gradient(180deg,rgba(27,17,6,0.96),rgba(11,8,6,0.98))]",
    icon: "border-amber-300/20 bg-amber-300/10 text-amber-100",
    accent: "text-amber-100",
    pill: "border-amber-300/20 bg-amber-300/10 text-amber-100",
    button: "bg-amber-300 text-[#211504] hover:bg-amber-200",
  },
} satisfies Record<CoinsPlatform, Record<"card" | "icon" | "accent" | "pill" | "button", string>>;

function getPlatformLabel(platform: CoinsPlatform) {
  if (platform === "android") return "Android";
  if (platform === "ios") return "iOS";
  return "Акция";
}

function OfferCard({ offer, platform }: { offer: CoinsOffer; platform: CoinsPlatform }) {
  const tone = toneClasses[platform];
  const Icon = offer.kind === "bundle" ? Gift : Coins;

  return (
    <article className={cn("group relative overflow-hidden rounded-2xl border p-4 transition duration-300 hover:-translate-y-1 hover:shadow-[0_20px_55px_rgba(0,0,0,0.32)]", tone.card)}>
      <div className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-white/[0.08] blur-2xl" />
      <div className="relative flex min-h-[190px] flex-col justify-between gap-4">
        <div className="flex items-start justify-between gap-3">
          <span className={cn("rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]", tone.pill)}>
            {offer.badge ?? getPlatformLabel(platform)}
          </span>
          <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border", tone.icon)}>
            <Icon className="h-4 w-4" />
          </div>
        </div>

        <div>
          <h3 className="line-clamp-2 min-h-[2.25rem] text-base font-black leading-tight text-white">{offer.title}</h3>
          {offer.bonus ? <div className="mt-2 line-clamp-1 text-xs text-zinc-400">{offer.bonus}</div> : null}
          <div className="mt-3 flex items-end gap-2">
            <div className={cn("text-3xl font-black leading-none", tone.accent)}>{formatCoins(offer.coins)}</div>
            <div className="pb-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-zinc-500">Coins</div>
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-black/20 p-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">Цена</div>
              <div className="mt-1 text-lg font-black text-white">{formatRubles(offer.priceKopecks)}</div>
            </div>
            <StartCheckoutButton offerId={offer.id} platform={platform} className={cn("h-9 min-h-0 rounded-xl px-3 text-sm font-bold", tone.button)}>
              <span className="flex items-center gap-1.5">
                Купить
                <ArrowRight className="h-3.5 w-3.5" />
              </span>
            </StartCheckoutButton>
          </div>
        </div>
      </div>
    </article>
  );
}

function OfferGrid({ offers, platform, className }: { offers: CoinsOffer[]; platform: CoinsPlatform; className?: string }) {
  return (
    <div className={cn("grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4", className)}>
      {offers.map((offer, index) => (
        <Reveal key={offer.id} delay={index * 45}>
          <OfferCard offer={offer} platform={platform} />
        </Reveal>
      ))}
    </div>
  );
}

export function CoinsShowcase() {
  return (
    <section className="space-y-5">
      <Tabs defaultValue="android" className="rounded-3xl border border-white/10 bg-[linear-gradient(180deg,rgba(10,13,20,0.96),rgba(5,8,13,0.98))] p-4 shadow-[0_20px_70px_rgba(0,0,0,0.28)] sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500">Каталог</div>
            <h3 className="mt-2 text-2xl font-black text-white">Coins и наборы</h3>
          </div>

          <TabsList className="w-full overflow-x-auto p-1 sm:w-auto">
            <TabsTrigger value="android" className="min-w-[7rem] flex-1 sm:flex-none">Android</TabsTrigger>
            <TabsTrigger value="ios" className="min-w-[7rem] flex-1 sm:flex-none">iOS</TabsTrigger>
            <TabsTrigger value="promo" className="min-w-[7rem] flex-1 sm:flex-none">Акции</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="android">
          <OfferGrid offers={androidCoinPacks} platform="android" />
        </TabsContent>

        <TabsContent value="ios">
          <OfferGrid offers={iosCoinPacks} platform="ios" />
        </TabsContent>

        <TabsContent value="promo" className="space-y-6">
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-amber-100">
              <Sparkles className="h-4 w-4" />
              Монеты
            </div>
            <OfferGrid offers={promoCoinPacks} platform="promo" />
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-amber-100">
              <Gift className="h-4 w-4" />
              Наборы
            </div>
            <OfferGrid offers={promoBundles} platform="promo" />
          </div>
        </TabsContent>
      </Tabs>
    </section>
  );
}
