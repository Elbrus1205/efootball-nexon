import Link from "next/link";
import type { CSSProperties } from "react";
import { ArrowRight, ShieldCheck, Smartphone, Sparkles, Trophy } from "lucide-react";
import { TournamentStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { Reveal } from "@/components/shared/reveal";
import { getCurrentSession } from "@/lib/auth/session";
import { getArchivedHomeStats, parsePrizePoolValue } from "@/lib/home-stats";
import { AnimatedCounter } from "@/components/home/animated-counter";

const features = [
  {
    icon: Trophy,
    title: "Турниры",
    description: "Сезонные события и быстрый доступ к актуальным розыгрышам.",
    iconBg: "bg-sky-400/10",
    iconBorder: "border-sky-300/20",
    iconText: "text-sky-200",
    iconGlow: "shadow-[0_0_28px_rgba(56,189,248,0.22)]",
  },
  {
    icon: Sparkles,
    title: "Турнирные сетки",
    description: "Single и double elimination в понятной и наглядной структуре.",
    iconBg: "bg-violet-400/10",
    iconBorder: "border-violet-300/20",
    iconText: "text-violet-200",
    iconGlow: "shadow-[0_0_28px_rgba(139,92,246,0.22)]",
  },
  {
    icon: ShieldCheck,
    title: "Результаты матчей",
    description: "Подтверждённые результаты и прозрачное движение по сезонам.",
    iconBg: "bg-emerald-400/10",
    iconBorder: "border-emerald-300/20",
    iconText: "text-emerald-200",
    iconGlow: "shadow-[0_0_28px_rgba(52,211,153,0.22)]",
  },
  {
    icon: Smartphone,
    title: "Участие с телефона",
    description: "Основные функции платформы доступны в мобильном формате.",
    iconBg: "bg-blue-400/10",
    iconBorder: "border-blue-300/20",
    iconText: "text-blue-200",
    iconGlow: "shadow-[0_0_28px_rgba(96,165,250,0.22)]",
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

  const onlineCount = activeSessions.length + archivedHomeStats.online;
  const usersCount = totalUsers + archivedHomeStats.users;
  const tournamentsTotal = totalTournaments + archivedHomeStats.tournaments;
  const prizeLabel = totalPrizePool > 0
    ? `${new Intl.NumberFormat("ru-RU").format(totalPrizePool)} ₽`
    : "Скоро";

  const highlights = [
    { numericValue: onlineCount, stringValue: null, label: "сейчас онлайн" },
    { numericValue: usersCount, stringValue: null, label: "всего игроков" },
    { numericValue: null, stringValue: prizeLabel, label: "разыграно призов" },
    { numericValue: tournamentsTotal, stringValue: null, label: "проведено турниров" },
  ];

  const heroTitle = Array.from("eFootball Nexon");

  return (
    <div className="page-shell space-y-0 py-0 pb-16">

      {/* ── HERO SECTION ── */}
      <section className="relative flex min-h-[calc(100svh-4rem)] items-center overflow-hidden">

        {/* Deep atmospheric background */}
        <div className="absolute inset-0 -z-20 bg-[radial-gradient(ellipse_80%_55%_at_50%_-15%,rgba(59,130,246,0.24),transparent),radial-gradient(ellipse_55%_40%_at_85%_20%,rgba(99,102,241,0.12),transparent),radial-gradient(ellipse_45%_35%_at_15%_80%,rgba(34,197,94,0.07),transparent),linear-gradient(180deg,#020710_0%,#050e1d_55%,#020710_100%)]" />

        {/* Animated grid */}
        <div className="hero-grid absolute inset-0 -z-10" />

        {/* Subtle scanlines */}
        <div className="hero-scanlines absolute inset-0 -z-10 opacity-40" />

        {/* Top atmospheric glow line */}
        <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-px bg-gradient-to-r from-transparent via-sky-400/55 to-transparent" />

        {/* Large floating orbs */}
        <div
          className="float-orb pointer-events-none absolute -left-20 top-16 -z-10 h-72 w-72 rounded-full bg-primary/12 blur-[90px]"
        />
        <div
          className="float-orb pointer-events-none absolute -right-20 bottom-16 -z-10 h-80 w-80 rounded-full bg-violet-500/10 blur-[100px]"
          style={{ animationDelay: "-4.5s" } as CSSProperties}
        />
        <div
          className="float-orb pointer-events-none absolute left-1/2 top-1/3 -z-10 h-56 w-56 -translate-x-1/2 rounded-full bg-cyan-400/7 blur-[80px]"
          style={{ animationDelay: "-7.2s" } as CSSProperties}
        />

        {/* Floating micro-particles */}
        <div className="hero-particle hero-particle-1 absolute left-[7%] top-[20%] -z-10 h-1 w-1 rounded-full bg-sky-300/70" />
        <div className="hero-particle hero-particle-2 absolute left-[20%] top-[68%] -z-10 h-1.5 w-1.5 rounded-full bg-blue-400/55" />
        <div className="hero-particle hero-particle-3 absolute right-[10%] top-[28%] -z-10 h-1 w-1 rounded-full bg-cyan-300/60" />
        <div className="hero-particle hero-particle-4 absolute right-[26%] top-[74%] -z-10 h-2 w-2 rounded-full bg-violet-400/45" />
        <div className="hero-particle hero-particle-5 absolute left-[48%] top-[13%] -z-10 h-1 w-1 rounded-full bg-sky-400/70" />
        <div className="hero-particle hero-particle-6 absolute right-[16%] bottom-[26%] -z-10 h-1.5 w-1.5 rounded-full bg-blue-300/50" />

        <div className="mx-auto flex w-full max-w-4xl flex-col items-center text-center">

          {/* Live status badge */}
          <div className="hero-label flex items-center gap-2.5 rounded-full border border-sky-300/22 bg-sky-400/[0.07] px-5 py-2 backdrop-blur-xl">
            {tournamentsCount > 0 ? (
              <>
                <span className="live-dot" />
                <span className="text-[10px] font-semibold uppercase tracking-[0.28em] text-sky-200">
                  {tournamentsCount} {tournamentsCount === 1 ? "активный турнир" : "активных турнира"}
                </span>
              </>
            ) : (
              <span className="text-[10px] font-semibold uppercase tracking-[0.28em] text-sky-200/75">
                eFootball Mobile
              </span>
            )}
          </div>

          {/* Main title — staggered character animation */}
          <h1
            className="hero-title mt-6 font-display text-5xl font-thin tracking-[0.02em] text-white sm:text-6xl lg:text-7xl"
            aria-label="eFootball Nexon"
          >
            <span className="sr-only">eFootball Nexon</span>
            <span aria-hidden="true">
              {heroTitle.map((char, index) => (
                <span
                  key={`${char}-${index}`}
                  className="hero-char"
                  style={{ animationDelay: `${0.28 + index * 0.042}s` } as CSSProperties}
                >
                  {char === " " ? " " : char}
                </span>
              ))}
            </span>
          </h1>

          {/* Subtitle */}
          <p className="hero-subtitle mt-5 max-w-xs text-sm leading-7 text-zinc-300/85 sm:max-w-sm sm:text-[15px]">
            Платформа турнирных сезонов по&nbsp;eFootball.
          </p>

          {/* Premium CTA */}
          <div className="hero-cta mt-8">
            <Link
              href={session?.user ? "/tournaments" : "/register"}
              className="cta-premium group inline-flex h-14 items-center gap-3 rounded-full bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-400 px-9 text-[15px] font-bold tracking-wide text-white"
            >
              Принять участие
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20 transition-all duration-300 group-hover:bg-white/30 group-hover:translate-x-0.5">
                <ArrowRight className="h-4 w-4" />
              </span>
            </Link>
          </div>

          {/* Stats grid */}
          <div className="hero-kicker mt-10 w-full max-w-[360px] sm:max-w-xl">
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              {highlights.map((item, index) => (
                <Reveal key={item.label} delay={index * 75}>
                  <div className="stat-card-glass rounded-2xl px-4 py-4 text-center sm:rounded-[1.35rem] sm:px-5 sm:py-5">
                    <div className="stat-value-gradient text-2xl font-bold tracking-tight sm:text-3xl">
                      {item.numericValue !== null ? (
                        <AnimatedCounter value={item.numericValue} />
                      ) : (
                        item.stringValue
                      )}
                    </div>
                    <div className="mt-2 text-[9px] font-semibold uppercase tracking-[0.18em] text-zinc-400 sm:text-[10px] sm:tracking-[0.22em]">
                      {item.label}
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── NEON DIVIDER ── */}
      <div className="neon-divider -mx-4 sm:-mx-6 lg:-mx-8" />

      {/* ── FEATURES SECTION ── */}
      <section className="relative overflow-hidden pt-12 pb-4 sm:pt-16 sm:pb-6">

        {/* Section atmospheric glow */}
        <div className="pointer-events-none absolute -right-40 top-8 h-80 w-80 rounded-full bg-sky-400/6 blur-[100px]" />
        <div className="pointer-events-none absolute -left-40 bottom-8 h-72 w-72 rounded-full bg-violet-500/7 blur-[90px]" />

        <Reveal>
          <div className="mx-auto max-w-3xl text-center">
            <span className="section-badge">О платформе</span>
            <h2 className="mt-4 font-display text-2xl font-thin leading-tight text-white sm:text-[2.25rem] sm:leading-snug">
              Турнирная система для eFootball Mobile
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-zinc-400 sm:text-[15px] sm:leading-[1.75]">
              Платформа объединяет турниры, сетки, результаты матчей и сезонное продвижение в&nbsp;одном пространстве. Участники получают быстрый доступ ко&nbsp;всем этапам с мобильного устройства.
            </p>
          </div>
        </Reveal>

        <div className="mt-8 grid grid-cols-1 gap-3 sm:mt-10 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
          {features.map((item, index) => (
            <Reveal key={item.title} delay={index * 85}>
              <div className="feature-card-premium group flex h-full min-h-[155px] flex-col rounded-2xl p-5 sm:min-h-[172px]">
                <div
                  className={`icon-box-neon flex h-11 w-11 items-center justify-center rounded-2xl border ${item.iconBorder} ${item.iconBg} ${item.iconText} ${item.iconGlow}`}
                >
                  <item.icon className="h-5 w-5" />
                </div>
                <div className="mt-4 font-display text-[17px] font-thin leading-tight text-white">
                  {item.title}
                </div>
                <p className="mt-2 flex-1 text-[13px] leading-6 text-zinc-400">
                  {item.description}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

    </div>
  );
}
