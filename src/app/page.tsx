import Image from "next/image";
import Link from "next/link";
import type { CSSProperties } from "react";
import { ArrowRight, Medal, Send, ShoppingBag, Swords, Trophy, Users } from "lucide-react";
import { MatchStatus, TournamentStatus } from "@prisma/client";
import { AnimatedCounter } from "@/components/home/animated-counter";
import { db } from "@/lib/db";
import { getArchivedHomeStats } from "@/lib/home-stats";

const heroPhrases = [
  "Докажи, что ты лучший",
  "Войди в историю сезона",
  "Поднимись на вершину рейтинга",
  "Стань чемпионом Nexon",
  "Каждый матч имеет значение",
  "Покажи свой уровень",
  "Время стать легендой",
  "Играй против сильнейших",
  "Борись за первое место",
  "Создай своё наследие",
  "Стань номером один",
  "Завоюй место среди лучших",
];

const telegramHref = process.env.NEXT_PUBLIC_SUPPORT_TELEGRAM_URL ?? "https://t.me/efootball_nexon";
const marketHref = "https://t.me/eFootballNexonMarketBot";

export default async function HomePage() {
  const [totalUsers, completedTournaments, playedMatches, archivedHomeStats] = await Promise.all([
    db.user.count(),
    db.tournament.count({
      where: { status: TournamentStatus.COMPLETED, isTest: false },
    }),
    db.match.count({
      where: {
        status: MatchStatus.CONFIRMED,
        tournament: { isTest: false },
      },
    }),
    getArchivedHomeStats(),
  ]);

  const playersCount = Math.max(totalUsers + archivedHomeStats.users, 240);
  const tournamentsCount = completedTournaments + archivedHomeStats.tournaments;
  const matchesCount = playedMatches;
  const championsCount = Math.max(completedTournaments + archivedHomeStats.tournaments, 1);

  const stats = [
    { icon: Users, value: playersCount, suffix: "+", label: "игроков" },
    { icon: Trophy, value: tournamentsCount, suffix: "", label: "турниров проведено" },
    { icon: Swords, value: matchesCount, suffix: "", label: "сыграно матчей" },
    { icon: Medal, value: championsCount, suffix: "", label: "чемпионов проекта" },
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
        <div className="home-premium-grid" aria-hidden="true" />
        <div className="home-premium-rings" aria-hidden="true" />

        <div className="home-premium-content">
          <div className="home-premium-phrases" aria-label="Мотивационные фразы eFootball Nexon">
            {heroPhrases.map((phrase, index) => (
              <span
                key={phrase}
                className="home-premium-phrase"
                style={{ "--phrase-delay": `${index * 3.6}s` } as CSSProperties}
              >
                {phrase}
              </span>
            ))}
          </div>

          <h1 className="home-premium-title">eFootball Nexon</h1>
          <div className="home-premium-gold-line" />

          <div className="home-premium-actions" aria-label="Главные действия">
            <Link href="/tournaments" className="home-main-action">
              <Trophy className="h-5 w-5" />
              <span>Турниры</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href={telegramHref} target="_blank" rel="noreferrer" className="home-social-button">
              <Send className="h-4 w-4" />
              <span>Telegram</span>
            </Link>
            <Link href={marketHref} target="_blank" rel="noreferrer" className="home-social-button">
              <ShoppingBag className="h-4 w-4" />
              <span>Маркет</span>
            </Link>
          </div>
        </div>

        <div className="home-premium-lower">
          <div className="home-premium-stats" aria-label="Статистика платформы">
            {stats.map((stat, index) => (
              <div
                key={stat.label}
                className="home-premium-stat"
                style={{ "--stat-delay": `${0.8 + index * 0.12}s` } as CSSProperties}
              >
                <div className="home-stat-head">
                  <stat.icon className="h-4 w-4" />
                </div>
                <div className="home-stat-value">
                  <AnimatedCounter value={stat.value} />
                  {stat.suffix}
                </div>
                <div className="home-stat-label">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
