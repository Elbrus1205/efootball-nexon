import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft, Gamepad2 } from "lucide-react";
import { notFound } from "next/navigation";
import { ServiceOrderForm } from "@/components/coins/service-order-form";
import { Button } from "@/components/ui/button";
import { getCurrentSession } from "@/lib/auth/session";
import { formatKopecks, getCoinStoreSettings } from "@/lib/coin-services";
import { db } from "@/lib/db";

type ServicePageProps = {
  params: { id: string };
  searchParams?: { error?: string };
};

export async function generateMetadata({ params }: ServicePageProps): Promise<Metadata> {
  const product = await db.coinServiceProduct.findFirst({
    where: { id: params.id, isActive: true },
    select: { title: true, description: true },
  });

  return {
    title: product ? `${product.title} | Coins | eFootball Nexon` : "Услуга | Coins | eFootball Nexon",
    description: product?.description ?? "Оформление услуги eFootball.",
  };
}

export default async function CoinServicePage({ params, searchParams }: ServicePageProps) {
  const [settings, product, session, paymentCards] = await Promise.all([
    getCoinStoreSettings(),
    db.coinServiceProduct.findFirst({
      where: { id: params.id, isActive: true },
    }),
    getCurrentSession(),
    db.coinPaymentCard.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    }),
  ]);

  if (!product || !settings.servicesStoreEnabled) {
    notFound();
  }

  const selectedPaymentCard = paymentCards.length ? paymentCards[Math.floor(Math.random() * paymentCards.length)] : null;

  return (
    <main className="page-shell space-y-8 py-0 pb-12 sm:pb-16">
      <section className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(9,12,18,0.98),rgba(11,16,24,0.94))] p-6 shadow-[0_26px_90px_rgba(0,0,0,0.28)] sm:p-8">
          <Button asChild variant="outline" className="h-11 rounded-full border-white/15 bg-white/[0.04] hover:bg-white/[0.08]">
            <Link href="/coins">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Назад к магазину
            </Link>
          </Button>

          <div className="mt-6 flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-[1.3rem] border border-emerald-300/20 bg-emerald-400/10 text-emerald-100">
              <Gamepad2 className="h-7 w-7" />
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.28em] text-zinc-500">Услуга</div>
              <h1 className="mt-1 text-3xl font-black text-white sm:text-4xl">{product.title}</h1>
            </div>
          </div>

          <p className="mt-6 text-sm leading-7 text-zinc-300">{product.description}</p>

          <div className="mt-6 rounded-[1.6rem] border border-white/10 bg-white/[0.04] p-5">
            <div className="text-xs uppercase tracking-[0.24em] text-zinc-500">Стоимость</div>
            <div className="mt-3 text-4xl font-black text-emerald-300">{formatKopecks(product.priceKopecks)}</div>
          </div>
        </div>

        <ServiceOrderForm
          productId={product.id}
          productTitle={product.title}
          priceKopecks={product.priceKopecks}
          paymentCardId={selectedPaymentCard?.id}
          paymentBank={selectedPaymentCard?.bank}
          paymentCard={selectedPaymentCard?.cardNumber ?? ""}
          paymentRecipient={selectedPaymentCard?.recipient ?? ""}
          paymentComment={settings.paymentComment}
          initialTelegram={session?.user.telegramUsername ? `@${session.user.telegramUsername}` : ""}
          error={searchParams?.error}
        />
      </section>
    </main>
  );
}
