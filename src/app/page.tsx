import Image from "next/image";
import Link from "next/link";
import type { CSSProperties } from "react";
import { ArrowRight, CircleDollarSign, RadioTower, Send, Trophy, Users } from "lucide-react";
import { TournamentStatus } from "@prisma/client";
import { AnimatedCounter } from "@/components/home/animated-counter";
import { getCurrentSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { getArchivedHomeStats, parsePrizePoolValue } from "@/lib/home-stats";

const heroPhrases = [
  "Докажи, что ты лучший",
  "Покажи свой уровень",
  "Участвуй в турнирах eFootball",
  "Выигрывай титулы и достижения",
  "Стань частью eFootball Nexon",
];

const telegramHref = process.env.NEXT_PUBLIC_SUPPORT_TELEGRAM_URL ?? "https://t.me/efootball_nexon";
const vkHref = process.env.NEXT_PUBLIC_SUPPORT_VK_URL ?? "https://vk.com/efootball_nexon";

function formatPrize(value: number) {
  return value > 0 ? `${new Intl.NumberFormat("ru-RU").format(value)} ₽` : "SOON";
}

export default async function HomePage() {
  const session = await getCurrentSession();
  const onlineSince = new Date(Date.now() - 15 * 60 * 1000);

  const [onlineSessions, totalUsers, completedTournaments, prizePoolTournaments] = await db.$transaction([
    db.securitySession.findMany({
      where: {
        revokedAt: null,
        lastActiveAt: { gte: onlineSince },
      },
      distinct: ["userId"],
      select: { userId: true },
    }),
    db.user.count(),
    db.tournament.count({
      where: { status: TournamentStatus.COMPLETED, isTest: false },
    }),
    db.tournament.findMany({
      where: { prizePool: { not: null }, isTest: false },
      select: { prizePool: true },
    }),
  ]);

  const archivedHomeStats = await getArchivedHomeStats();
  const totalPrizePool = prizePoolTournaments.reduce((sum, tournament) => {
    return sum + parsePrizePoolValue(tournament.prizePool);
  }, archivedHomeStats.prizePool);

  const stats = [
    { icon: RadioTower, value: onlineSessions.length, text: null, label: "игроков онлайн", meta: "live now" },
    { icon: Users, value: totalUsers + archivedHomeStats.users, text: null, label: "игроков зарегистрировано", meta: "community" },
    { icon: Trophy, value: completedTournaments + archivedHomeStats.tournaments, text: null, label: "турниров сыграно", meta: "official seasons" },
    { icon: CircleDollarSign, value: null, text: formatPrize(totalPrizePool), label: "призов разыграно", meta: "awarded" },
  ];

  return (
    <main className="home-premium -mt-16 min-h-screen overflow-hidden sm:-mt-[72px] lg:-mt-20">
      <div className="home-premium-bg" aria-hidden="true">
        <Image
          src="/images-site/home-hero-football-bg.png"
          alt=""
          fill
          priority
          sizes="100vw"
          className="home-premium-bg-image"
        />
        <div className="home-premium-bg-grade" />
        <div className="home-premium-depth home-premium-depth-left" />
        <div className="home-premium-depth home-premium-depth-right" />
      </div>

      <section className="home-premium-stage">
        <div className="home-premium-loader" aria-hidden="true" />
        <div className="home-premium-grid" aria-hidden="true" />
        <div className="home-premium-rings" aria-hidden="true" />

        <div className="home-premium-content">
          <div className="home-premium-phrases" aria-label="Платформа eFootball Nexon">
            {heroPhrases.map((phrase, index) => (
              <span
                key={phrase}
                className="home-premium-phrase"
                style={{ "--phrase-delay": `${index * 4.4}s` } as CSSProperties}
              >
                {phrase}
              </span>
            ))}
          </div>

          <h1 className="home-premium-title">eFootball Nexon</h1>
          <div className="home-premium-gold-line" />
          <p className="home-premium-subtitle">Профессиональная платформа турнирных сезонов eFootball Mobile</p>

          <div className="home-premium-actions">
            <Link href={telegramHref} target="_blank" rel="noreferrer" className="home-social-button">
              <Send className="h-4 w-4" />
              <span>Telegram</span>
            </Link>
            <Link href={vkHref} target="_blank" rel="noreferrer" className="home-social-button">
              <span className="home-vk-mark">VK</span>
              <span>ВКонтакте</span>
            </Link>
            <Link href={session?.user ? "/tournaments" : "/register"} className="home-main-action">
              <span>{session?.user ? "Перейти к турнирам" : "Начать сезон"}</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        <div className="home-premium-stats" aria-label="Статистика платформы">
          {stats.map((stat, index) => (
            <div
              key={stat.label}
              className="home-premium-stat"
              style={{ "--stat-delay": `${0.9 + index * 0.13}s` } as CSSProperties}
            >
              <div className="home-stat-head">
                <stat.icon className="h-4 w-4" />
                <span>{stat.meta}</span>
              </div>
              <div className="home-stat-value">
                {stat.value !== null ? <AnimatedCounter value={stat.value} /> : stat.text}
              </div>
              <div className="home-stat-label">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
