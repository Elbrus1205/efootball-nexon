import Image from "next/image";
import Link from "next/link";
import type { CSSProperties } from "react";
import { ArrowRight, Gauge, RadioTower, ShieldCheck, Trophy } from "lucide-react";
import { TournamentStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { getCurrentSession } from "@/lib/auth/session";
import { getArchivedHomeStats, parsePrizePoolValue } from "@/lib/home-stats";
import { AnimatedCounter } from "@/components/home/animated-counter";

const heroTitle = Array.from("eFootball Nexon");

export default async function HomePage() {
  const session = await getCurrentSession();

  const [activeTournaments, totalUsers, totalTournaments, prizePoolTournaments] = await db.$transaction([
    db.tournament.count({
      where: {
        status: { in: [TournamentStatus.REGISTRATION_OPEN, TournamentStatus.AWAITING_START, TournamentStatus.IN_PROGRESS] },
      },
    }),
    db.user.count(),
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

  const registeredPlayers = totalUsers + archivedHomeStats.users;
  const officialTournaments = totalTournaments + archivedHomeStats.tournaments;
  const prizeLabel = totalPrizePool > 0
    ? `${new Intl.NumberFormat("en-US").format(totalPrizePool)} ₽`
    : "SOON";

  const stats = [
    { icon: ShieldCheck, value: registeredPlayers, text: null, label: "REGISTERED PLAYERS" },
    { icon: Trophy, value: null, text: prizeLabel, label: "PRIZE POOL" },
    { icon: RadioTower, value: officialTournaments, text: null, label: "OFFICIAL TOURNAMENTS" },
    { icon: Gauge, value: null, text: activeTournaments > 0 ? "ACTIVE" : "STANDBY", label: "ACTIVE SEASON" },
  ];

  return (
    <div className="cinematic-home -mt-16 min-h-screen overflow-hidden sm:-mt-[72px] lg:-mt-20">
      <section className="relative mx-auto flex min-h-[100svh] w-full max-w-[480px] flex-col px-5 pb-8 pt-24 sm:px-7 sm:pt-28">
        <div className="carbon-backdrop" />
        <div className="studio-shadow studio-shadow-left" />
        <div className="studio-shadow studio-shadow-right" />
        <div className="cinematic-fog" />
        <div className="cinematic-grain" />
        <div className="gold-particle-field" />
        <div className="hud-depth-lines" />

        <div className="brand-monolith" aria-hidden="true">
          <Image
            src="/images-site/IMG_6086.PNG"
            alt=""
            width={780}
            height={780}
            priority
            className="brand-monolith-image"
          />
        </div>

        <div className="relative z-10 flex flex-1 flex-col justify-center">
          <div className="cinematic-hero-copy">
            <div className="hero-system-label">GLOBAL MOBILE CHAMPIONSHIP</div>

            <h1 className="cinematic-title" aria-label="eFootball Nexon">
              <span className="sr-only">eFootball Nexon</span>
              <span aria-hidden="true">
                {heroTitle.map((char, index) => (
                  <span
                    key={`${char}-${index}`}
                    className="cinematic-title-char"
                    style={{ animationDelay: `${0.32 + index * 0.045}s` } as CSSProperties}
                  >
                    {char === " " ? "\u00a0" : char}
                  </span>
                ))}
              </span>
            </h1>

            <p className="cinematic-subtitle">
              Professional tournament platform for competitive eFootball seasons
            </p>

            <Link
              href={session?.user ? "/tournaments" : "/register"}
              className="cinematic-cta group"
            >
              <span>ENTER TOURNAMENT</span>
              <span className="cinematic-cta-icon">
                <ArrowRight className="h-4 w-4" />
              </span>
            </Link>
          </div>

          <div className="cinematic-stats" aria-label="Platform statistics">
            {stats.map((stat, index) => (
              <div
                key={stat.label}
                className="cinematic-stat-card"
                style={{ "--stat-delay": `${1.38 + index * 0.16}s` } as CSSProperties}
              >
                <div className="stat-card-portal" />
                <div className="stat-card-particles" />
                <div className="flex items-start justify-between gap-3">
                  <stat.icon className="mt-1 h-4 w-4 text-[#b9944f]" strokeWidth={1.7} />
                  <div className="stat-card-index">0{index + 1}</div>
                </div>
                <div className="mt-5 text-[1.7rem] font-bold leading-none tracking-[0.01em] text-white">
                  {stat.value !== null ? <AnimatedCounter value={stat.value} /> : stat.text}
                </div>
                <div className="mt-2 text-[0.58rem] font-bold uppercase tracking-[0.24em] text-zinc-500">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
