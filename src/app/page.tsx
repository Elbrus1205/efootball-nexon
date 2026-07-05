import Link from "next/link";
import type { CSSProperties } from "react";
import { unstable_cache } from "next/cache";
import { ArrowRight, BarChart3, ClipboardCheck, Layers, Medal, Radio, Send, ShieldCheck, ShoppingBag, Swords, Trophy, Users, Zap } from "lucide-react";
import { MatchStatus, TournamentStatus } from "@prisma/client";
import { AnimatedCounter } from "@/components/home/animated-counter";
import { Reveal } from "@/components/shared/reveal";
import { db } from "@/lib/db";
import { getArchivedHomeStats, parsePrizePoolValue } from "@/lib/home-stats";
import styles from "./home.module.css";

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

const getHomeStats = unstable_cache(
  async () => {
    const [totalUsers, completedTournaments, playedMatches, completedTournamentPrizes, archivedHomeStats] = await Promise.all([
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
      db.tournament.findMany({
        where: { status: TournamentStatus.COMPLETED, isTest: false },
        select: { prizePool: true },
      }),
      getArchivedHomeStats(),
    ]);

    const playersCount = Math.max(totalUsers + archivedHomeStats.users, 240);
    const tournamentsCount = completedTournaments + archivedHomeStats.tournaments;
    const matchesCount = playedMatches;
    const awardedPrizePool = archivedHomeStats.prizePool + completedTournamentPrizes.reduce((sum, tournament) => sum + parsePrizePoolValue(tournament.prizePool), 0);

    return {
      playersCount,
      tournamentsCount,
      matchesCount,
      awardedPrizePool,
    };
  },
  ["home-page-stats"],
  { revalidate: 300 },
);

