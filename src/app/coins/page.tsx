import Link from "next/link";
import type { Metadata } from "next";
import { BadgePercent, Coins, MessageCircle, ShieldCheck, Smartphone } from "lucide-react";
import { CoinsShowcase } from "@/components/coins/coins-showcase";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Coins | eFootball Nexon",
  description: "Покупка Coins для eFootball Mobile: Android, iOS и акционные наборы в одном каталоге.",
};

const supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? "support@efootball-nexon.ru";
const telegramHref = process.env.NEXT_PUBLIC_SUPPORT_TELEGRAM_URL ?? "https://t.me/efootball_nexon";

const purchaseNotes = [
  {
    icon: Smartphone,
    title: "Отдельные цены по платформам",
    description: "Android и iOS разнесены по разным вкладкам, чтобы не смешивать прайс и быстро вести игрока к нужной покупке.",
  },
  {
    icon: BadgePercent,
    title: "Акции собраны отдельно",
    description: "Лимитированные монеты и наборы вынесены в отдельную категорию с единым прайсом для обеих платформ.",
  },
  {
    icon: ShieldCheck,
    title: "Покупка через поддержку",
    description: "Каждая карточка ведёт в Telegram с готовым сообщением. Это упрощает подтверждение ника, ID и нужного комплекта.",
  },
];

export default function CoinsPage() {
  return (
    <main className="page-shell space-y-8 py-0 pb-12 sm:space-y-10 sm:pb-16">
      <section className="relative overflow-hidden rounded-[2.4rem] border border-white/10 bg-[linear-gradient(135deg,rgba(3,16,31,0.98),rgba(7,11,18,0.96)_38%,rgba(24,14,6,0.96))] px-5 py-8 shadow-[0_30px_100px_rgba(0,0,0,0.34)] sm:px-8 sm:py-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.18),transparent_28%),radial-gradient(circle_at_85%_20%,rgba(251,191,36,0.16),transparent_22%)]" />
        <div className="absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:46px_46px]" />

        <div className="relative grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-400/10 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.26em] text-cyan-200">
              <Coins className="h-4 w-4" />
              Coins Market
            </div>
            <h1 className="mt-5 font-display text-4xl font-thin leading-tight text-white sm:text-5xl lg:text-6xl">
              Coins для eFootball Mobile без лишней путаницы
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-zinc-300 sm:text-base sm:leading-8">
              На одной странице собраны обычные пакеты для Android, отдельная категория для iOS и акционные предложения с одинаковой
              ценой для обеих платформ. Игрок выбирает набор и сразу отправляет заявку в Telegram.
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              <Button asChild size="lg" className="h-12 rounded-full bg-white text-black hover:bg-zinc-200">
                <Link href={telegramHref} target="_blank" rel="noreferrer">
                  <MessageCircle className="mr-2 h-4 w-4" />
                  Купить через Telegram
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="h-12 rounded-full border-white/15 bg-white/[0.04] hover:bg-white/[0.08]">
                <Link href="/contacts">Связаться с поддержкой</Link>
              </Button>
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-black/25 p-5 backdrop-blur-xl sm:p-6">
            <div className="text-xs font-semibold uppercase tracking-[0.28em] text-zinc-500">Важно</div>
            <div className="mt-4 space-y-3">
              {purchaseNotes.map((item) => (
                <div key={item.title} className="rounded-[1.4rem] border border-white/10 bg-white/[0.04] p-4">
                  <div className="flex gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/[0.06] text-cyan-200">
                      <item.icon className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="font-semibold text-white">{item.title}</div>
                      <p className="mt-1 text-sm leading-6 text-zinc-400">{item.description}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-5 rounded-[1.4rem] border border-amber-300/20 bg-amber-300/10 p-4 text-sm leading-6 text-amber-50/90">
              Если нужна ручная консультация по оплате или составу набора, пиши на <span className="font-semibold">{supportEmail}</span>{" "}
              или сразу в Telegram.
            </div>
          </div>
        </div>
      </section>

      <CoinsShowcase telegramHref={telegramHref} />
    </main>
  );
}
