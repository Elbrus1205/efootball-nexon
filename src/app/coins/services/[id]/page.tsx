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
    <main className="page-shell space-y-4 pt-4 sm:pt-6 pb-10 sm:space-y-8 sm:pb-16">
      <section className="grid gap-3 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(9,12,18,0.98),rgba(11,16,24,0.94))] p-4 shadow-[0_22px_70px_rgba(0,0,0,0.26)] sm:rounded-[2rem] sm:p-8">
          <Button asChild variant="outline" className="h-10 min-h-0 rounded-xl border-white/15 bg-white/[0.04] px-3 text-xs hover:bg-white/[0.08] sm:h-11 sm:rounded-full sm:text-sm">
            <Link href="/coins/services">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Назад к услугам
            </Link>
          </Button>

          <div className="mt-4 flex items-start gap-3 sm:mt-6 sm:items-center sm:gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-300/20 bg-emerald-400/10 text-emerald-100 sm:h-14 sm:w-14 sm:rounded-[1.3rem]">
              <Gamepad2 className="h-5 w-5 sm:h-7 sm:w-7" />
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase text-zinc-500 sm:text-xs">Услуга</div>
              <h1 className="mt-1 text-[1.55rem] font-black leading-tight text-white sm:text-4xl">{product.title}</h1>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-3 sm:mt-6 sm:p-4">
            <div className="text-xs font-semibold text-zinc-500">Описание услуги</div>
            <p className="mt-2 text-[13px] leading-6 text-zinc-300 sm:text-sm sm:leading-7">{product.description}</p>
          </div>

          <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4 sm:mt-6 sm:rounded-[1.6rem] sm:p-5">
            <div className="text-[11px] font-semibold uppercase text-zinc-500 sm:text-xs">Стоимость</div>
            <div className="mt-2 text-3xl font-black text-emerald-300 sm:mt-3 sm:text-4xl">{formatKopecks(product.priceKopecks)}</div>
          </div>
        </div>

        <ServiceOrderForm
          productId={product.id}
          productTitle={product.title}
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
