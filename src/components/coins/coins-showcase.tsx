"use client";

import { ArrowRight, Coins, Sparkles } from "lucide-react";
import { Reveal } from "@/components/shared/reveal";
import { StartCheckoutButton } from "@/components/coins/start-checkout-button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatRubles, type CoinsOffer, type CoinsPlatform } from "@/lib/coins-catalog";
import { cn } from "@/lib/utils";

const toneClasses = {
  android: {
    card: "border-sky-300/[0.18] bg-[linear-gradient(180deg,rgba(8,15,27,0.97),rgba(5,9,16,0.99))]",
    icon: "border-sky-300/20 bg-sky-400/10 text-sky-100",
    pill: "border-sky-300/20 bg-sky-400/10 text-sky-100",
    button: "bg-sky-400 text-slate-950 hover:bg-sky-300",
    glow: "bg-sky-400/[0.14]",
  },
  ios: {
    card: "border-white/[0.14] bg-[linear-gradient(180deg,rgba(15,18,26,0.97),rgba(7,9,15,0.99))]",
    icon: "border-white/15 bg-white/10 text-white",
    pill: "border-white/15 bg-white/10 text-zinc-100",
    button: "bg-white text-slate-950 hover:bg-zinc-200",
    glow: "bg-white/10",
  },
  promo: {
    card: "border-amber-300/20 bg-[linear-gradient(180deg,rgba(27,17,6,0.97),rgba(11,8,6,0.99))]",
    icon: "border-amber-300/20 bg-amber-300/10 text-amber-100",
    pill: "border-amber-300/20 bg-amber-300/10 text-amber-100",
    button: "bg-amber-300 text-[#211504] hover:bg-amber-200",
    glow: "bg-amber-300/[0.14]",
  },
} satisfies Record<CoinsPlatform, Record<"card" | "icon" | "pill" | "button" | "glow", string>>;

function getPlatformLabel(platform: CoinsPlatform) {
  if (platform === "android") return "Android";
  if (platform === "ios") return "iOS";
  return "Акция";
}

function OfferCard({ offer, platform }: { offer: CoinsOffer; platform: CoinsPlatform }) {
  const tone = toneClasses[platform];

  return (
    <article
      className={cn(
        "group relative h-full overflow-hidden rounded-xl border p-3 transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_16px_42px_rgba(0,0,0,0.3)] sm:rounded-2xl sm:p-4",
        tone.card,
      )}
    >
      <div className={cn("pointer-events-none absolute -right-10 -top-10 h-24 w-24 rounded-full blur-3xl transition duration-300 group-hover:opacity-80", tone.glow)} />

      <div className="relative flex min-h-[150px] flex-col justify-between gap-3 sm:min-h-[178px]">
        <div className="flex items-start justify-between gap-2">
          <span className={cn("rounded-full border px-2 py-1 text-[10px] font-semibold leading-none sm:px-2.5 sm:text-[11px]", tone.pill)}>
            {getPlatformLabel(platform)}
          </span>
          <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border sm:h-9 sm:w-9", tone.icon)}>
            <Coins className="h-4 w-4" />
          </div>
        </div>

        <div>
          <h3 className="line-clamp-2 min-h-[2rem] text-[13px] font-black leading-tight text-white sm:min-h-[2.5rem] sm:text-base">
            {offer.title}
          </h3>
          <div className="mt-3">
            <div className="text-[10px] font-semibold text-zinc-500 sm:text-xs">Цена</div>
            <div className="mt-0.5 text-lg font-black leading-none text-white sm:text-xl">{formatRubles(offer.priceKopecks)}</div>
          </div>
        </div>

        <StartCheckoutButton className={cn("h-9 min-h-0 w-full rounded-xl px-3 text-xs font-bold sm:h-10 sm:text-sm", tone.button)}>
          <span className="flex items-center justify-center gap-1.5">
            Купить
            <ArrowRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          </span>
        </StartCheckoutButton>
      </div>
    </article>
  );
}

function OfferGrid({ offers, platform }: { offers: CoinsOffer[]; platform: CoinsPlatform }) {
  if (!offers.length) {
    return (
      <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-5 text-sm text-zinc-500 sm:p-6">
        Товары скоро появятся.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-3 2xl:grid-cols-4">
      {offers.map((offer, index) => (
        <Reveal key={offer.id} delay={index * 45}>
          <OfferCard offer={offer} platform={platform} />
        </Reveal>
      ))}
    </div>
  );
}

export function CoinsShowcase({ offersByPlatform }: { offersByPlatform: Record<CoinsPlatform, CoinsOffer[]> }) {
  return (
    <section className="space-y-5">
      <Tabs defaultValue="android" className="rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(10,13,20,0.96),rgba(5,8,13,0.98))] p-3 shadow-[0_20px_70px_rgba(0,0,0,0.28)] sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-[11px] font-semibold text-zinc-500 sm:text-xs">Каталог</div>
            <h2 className="mt-1 text-2xl font-black leading-tight text-white sm:text-3xl">Coins</h2>
          </div>

          <TabsList className="grid w-full grid-cols-3 gap-1 rounded-xl bg-black/25 p-1 sm:w-auto sm:min-w-[22rem] sm:rounded-2xl">
            <TabsTrigger value="android" className="min-w-0 px-2 py-2 text-xs font-semibold sm:px-4 sm:text-sm">
              Android
            </TabsTrigger>
            <TabsTrigger value="ios" className="min-w-0 px-2 py-2 text-xs font-semibold sm:px-4 sm:text-sm">
              iOS
            </TabsTrigger>
            <TabsTrigger value="promo" className="min-w-0 px-2 py-2 text-xs font-semibold sm:px-4 sm:text-sm">
              Акции
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="android" className="mt-5 sm:mt-6">
          <OfferGrid offers={offersByPlatform.android} platform="android" />
        </TabsContent>

        <TabsContent value="ios" className="mt-5 sm:mt-6">
          <OfferGrid offers={offersByPlatform.ios} platform="ios" />
        </TabsContent>

        <TabsContent value="promo" className="mt-5 space-y-3 sm:mt-6">
          <div className="flex items-center gap-2 text-xs font-semibold text-amber-100 sm:text-sm">
            <Sparkles className="h-4 w-4" />
            Акции
          </div>
          <OfferGrid offers={offersByPlatform.promo} platform="promo" />
        </TabsContent>
      </Tabs>
    </section>
  );
}
