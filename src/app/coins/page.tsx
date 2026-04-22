import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft, Clock3, Coins, ShieldEllipsis, WalletCards } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Coins | eFootball Nexon",
  description: "Раздел Coins находится в разработке.",
};

const upcomingSections = [
  {
    icon: Coins,
    title: "Баланс и начисления",
    description: "Прозрачный учёт наград, бонусов и сезонных пополнений.",
  },
  {
    icon: WalletCards,
    title: "История операций",
    description: "Понятный журнал движений, чтобы каждый перевод был на виду.",
  },
  {
    icon: ShieldEllipsis,
    title: "Правила и защита",
    description: "Контроль лимитов, статусов и безопасной работы с разделом.",
  },
];

export default function CoinsPage() {
  return (
    <div className="page-shell py-0">
      <section className="relative flex min-h-[calc(100svh-10rem)] items-center overflow-hidden py-10 sm:py-14">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(244,244,245,0.11),transparent_24%),radial-gradient(circle_at_85%_18%,rgba(161,161,170,0.12),transparent_18%),linear-gradient(180deg,#08090c_0%,#121418_48%,#090a0d_100%)]" />
        <div className="absolute inset-0 -z-10 opacity-30 [background-image:linear-gradient(rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:42px_42px]" />
        <div className="absolute left-1/2 top-16 -z-10 h-44 w-44 -translate-x-1/2 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute bottom-10 right-0 -z-10 h-36 w-36 rounded-full bg-zinc-400/10 blur-3xl" />

        <div className="mx-auto w-full max-w-5xl">
          <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.09),rgba(255,255,255,0.04))] shadow-[0_30px_80px_rgba(0,0,0,0.38)] backdrop-blur-xl">
            <div className="border-b border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02))] px-5 py-4 sm:px-8 sm:py-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-zinc-300">
                  <Clock3 className="h-3.5 w-3.5" />
                  Раздел в разработке
                </div>
                <div className="rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-xs font-medium text-zinc-400">
                  Обновление появится позже
                </div>
              </div>
            </div>

            <div className="grid gap-8 px-5 py-8 sm:px-8 sm:py-10 lg:grid-cols-[1.2fr_0.8fr] lg:gap-10">
              <div className="max-w-2xl">
                <div className="inline-flex h-16 w-16 items-center justify-center rounded-[1.6rem] border border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.12),rgba(255,255,255,0.04))] text-zinc-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]">
                  <Coins className="h-8 w-8" />
                </div>

                <h1 className="mt-6 font-display text-4xl font-thin tracking-[0.02em] text-white sm:text-5xl">
                  Coins скоро появятся
                </h1>
                <p className="mt-4 max-w-xl text-sm leading-7 text-zinc-300 sm:text-base">
                  Страница уже подготовлена, но сам раздел ещё дорабатывается. Здесь будет аккуратная система Coins с понятным
                  интерфейсом, историей операций и прозрачной логикой начислений.
                </p>

                <div className="mt-7 flex flex-wrap gap-3">
                  <Button asChild className="h-11 rounded-full bg-white text-black hover:bg-zinc-200">
                    <Link href="/tournaments">Перейти к турнирам</Link>
                  </Button>
                  <Button asChild variant="outline" className="h-11 rounded-full border-white/15 bg-white/[0.03] text-white hover:bg-white/[0.08]">
                    <Link href="/">
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      На главную
                    </Link>
                  </Button>
                </div>
              </div>

              <div className="rounded-[1.75rem] border border-white/10 bg-black/20 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] sm:p-5">
                <div className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500">Что готовится</div>
                <div className="mt-4 space-y-3">
                  {upcomingSections.map((item) => (
                    <div
                      key={item.title}
                      className="rounded-[1.4rem] border border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] p-4"
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] text-zinc-200">
                          <item.icon className="h-5 w-5" />
                        </div>
                        <div>
                          <div className="font-medium text-white">{item.title}</div>
                          <div className="mt-1 text-sm leading-6 text-zinc-400">{item.description}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="border-t border-white/10 px-5 py-4 text-sm text-zinc-500 sm:px-8">
              Пока что раздел закрыт для использования. Как только Coins будут готовы, экран заглушки заменится на рабочий интерфейс.
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