export default async function HomePage() {
  const { playersCount, tournamentsCount, matchesCount, awardedPrizePool } = await getHomeStats();

  const stats = [
    { icon: Users, value: playersCount, suffix: "+", label: "игроков" },
    { icon: Trophy, value: tournamentsCount, suffix: "", label: "турниров проведено" },
    { icon: Swords, value: matchesCount, suffix: "", label: "сыграно матчей" },
    { icon: Medal, value: awardedPrizePool, suffix: " ₽", label: "разыграно призов" },
  ];

  const path = [
    {
      icon: ClipboardCheck,
      title: "Регистрация",
      text: "Создай профиль и подай заявку на открытый турнир за пару минут.",
    },
    {
      icon: Layers,
      title: "Групповой этап",
      text: "Играй матчи, набирай очки и поднимайся в таблице своей группы.",
    },
    {
      icon: Swords,
      title: "Плей-офф",
      text: "Проходи сетку на вылет — каждый матч приближает к финалу.",
    },
    {
      icon: Trophy,
      title: "Трофей",
      text: "Забирай приз, титул чемпиона и место в истории сезона.",
    },
  ];

  const features = [
    {
      icon: Trophy,
      title: "Турнирные сетки",
      text: "Автоматические сетки, живой счёт и понятный путь до финала — от квалификации до трофея.",
      wide: true,
    },
    {
      icon: ShieldCheck,
      title: "Честная модерация",
      text: "Подтверждение результатов и разбор спорных матчей администрацией.",
      wide: false,
    },
    {
      icon: Zap,
      title: "Realtime-уведомления",
      text: "Мгновенные оповещения о матчах, соперниках и результатах.",
      wide: false,
    },
    {
      icon: BarChart3,
      title: "Рейтинг и дивизионы",
      text: "Растите по дивизионам, следите за таблицей и позицией среди сильнейших.",
      wide: true,
    },
  ];

  const quickLinks = [
    { href: "/tournaments", icon: Trophy, title: "Турниры", text: "Активные и предстоящие" },
    { href: "/ratings", icon: BarChart3, title: "Рейтинг", text: "Таблица лидеров" },
    { href: "/divisions", icon: Layers, title: "Дивизионы", text: "Система лиг" },
    { href: "/players", icon: Users, title: "Игроки", text: "Профили участников" },
  ];

  return (
    <main className={`${styles["home-premium"]} -mt-16 min-h-screen overflow-hidden sm:-mt-[72px] lg:-mt-20`}>
      <div className={styles["home-premium-bg"]} aria-hidden="true">
        <video
          className={styles["home-premium-bg-video"]}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          poster="/images-site/home-hero-poster.jpg"
        >
          <source src="/videos/home-hero-stadium.webm" type="video/webm" />
          <source src="/videos/home-hero-stadium.mp4" type="video/mp4" />
        </video>
        <div className={styles["home-premium-bg-grade"]} />
        <div className={`${styles["home-premium-depth"]} ${styles["home-premium-depth-left"]}`} />
        <div className={`${styles["home-premium-depth"]} ${styles["home-premium-depth-right"]}`} />
      </div>

      <section className={styles["home-premium-stage"]}>
        <div className={styles["home-premium-grid"]} aria-hidden="true" />
        <div className={styles["home-premium-rings"]} aria-hidden="true" />

        <div className={styles["home-hud-frame"]} aria-hidden="true">
          <span className={`${styles["home-hud-corner"]} ${styles["home-hud-corner-tl"]}`} />
          <span className={`${styles["home-hud-corner"]} ${styles["home-hud-corner-tr"]}`} />
          <span className={`${styles["home-hud-corner"]} ${styles["home-hud-corner-bl"]}`} />
          <span className={`${styles["home-hud-corner"]} ${styles["home-hud-corner-br"]}`} />
        </div>

        <div className={styles["home-premium-content"]}>
          <div className={styles["home-premium-topline"]}>
            <span className={styles["home-live-tag"]}>
              <Radio className="h-3.5 w-3.5" />
              LIVE
            </span>
            <span>eFootball Mobile</span>
            <span className={styles["home-premium-dot"]} />
            <span>Киберфутбольная лига</span>
          </div>

          <div className={styles["home-premium-phrases"]} aria-label="Мотивационные фразы eFootball Nexon">
            {heroPhrases.map((phrase, index) => (
              <span
                key={phrase}
                className={styles["home-premium-phrase"]}
                style={{ "--phrase-delay": `${index * 3.6}s` } as CSSProperties}
              >
                {phrase}
              </span>
            ))}
          </div>

          <h1 className={styles["home-premium-title"]}>eFootball Nexon</h1>
          <div className={styles["home-premium-gold-line"]} />

          <p className={styles["home-premium-subtitle"]}>
            Соревновательная платформа для турниров по eFootball Mobile: сетки, рейтинги,
            дивизионы и честная модерация результатов в одном месте.
          </p>

          <div className={styles["home-premium-actions"]} aria-label="Главные действия">
            <Link href="/tournaments" className={styles["home-main-action"]}>
              <Trophy className="h-5 w-5" />
              <span>Турниры</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href={telegramHref} target="_blank" rel="noreferrer" className={styles["home-social-button"]}>
              <Send className="h-4 w-4" />
              <span>Telegram</span>
            </Link>
            <Link href={marketHref} target="_blank" rel="noreferrer" className={styles["home-social-button"]}>
              <ShoppingBag className="h-4 w-4" />
              <span>Маркет</span>
            </Link>
          </div>
        </div>

        <div className={styles["home-premium-lower"]}>
          <div className={styles["home-premium-stats"]} aria-label="Статистика платформы">
            {stats.map((stat, index) => (
              <div
                key={stat.label}
                className={styles["home-premium-stat"]}
                style={{ "--stat-delay": `${0.8 + index * 0.12}s` } as CSSProperties}
              >
                <div className={styles["home-stat-head"]}>
                  <stat.icon className="h-4 w-4" />
                </div>
                <div className={styles["home-stat-value"]}>
                  <AnimatedCounter value={stat.value} />
                  {stat.suffix}
                </div>
                <div className={styles["home-stat-label"]}>{stat.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div className={styles["home-scroll-cue"]} aria-hidden="true">
          <span className={styles["home-scroll-track"]}>
            <span className={styles["home-scroll-thumb"]} />
          </span>
          <span className={styles["home-scroll-label"]}>Листай вниз</span>
        </div>
      </section>

      <section className={styles["home-section"]}>
        <Reveal>
          <div className={styles["home-section-head"]}>
            <span className={styles["home-eyebrow"]}>Как это работает</span>
            <h2 className={styles["home-section-title"]}>Путь до трофея</h2>
          </div>
        </Reveal>
        <div className={styles["home-path"]}>
          {path.map((step, index) => (
            <Reveal key={step.title} delay={index * 90}>
              <article className={styles["home-path-card"]}>
                <div className={styles["home-path-head"]}>
                  <span className={styles["home-path-num"]}>{String(index + 1).padStart(2, "0")}</span>
                  <span className={styles["home-path-icon"]}>
                    <step.icon className="h-5 w-5" />
                  </span>
                </div>
                <h3 className={styles["home-path-title"]}>{step.title}</h3>
                <p className={styles["home-path-text"]}>{step.text}</p>
              </article>
            </Reveal>
          ))}
        </div>
      </section>

      <section className={styles["home-section"]}>
        <Reveal>
          <div className={styles["home-section-head"]}>
            <span className={styles["home-eyebrow"]}>Возможности платформы</span>
            <h2 className={styles["home-section-title"]}>Всё для соревновательной игры</h2>
          </div>
        </Reveal>
        <div className={styles["home-bento"]}>
          {features.map((feature, index) => (
            <Reveal
              key={feature.title}
              delay={index * 80}
              className={feature.wide ? styles["home-bento-cell-wide"] : undefined}
            >
              <article className={`${styles["home-bento-card"]} ${feature.wide ? styles["home-bento-wide"] : ""}`}>
                <div className={styles["home-bento-icon"]}>
                  <feature.icon className="h-5 w-5" />
                </div>
                <h3 className={styles["home-bento-title"]}>{feature.title}</h3>
                <p className={styles["home-bento-text"]}>{feature.text}</p>
              </article>
            </Reveal>
          ))}
        </div>
      </section>

      <section className={styles["home-section"]}>
        <Reveal>
          <div className={styles["home-section-head"]}>
            <span className={styles["home-eyebrow"]}>Разделы</span>
            <h2 className={styles["home-section-title"]}>Начни отсюда</h2>
          </div>
        </Reveal>
        <div className={styles["home-quick-grid"]}>
          {quickLinks.map((link, index) => (
            <Reveal key={link.href} delay={index * 70}>
              <Link href={link.href} className={styles["home-quick-card"]}>
                <div className={styles["home-quick-icon"]}>
                  <link.icon className="h-5 w-5" />
                </div>
                <div className={styles["home-quick-body"]}>
                  <span className={styles["home-quick-title"]}>{link.title}</span>
                  <span className={styles["home-quick-text"]}>{link.text}</span>
                </div>
                <ArrowRight className={`h-4 w-4 ${styles["home-quick-arrow"]}`} />
              </Link>
            </Reveal>
          ))}
        </div>
      </section>

      <section className={styles["home-cta"]}>
        <Reveal>
          <div className={styles["home-cta-inner"]}>
            <h2 className={styles["home-cta-title"]}>Готов выйти на поле?</h2>
            <p className={styles["home-cta-text"]}>
              Регистрируйся, выбирай турнир и борись за место среди лучших игроков лиги.
            </p>
            <div className={styles["home-cta-actions"]}>
              <Link href="/tournaments" className={styles["home-main-action"]}>
                <Trophy className="h-5 w-5" />
                <span>Смотреть турниры</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href={telegramHref} target="_blank" rel="noreferrer" className={styles["home-social-button"]}>
                <Send className="h-4 w-4" />
                <span>Telegram</span>
              </Link>
            </div>
          </div>
        </Reveal>
      </section>
    </main>
  );
}
