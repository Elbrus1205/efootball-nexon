"use client";

import { ArrowRight, Coins, Sparkles } from "lucide-react";
import { Reveal } from "@/components/shared/reveal";
import { StartCheckoutButton } from "@/components/coins/start-checkout-button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatRubles, type CoinsOffer, type CoinsPlatform } from "@/lib/coins-catalog";
import { cn } from "@/lib/utils";

const toneClasses = {
  android: {
    card: "border-sky-300/18 bg-[linear-gradient(180deg,rgba(8,15,27,0.96),rgba(5,9,16,0.98))]",
    icon: "border-sky-300/20 bg-sky-400/10 text-sky-100",
    pill: "border-sky-300/20 bg-sky-400/10 text-sky-100",
    button: "bg-sky-400 text-slate-950 hover:bg-sky-300",
  },
  ios: {
    card: "border-white/14 bg-[linear-gradient(180deg,rgba(15,18,26,0.96),rgba(7,9,15,0.98))]",
    icon: "border-white/15 bg-white/10 text-white",
    pill: "border-white/15 bg-white/10 text-zinc-100",
    button: "bg-white text-slate-950 hover:bg-zinc-200",
  },
  promo: {
    card: "border-amber-300/20 bg-[linear-gradient(180deg,rgba(27,17,6,0.96),rgba(11,8,6,0.98))]",
    icon: "border-amber-300/20 bg-amber-300/10 text-amber-100",
    pill: "border-amber-300/20 bg-amber-300/10 text-amber-100",
    button: "bg-amber-300 text-[#211504] hover:bg-amber-200",
  },
} satisfies Record<CoinsPlatform, Record<"card" | "icon" | "pill" | "button", string>>;

function getPlatformLabel(platform: CoinsPlatform) {
  if (platform === "android") return "Android";
  if (platform === "ios") return "iOS";
  return "Акция";
}

function OfferCard({ offer, platform }: { offer: CoinsOffer; platform: CoinsPlatform }) {
  const tone = toneClasses[platform];

  return (
    <article className={cn("group relative overflow-hidden rounded-2xl border p-3 transition duration-300 hover:-translate-y-1 hover:shadow-[0_16px_42px_rgba(0,0,0,0.28)]", tone.card)}>
      <div className="relative flex min-h-[168px] flex-col justify-between gap-3">
        <div className="flex items-start justify-between gap-2">
          <span className={cn("rounded-full border px-2 py-0.5 text-[8px] font-semibold uppercase tracking-[0.12em]", tone.pill)}>
            {getPlatformLabel(platform)}
          </span>
          <div className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border", tone.icon)}>
            <Coins className="h-3.5 w-3.5" />
          </div>
        </div>

        <div>
          <h3 className="line-clamp-2 min-h-[2rem] text-sm font-black leading-tight text-white">{offer.title}</h3>
          <div className="mt-2">
            <div className="text-[8px] uppercase tracking-[0.14em] text-zinc-500">Цена</div>
            <div className="mt-0.5 text-base font-black text-white">{formatRubles(offer.priceKopecks)}</div>
          </div>
        </div>

        <StartCheckoutButton offerId={offer.id} platform={platform} className={cn("h-9 min-h-0 w-full rounded-xl px-3 text-xs font-bold", tone.button)}>
          <span className="flex items-center justify-center gap-1.5">
            Купить
            <ArrowRight className="h-3.5 w-3.5" />
          </span>
        </StartCheckoutButton>
      </div>
    </article>
  );
}

function OfferGrid({ offers, platform }: { offers: CoinsOffer[]; platform: CoinsPlatform }) {
  if (!offers.length) {
    return <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-6 text-sm text-zinc-500">Товары скоро появятся.</div>;
  }

  return (
    <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-3 xl:grid-cols-4">
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
      <Tabs defaultValue="android" className="rounded-3xl border border-white/10 bg-[linear-gradient(180deg,rgba(10,13,20,0.96),rgba(5,8,13,0.98))] p-4 shadow-[0_20px_70px_rgba(0,0,0,0.28)] sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500">Каталог</div>
            <h3 className="mt-2 text-2xl font-black text-white">Coins</h3>
          </div>

          <TabsList className="w-full overflow-x-auto p-1 sm:w-auto">
            <TabsTrigger value="android" className="min-w-[7rem] flex-1 sm:flex-none">Android</TabsTrigger>
            <TabsTrigger value="ios" className="min-w-[7rem] flex-1 sm:flex-none">iOS</TabsTrigger>
            <TabsTrigger value="promo" className="min-w-[7rem] flex-1 sm:flex-none">Акции</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="android">
          <OfferGrid offers={offersByPlatform.android} platform="android" />
        </TabsContent>

        <TabsContent value="ios">
          <OfferGrid offers={offersByPlatform.ios} platform="ios" />
        </TabsContent>

        <TabsContent value="promo" className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-amber-100">
            <Sparkles className="h-4 w-4" />
            Акции
          </div>
          <OfferGrid offers={offersByPlatform.promo} platform="promo" />
        </TabsContent>
      </Tabs>
    </section>
  );
}
