import Link from "next/link";
import type { CSSProperties } from "react";
import { ArrowRight, ShieldCheck, Smartphone, Sparkles, Trophy } from "lucide-react";
import { TournamentStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/shared/reveal";
import { getCurrentSession } from "@/lib/auth/session";
import { getArchivedHomeStats, parsePrizePoolValue } from "@/lib/home-stats";

const features = [
  {
    icon: Trophy,
    title: "Турниры",
    description: "Сезонные события и быстрый доступ к актуальным розыгрышам.",
  },
  {
    icon: Sparkles,
    title: "Турнирные сетки",
    description: "Single и double elimination в понятной и наглядной структуре.",
  },
  {
    icon: ShieldCheck,
    title: "Результаты матчей",
    description: "Подтверждённые результаты и прозрачное движение по сезонам.",
  },
  {
    icon: Smartphone,
    title: "Участие с телефона",
    description: "Основные функции платформы доступны в мобильном формате.",
  },
];

export default async function HomePage() {
  const now = new Date();
  const session = await getCurrentSession();

  const [tournamentsCount, totalUsers, activeSessions, totalTournaments, prizePoolTournaments] = await db.$transaction([
    db.tournament.count({
      where: {
        status: { in: [TournamentStatus.REGISTRATION_OPEN, TournamentStatus.AWAITING_START, TournamentStatus.IN_PROGRESS] },
      },
    }),
    db.user.count(),
    db.session.findMany({
      where: { expires: { gt: now } },
      select: { userId: true },
      distinct: ["userId"],
    }),
    db.tournament.count(),
    db.tournament.findMany({
      where: { prizePool: { not: null } },
      select: { prizePool: true },
    }),
  ]);
  const archivedHomeStats = await getArchivedHomeStats();

  const totalPrizePool = prizePoolTournaments.reduce((sum, tournament) => {
    return sum + parsePrizePoolValue(tournament.prizePool);
  }, archivedHomeStats.prizePool);

  const highlights = [
    {
      value: activeSessions.length + archivedHomeStats.online,
      label: "сейчас онлайн",
    },
    {
      value: totalUsers + archivedHomeStats.users,
      label: "всего игроков",
    },
    {
      value: totalPrizePool > 0 ? `${new Intl.NumberFormat("ru-RU").format(totalPrizePool)} ₽` : "Скоро",
      label: "разыграно призов",
    },
    {
      value: totalTournaments + archivedHomeStats.tournaments,
      label: "проведено турниров",
    },
  ];

  const heroTitle = Array.from("eFootball Nexon");

  return (
    <div className="page-shell space-y-16 py-0 pb-12 sm:space-y-20 sm:pb-16">
      <section className="relative flex min-h-[calc(100svh-5rem)] items-center overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.18),transparent_28%),radial-gradient(circle_at_80%_20%,rgba(34,197,94,0.14),transparent_20%),linear-gradient(180deg,#05070b_0%,#08111c_48%,#05070b_100%)]" />
        <div className="absolute inset-0 -z-10 opacity-30 [background-image:linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] [background-size:52px_52px]" />
        <div className="float-orb absolute -left-10 top-24 -z-10 h-36 w-36 rounded-full bg-primary/20 blur-3xl" />
        <div className="float-orb absolute bottom-16 right-0 -z-10 h-40 w-40 rounded-full bg-emerald-400/10 blur-3xl" />

        <div className="mx-auto flex w-full max-w-4xl flex-col items-center text-center">
          <div className="hero-label rounded-full border border-primary/20 bg-primary/10 px-4 py-2 text-[11px] font-medium uppercase tracking-[0.28em] text-blue-200">
            eFootball Mobile
          </div>
          <h1 className="hero-title mt-6 font-display text-4xl font-thin tracking-[0.02em] text-white sm:text-5xl lg:text-6xl" aria-label="eFootball Nexon">
            <span className="sr-only">eFootball Nexon</span>
            <span aria-hidden="true">
              {heroTitle.map((char, index) => (
                <span
                  key={`${char}-${index}`}
                  className="hero-char"
                  style={{ animationDelay: `${0.35 + index * 0.045}s` } as CSSProperties}
                >
                  {char === " " ? "\u00A0" : char}
                </span>
              ))}
            </span>
          </h1>
          <p className="hero-subtitle mt-4 max-w-2xl text-sm leading-7 text-zinc-300 sm:text-base">
            Платформа турнирных сезонов по eFootball.
          </p>
          <Button
            asChild
            size="lg"
            className="hero-cta mt-8 h-12 rounded-full bg-gradient-to-r from-primary via-blue-500 to-cyan-400 px-8 text-base text-white shadow-[0_0_30px_rgba(59,130,246,0.32)] transition hover:scale-[1.02] hover:shadow-[0_0_40px_rgba(59,130,246,0.45)]"
          >
            <Link href={session?.user ? "/tournaments" : "/register"}>
              Принять участие
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>

          <div className="hero-kicker mt-10 text-xs uppercase tracking-[0.26em] text-zinc-500">
            {tournamentsCount > 0 ? `${tournamentsCount} активных турниров` : "новый сезон готовится"}
          </div>

          <div className="mt-7 grid w-full max-w-5xl grid-cols-2 gap-2 sm:mt-8 sm:gap-3 lg:grid-cols-4">
            {highlights.map((item, index) => (
              <div
                key={item.label}
                className="rounded-[1.15rem] border border-white/10 bg-white/[0.05] px-3 py-3 text-center backdrop-blur-xl transition duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-[0_18px_40px_rgba(59,130,246,0.14)] sm:rounded-[1.5rem] sm:px-4 sm:py-4"
                style={{ animationDelay: `${index * 80}ms` }}
              >
                <div className="text-lg font-semibold tracking-tight text-white sm:text-3xl">{item.value}</div>
                <div className="mt-1.5 text-[8px] uppercase tracking-[0.14em] text-zinc-400 sm:mt-2 sm:text-[11px] sm:tracking-[0.2em]">
                  {item.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(9,15,27,0.96),rgba(5,8,14,0.98))] px-3 py-5 shadow-[0_24px_80px_rgba(0,0,0,0.34)] sm:rounded-[1.75rem] sm:px-6 sm:py-8 lg:px-8 lg:py-10">
        <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-sky-300/50 to-transparent" />
        <div className="pointer-events-none absolute -right-24 -top-24 h-56 w-56 rounded-full bg-sky-400/10 blur-3xl" />
        <div className="pointer-events-none absolute -left-24 bottom-0 h-48 w-48 rounded-full bg-blue-500/10 blur-3xl" />

        <Reveal>
          <div className="relative mx-auto max-w-3xl text-center">
            <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-sky-300 sm:text-xs sm:tracking-[0.3em]">О платформе</div>
            <h2 className="mt-3 font-display text-2xl font-thin leading-tight text-white sm:mt-4 sm:text-4xl lg:text-5xl">
              Турнирная система для eFootball Mobile
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-zinc-300 sm:mt-4 sm:text-base sm:leading-7">
              Платформа объединяет турниры, сетки, результаты матчей и сезонное продвижение в одном пространстве. Участники получают быстрый доступ ко всем этапам соревнований с мобильного устройства.
            </p>
          </div>
        </Reveal>

        <div className="relative mx-auto mt-5 grid max-w-[22rem] gap-3 sm:mt-7 sm:max-w-none sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
          {features.map((item, index) => (
            <Reveal key={item.title} delay={index * 90}>
              <div className="group flex h-full min-h-[150px] flex-col rounded-2xl border border-white/10 bg-white/[0.035] p-4 backdrop-blur-xl transition duration-300 hover:-translate-y-1 hover:border-sky-300/35 hover:bg-white/[0.055] hover:shadow-[0_20px_50px_rgba(56,189,248,0.12)] sm:min-h-[170px] sm:p-5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-sky-300/20 bg-sky-400/10 text-sky-200 shadow-[0_0_24px_rgba(56,189,248,0.12)] transition group-hover:scale-105 group-hover:bg-sky-400/15 sm:h-11 sm:w-11">
                  <item.icon className="h-4 w-4 sm:h-5 sm:w-5" />
                </div>
                <div className="mt-4 font-display text-lg font-thin leading-tight text-white sm:text-xl">{item.title}</div>
                <p className="mt-2 flex-1 text-sm leading-6 text-zinc-400 sm:text-[15px]">{item.description}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

    </div>
  );
}
