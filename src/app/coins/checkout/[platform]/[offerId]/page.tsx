import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft, Coins, Gift, Smartphone, WalletCards } from "lucide-react";
import { notFound } from "next/navigation";
import { CoinsCheckoutForm } from "@/components/coins/coins-checkout-form";
import { Button } from "@/components/ui/button";
import { getCurrentSession } from "@/lib/auth/session";
import { formatRubles, getCoinsOffer, getCoinsPlatformLabel, isCoinsPlatform } from "@/lib/coins-catalog";

type CoinsCheckoutPageProps = {
  params: {
    platform: string;
    offerId: string;
  };
};

export function generateMetadata({ params }: CoinsCheckoutPageProps): Metadata {
  if (!isCoinsPlatform(params.platform)) {
    return {
      title: "Оформление оплаты | eFootball Nexon",
    };
  }

  const offer = getCoinsOffer(params.platform, params.offerId);

  return {
    title: offer ? `${offer.title} | Оплата | eFootball Nexon` : "Оформление оплаты | eFootball Nexon",
    description: offer ? `Оформление оплаты для пакета ${offer.title}.` : "Оформление оплаты Coins.",
  };
}

export default async function CoinsCheckoutPage({ params }: CoinsCheckoutPageProps) {
  if (!isCoinsPlatform(params.platform)) {
    notFound();
  }

  const offer = getCoinsOffer(params.platform, params.offerId);

  if (!offer) {
    notFound();
  }

  const session = await getCurrentSession();
  const platformLabel = getCoinsPlatformLabel(params.platform);
  const priceLabel = formatRubles(offer.priceKopecks);
  const OfferIcon = offer.kind === "bundle" ? Gift : Coins;

  return (
    <main className="page-shell space-y-8 py-0 pb-12 sm:pb-16">
      <section className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(9,12,18,0.98),rgba(11,16,24,0.94))] p-6 shadow-[0_26px_90px_rgba(0,0,0,0.28)] sm:p-8">
          <Button asChild variant="outline" className="h-11 rounded-full border-white/15 bg-white/[0.04] hover:bg-white/[0.08]">
            <Link href="/coins">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Назад к донатам
            </Link>
          </Button>

          <div className="mt-6 flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-[1.3rem] border border-white/10 bg-white/[0.05] text-white">
              <OfferIcon className="h-7 w-7" />
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.28em] text-zinc-500">Checkout</div>
              <h1 className="mt-1 text-3xl font-black text-white sm:text-4xl">{offer.title}</h1>
            </div>
          </div>

          <div className="mt-6 rounded-[1.6rem] border border-white/10 bg-white/[0.04] p-5">
            <div className="text-xs uppercase tracking-[0.24em] text-zinc-500">Стоимость</div>
            <div className="mt-3 text-4xl font-black text-emerald-300">{priceLabel}</div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-[1.4rem] border border-white/10 bg-white/[0.04] p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/[0.06] text-zinc-200">
                  <Smartphone className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-xs uppercase tracking-[0.2em] text-zinc-500">Платформа</div>
                  <div className="mt-1 text-lg font-bold text-white">{platformLabel}</div>
                </div>
              </div>
            </div>

            <div className="rounded-[1.4rem] border border-white/10 bg-white/[0.04] p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/[0.06] text-zinc-200">
                  <WalletCards className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-xs uppercase tracking-[0.2em] text-zinc-500">Получите</div>
                  <div className="mt-1 text-lg font-bold text-white">{new Intl.NumberFormat("ru-RU").format(offer.coins)} Coins</div>
                </div>
              </div>
            </div>
          </div>

          {offer.bonus ? (
            <div className="mt-5 rounded-[1.4rem] border border-amber-300/20 bg-amber-300/10 p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-amber-100/80">Бонус набора</div>
              <div className="mt-2 text-base font-semibold text-white">{offer.bonus}</div>
            </div>
          ) : null}
        </div>

        <CoinsCheckoutForm
          offerTitle={offer.title}
          priceLabel={priceLabel}
          platformLabel={platformLabel}
          initialTelegram={session?.user.telegramUsername ? `@${session.user.telegramUsername}` : ""}
        />
      </section>
    </main>
  );
}
