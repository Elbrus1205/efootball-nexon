import Link from "next/link";
import { ArrowRight, ShieldCheck, Smartphone, Sparkles, Trophy } from "lucide-react";
import { TournamentStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/shared/reveal";

const features = [
  {
    icon: Trophy,
    title: "Турниры",
    description: "Сезонные события и быстрый вход в актуальные розыгрыши.",
  },
  {
    icon: Sparkles,
    title: "Турнирные сетки",
    description: "Single и double elimination в наглядной структуре.",
  },
  {
    icon: ShieldCheck,
    title: "Результаты матчей",
    description: "Подтверждённые итоги и прозрачное движение по сезонам.",
  },
  {
    icon: Smartphone,
    title: "Участие с телефона",
    description: "Ключевые действия доступны в мобильном формате без перегруза.",
  },
];

export default async function HomePage() {
  const tournamentsCount = await db.tournament.count({
    where: {
      status: { in: [TournamentStatus.REGISTRATION_OPEN, TournamentStatus.IN_PROGRESS] },
    },
  });

  return (
    <div className="page-shell space-y-16 py-0 sm:space-y-20">
      <section className="relative flex min-h-[calc(100svh-5rem)] items-center overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.18),transparent_28%),radial-gradient(circle_at_80%_20%,rgba(34,197,94,0.14),transparent_20%),linear-gradient(180deg,#05070b_0%,#08111c_48%,#05070b_100%)]" />
        <div className="absolute inset-0 -z-10 opacity-30 [background-image:linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] [background-size:52px_52px]" />
        <div className="neon-pitch absolute inset-x-[3%] bottom-[-14%] top-[8%] -z-10 hidden md:block">
          <div className="pitch-outline" />
          <div className="pitch-halfway" />
          <div className="pitch-center-circle" />
          <div className="pitch-penalty-top" />
          <div className="pitch-penalty-bottom" />
          <div className="pitch-goal-top" />
          <div className="pitch-goal-bottom" />
          <span className="pitch-light pitch-light-left" />
          <span className="pitch-light pitch-light-right" />
          <span className="pitch-light pitch-light-top" />
        </div>
        <div className="float-orb absolute -left-10 top-24 -z-10 h-36 w-36 rounded-full bg-primary/20 blur-3xl" />
        <div className="float-orb absolute bottom-16 right-0 -z-10 h-40 w-40 rounded-full bg-emerald-400/10 blur-3xl" />

        <div className="mx-auto flex w-full max-w-4xl flex-col items-center text-center">
          <div className="rounded-full border border-primary/20 bg-primary/10 px-4 py-2 text-[11px] font-medium uppercase tracking-[0.28em] text-blue-200">
            eFootball Mobile
          </div>
          <h1 className="mt-6 font-display text-5xl font-semibold tracking-[-0.06em] text-white sm:text-6xl lg:text-7xl">
            eFootball Nexon
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-zinc-300 sm:text-lg">
            Платформа турнирных сезонов по eFootball.
          </p>
          <Button
            asChild
            size="lg"
            className="mt-8 h-12 rounded-full bg-gradient-to-r from-primary via-blue-500 to-cyan-400 px-8 text-base text-white shadow-[0_0_30px_rgba(59,130,246,0.32)] transition hover:scale-[1.02] hover:shadow-[0_0_40px_rgba(59,130,246,0.45)]"
          >
            <Link href="/register">
              Принять участие
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>

          <div className="mt-10 text-xs uppercase tracking-[0.26em] text-zinc-500">
            {tournamentsCount > 0 ? `${tournamentsCount} активных турниров` : "новый сезон готовится"}
          </div>
        </div>
      </section>

      <Reveal>
        <section className="mx-auto max-w-3xl text-center">
          <div className="text-sm font-semibold uppercase tracking-[0.3em] text-primary">О платформе</div>
          <h2 className="mt-4 font-display text-3xl font-semibold text-white sm:text-4xl">Турнирная система без лишнего шума</h2>
          <p className="mt-4 text-base leading-7 text-zinc-400 sm:text-lg">
            eFootball Nexon объединяет матчи, сетки и подтверждение результатов в одном мобильном пространстве. Игрок быстро понимает статус сезона и ближайший следующий шаг.
          </p>
        </section>
      </Reveal>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {features.map((item, index) => (
          <Reveal key={item.title} delay={index * 90}>
            <div className="group rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-6 backdrop-blur-xl transition duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-[0_24px_60px_rgba(59,130,246,0.12)]">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 via-blue-500/20 to-emerald-400/10 text-primary shadow-[0_0_24px_rgba(59,130,246,0.16)] transition group-hover:scale-105">
                <item.icon className="h-5 w-5" />
              </div>
              <div className="mt-5 font-display text-xl font-semibold text-white">{item.title}</div>
              <p className="mt-2 text-sm leading-6 text-zinc-400">{item.description}</p>
            </div>
          </Reveal>
        ))}
      </section>

    </div>
  );
}
